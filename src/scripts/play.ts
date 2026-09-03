/**
 * play.ts
 *
 * Partida 1v1 jugable en la terminal (draft → rondas → victoria):
 *  1. Draft interactivo 1-2-2-2-1 (reutiliza `runDraft` de setup-draft).
 *  2. Configuración: bolsas, reservas, fichas de dominio iniciales.
 *  3. Rondas (spec §4.2 / §3.5): ambos roban 3 monedas; se alternan turnos
 *     empezando por la iniciativa; quien pasa no vuelve a actuar; cuando ambos
 *     pasan (o se quedan sin monedas) termina la ronda y se descartan las
 *     manos.
 *  4. Cada turno: menú de las 9 acciones con blancos guiados (listas de
 *     opciones válidas en vez de escribir coordenadas a ciegas). Las maniobras
 *     gratis de los atributos (Espadachín, Mercenario, Guerrero) se ofrecen
 *     antes de pasar el turno; el Clérigo que roba mantiene el turno para
 *     usar su moneda de inmediato.
 *
 * Hot-seat: los dos jugadores comparten la terminal.
 *
 * Uso:
 *   bun run play
 */

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import type { Interface } from "node:readline";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { prompt, runDraft } from "./setup-draft.ts";
import { configureGame } from "../domain/game-setup.ts";
import { Game } from "../domain/game.ts";
import type { DiscardChoice, FreeManeuverRequest, GameResult } from "../domain/game.ts";
import type { Board } from "../domain/board.ts";
import type { Player } from "../domain/player.ts";
import { FACTION_NAMES } from "../domain/player.ts";
import type { Unit } from "../domain/unit.ts";
import { UNIT_NAMES, UNIT_TOTAL_COINS, attackOnlyByAbility } from "../domain/units.ts";
import type { UnitType } from "../domain/units.ts";
import { UnitCoin } from "../domain/coins.ts";
import { ACTIVATABLE_TACTICS } from "../domain/abilities.ts";
import type { AbilityRequest, FootmanManeuver } from "../domain/abilities.ts";
import { distanceInHexes, hexesInStraightLine, reachableWithin } from "../domain/geometry.ts";
import type { PlayerId, Position } from "../domain/types.ts";

/** ¿Sí/no? (acepta s/si/y/yes y n/no). */
async function yesNo(rl: Interface, question: string): Promise<boolean> {
  for (;;) {
    const input = (await prompt(rl, `${question} (s/n): `)).toLowerCase();
    if (["s", "si", "y", "yes"].includes(input)) return true;
    if (["n", "no"].includes(input)) return false;
    console.log("Responde s o n.");
  }
}

/**
 * Menú de lista: muestra las opciones numeradas y devuelve la elegida (o
 * undefined si el usuario cancela con intro vacío).
 */
async function pickFromList<T>(
  rl: Interface,
  label: string,
  items: readonly T[],
  format: (item: T, index: number) => string,
): Promise<T | undefined> {
  if (items.length === 0) {
    console.log(`  (sin opciones para ${label})`);
    return undefined;
  }
  items.forEach((item, i) => console.log(`  ${i + 1}. ${format(item, i)}`));
  for (;;) {
    const input = await prompt(rl, `${label} [1-${items.length}, intro = cancelar]: `);
    if (input === "") return undefined;
    const n = Number.parseInt(input, 10);
    if (Number.isInteger(n) && n >= 1 && n <= items.length) return items[n - 1]!;
    console.log("Número inválido.");
  }
}

// ── Colores ANSI ────────────────────────────────────────────────────────────

const GREEN = "\x1b[38;2;143;255;145m";
const YELLOW = "\x1b[38;2;255;255;0m";
const PURPLE = "\x1b[38;2;150;150;255m";
const WHITE = "\x1b[38;2;255;255;255m";
const DIM = "\x1b[38;2;120;130;150m";
const RESET = "\x1b[0m";

/** Código de 2 letras de cada unidad para el mapa (cada celda mide 6). */
const UNIT_CODE: Readonly<Record<UnitType, string>> = {
  alferez: "Al",
  arquero: "Aq",
  ballestero: "Bs",
  caballeria: "Cv",
  "caballeria-ligera": "Cl",
  caballero: "Cb",
  clerigo: "Ce",
  espadachin: "Es",
  explorador: "Ex",
  "guardia-real": "GR",
  guerrero: "Gu",
  infanteria: "In",
  lancero: "La",
  mariscal: "Ma",
  mercenario: "Me",
  piquero: "Pi",
};

const CELL_W = 6;
const COLUMNS = ["A", "B", "C", "D", "E", "F", "G"] as const;
const MAX_ROW = 12;

/** Mapa de texto del tablero: una celda de 6 caracteres por casilla. */
function renderMap(game: Game): void {
  const board = game.board;
  const cells = new Map<string, { raw: string; color: string }>();
  for (const node of board.getAllNodes()) {
    const m = /^([A-Z])(\d+)$/.exec(node.id);
    if (m === null) continue;
    const key = `${m[1]},${Number(m[2]!)}`;
    const unit = board.unitAt(node.id);
    let raw: string;
    let color: string;
    if (unit !== undefined) {
      raw = `${unit.owner === "player1" ? "L" : "C"}${UNIT_CODE[unit.type]}${unit.coins}`;
      color = unit.owner === "player1" ? YELLOW : PURPLE;
    } else if (node.isControlledBy("player1")) {
      raw = "Lobos";
      color = YELLOW;
    } else if (node.isControlledBy("player2")) {
      raw = "Cuerv";
      color = PURPLE;
    } else if (node.isLocation()) {
      raw = "base";
      color = DIM;
    } else {
      raw = "·";
      color = GREEN;
    }
    cells.set(key, { raw, color });
  }

  // Cabecera de columnas.
  const header = "    " + COLUMNS.map((c) => c.padStart(3, " ").padEnd(CELL_W)).join(" ");
  console.log(`\n${WHITE}Tablero${RESET}`);
  console.log(header);
  for (let row = 0; row <= MAX_ROW; row++) {
    let line = String(row).padStart(2, " ") + "  ";
    for (const col of COLUMNS) {
      const cell = cells.get(`${col},${row}`);
      if (cell === undefined) {
        line += " ".repeat(CELL_W) + " ";
        continue;
      }
      const body = cell.raw.padEnd(CELL_W, "·");
      line += `${cell.color}${body}${RESET} `;
    }
    console.log(line);
  }
  console.log(
    `${DIM}Celda = columna+fila (ej. C1). L/C = Lobos/Cuervos; dos letras = unidad; nº = monedas de la pila; casillas sin color = bases.${RESET}`,
  );
}

/** Monedas de la mano agrupadas (una entrada por tipo/real). */
function handDiscardChoices(player: Player): DiscardChoice[] {
  const seen = new Set<string>();
  const out: DiscardChoice[] = [];
  for (const coin of player.hand.toArray()) {
    if (coin.isRoyal()) {
      if (!seen.has("royal")) {
        seen.add("royal");
        out.push({ kind: "royal" });
      }
    } else {
      const type = (coin as UnitCoin).type;
      if (!seen.has(type)) {
        seen.add(type);
        out.push({ kind: "unit", unitType: type });
      }
    }
  }
  return out;
}

/** Tipos de unidad presentes en la mano del jugador. */
function handUnitTypes(player: Player): UnitType[] {
  const set = new Set<UnitType>();
  for (const coin of player.hand.toArray()) {
    if (!coin.isRoyal()) set.add((coin as UnitCoin).type);
  }
  return [...set];
}

function ownUnits(game: Game, playerId: PlayerId): Unit[] {
  return game.board.getUnitsByPlayer(playerId);
}

function enemyUnits(game: Game, playerId: PlayerId): Unit[] {
  return game.board.getAllUnits().filter((u) => u.owner !== playerId);
}

/** Unidades propias de un tipo en el tablero. */
function unitsOf(game: Game, playerId: PlayerId, type: UnitType): Unit[] {
  return ownUnits(game, playerId).filter((u) => u.type === type);
}

/** Enemigos adyacentes a una casilla. */
function adjacentEnemies(game: Game, playerId: PlayerId, from: Position): Unit[] {
  return enemyUnits(game, playerId).filter((u) => game.board.areAdjacent(from, u.position));
}

/** Pide un destino adyacente y libre desde una unidad. */
async function askMoveDest(rl: Interface, game: Game, unit: Unit): Promise<Position | undefined> {
  const dests = game.board.getNeighbors(unit.position).filter((p) => game.board.unitAt(p) === undefined);
  return pickFromList(rl, `Mover a (desde ${unit.position})`, dests, (p) => p);
}

/** Pide un enemigo adyacente a atacar (con la opción de la Guardia Real). */
async function askAttackTarget(
  rl: Interface,
  game: Game,
  playerId: PlayerId,
  unit: Unit,
): Promise<{ target: Unit; royalGuardFromReserve: boolean } | undefined> {
  const candidates = adjacentEnemies(game, playerId, unit.position);
  const target = await pickFromList(
    rl,
    "Atacar a (enemigo adyacente)",
    candidates,
    (u) => `${UNIT_NAMES[u.type]} de ${FACTION_NAMES[u.owner]} en ${u.position} (pila ${u.coins})`,
  );
  if (target === undefined) return undefined;
  let royalGuardFromReserve = false;
  if (target.type === "guardia-real") {
    royalGuardFromReserve = await yesNo(rl, "¿La Guardia Real defiende con una moneda de la reserva?");
  }
  return { target, royalGuardFromReserve };
}

// ── Parámetros de las 9 tácticas activables ────────────────────────────────

async function askAbility(rl: Interface, game: Game, playerId: PlayerId, unit: Unit): Promise<AbilityRequest | undefined> {
  const board = game.board;
  switch (unit.type) {
    case "alferez": {
      const allies = game.alliedUnitsInRange(playerId, unit.position, 2).filter((u) => u.type !== "alferez");
      const ally = await pickFromList(
        rl,
        "Unidad aliada a 1-2 del Alférez",
        allies,
        (u) => `${UNIT_NAMES[u.type]} en ${u.position}`,
      );
      if (ally === undefined) return undefined;
      const dests = board.getNeighbors(ally.position).filter((p) => {
        const d = distanceInHexes(board, unit.position, p);
        return board.unitAt(p) === undefined && d >= 1 && d <= 2;
      });
      const dest = await pickFromList(rl, "Destino (adyacente a la aliada y a 1-2 del Alférez)", dests, (p) => p);
      if (dest === undefined) return undefined;
      return { ability: "ensign", ally: ally.position, to: dest };
    }
    case "arquero": {
      const candidates = enemyUnits(game, playerId).filter((u) => distanceInHexes(board, unit.position, u.position) === 2);
      const target = await pickFromList(rl, "Blanco del Arquero (a 2 casillas)", candidates, (u) => `${UNIT_NAMES[u.type]} en ${u.position}`);
      if (target === undefined) return undefined;
      return { ability: "archer", target: target.position };
    }
    case "ballestero": {
      // Solo enemigos en línea recta a 1-2 (igual que valida el motor).
      const candidates = enemyUnits(game, playerId).filter((u) => {
        const d = distanceInHexes(board, unit.position, u.position);
        if (d < 1 || d > 2) return false;
        const between = hexesInStraightLine(board, unit.position, u.position);
        return between.length === d - 1;
      });
      const target = await pickFromList(rl, "Blanco del Ballestero (en línea recta a 1-2)", candidates, (u) => `${UNIT_NAMES[u.type]} en ${u.position}`);
      if (target === undefined) return undefined;
      return { ability: "crossbowman", target: target.position };
    }
    case "caballeria": {
      const moveTo = await pickFromList(
        rl,
        "Casilla a la que carga (adyacente)",
        board.getNeighbors(unit.position).filter((p) => board.unitAt(p) === undefined),
        (p) => p,
      );
      if (moveTo === undefined) return undefined;
      const target = await pickFromList(
        rl,
        "Objetivo de la carga (enemigo adyacente a la casilla de destino)",
        adjacentEnemies(game, playerId, moveTo),
        (u) => `${UNIT_NAMES[u.type]} en ${u.position}`,
      );
      if (target === undefined) return undefined;
      return { ability: "cavalry", moveTo, attackTarget: target.position };
    }
    case "caballeria-ligera": {
      const dests = reachableWithin(board, unit.position, 2, (p) => board.unitAt(p) !== undefined).filter(
        (p) => p !== unit.position,
      );
      const dest = await pickFromList(rl, "Destino de la Caballería ligera (hasta 2 casillas)", dests, (p) => p);
      if (dest === undefined) return undefined;
      return { ability: "light-cavalry", to: dest };
    }
    case "guardia-real": {
      const reachable = reachableWithin(board, unit.position, 2, (p) => board.unitAt(p) !== undefined);
      const dests = board
        .getLocations()
        .filter((n) => n.isControlledBy(playerId) && board.unitAt(n.id) === undefined && reachable.includes(n.id))
        .map((n) => n.id);
      const dest = await pickFromList(rl, "Localización dominada a ≤2 casillas", dests, (p) => p);
      if (dest === undefined) return undefined;
      return { ability: "royal-guard", to: dest };
    }
    case "infanteria": {
      const footmen = unitsOf(game, playerId, "infanteria");
      const maneuvers: FootmanManeuver[] = [];
      for (const footman of footmen) {
        console.log(`\nInfantería en ${footman.position}:`);
        const kind = await pickFromList(
          rl,
          "Maniobra",
          [{ label: "Mover", kind: "move" }, { label: "Atacar", kind: "attack" }, { label: "Dominar", kind: "control" }],
          (k) => k.label,
        );
        if (kind === undefined) return undefined;
        switch (kind.kind) {
          case "move": {
            const to = await askMoveDest(rl, game, footman);
            if (to === undefined) return undefined;
            maneuvers.push({ kind: "move", unitPos: footman.position, to });
            break;
          }
          case "attack": {
            const attack = await askAttackTarget(rl, game, playerId, footman);
            if (attack === undefined) return undefined;
            maneuvers.push({ kind: "attack", unitPos: footman.position, target: attack.target.position });
            break;
          }
          case "control":
            maneuvers.push({ kind: "control", unitPos: footman.position });
            break;
        }
      }
      if (maneuvers.length === 0) return undefined;
      return { ability: "footman", maneuvers };
    }
    case "lancero": {
      const candidates = enemyUnits(game, playerId).filter((u) => {
        const d = distanceInHexes(board, unit.position, u.position);
        if (d < 2 || d > 3) return false;
        const between = hexesInStraightLine(board, unit.position, u.position);
        return between.length === d - 1 && between.every((p) => board.unitAt(p) === undefined);
      });
      const target = await pickFromList(rl, "Objetivo de la embestida (en línea recta a 2-3, camino libre)", candidates, (u) => `${UNIT_NAMES[u.type]} en ${u.position}`);
      if (target === undefined) return undefined;
      return { ability: "lancer", target: target.position };
    }
    case "mariscal": {
      const allies = game.alliedUnitsInRange(playerId, unit.position, 2).filter((u) => !attackOnlyByAbility(u.type));
      const ally = await pickFromList(
        rl,
        "Unidad aliada que ataca (a 1-2 del Mariscal)",
        allies,
        (u) => `${UNIT_NAMES[u.type]} en ${u.position}`,
      );
      if (ally === undefined) return undefined;
      const target = await pickFromList(
        rl,
        "Objetivo del ataque ordenado (adyacente a la aliada)",
        adjacentEnemies(game, playerId, ally.position),
        (u) => `${UNIT_NAMES[u.type]} en ${u.position}`,
      );
      if (target === undefined) return undefined;
      return { ability: "marshal", ally: ally.position, attackTarget: target.position };
    }
    default:
      return undefined;
  }
}

// ── Acciones del menú ───────────────────────────────────────────────────────

type Executor = () => Promise<GameResult | undefined>;

interface MenuOption {
  label: string;
  run: Executor;
}

/** Construye las opciones disponibles del jugador en su turno. */
function buildOptions(rl: Interface, game: Game, playerId: PlayerId): MenuOption[] {
  const player = game.player(playerId);
  const coins = handDiscardChoices(player);
  const handTypes = handUnitTypes(player);
  const units = ownUnits(game, playerId);
  const options: MenuOption[] = [];

  // 1. Desplegar — monedas de tipo en mano y localización controlada libre.
  //    El Explorador (I) además puede desplegar en CUALQUIER casilla vacía
  //    adyacente a una unidad aliada.
  const deployable = handTypes.filter((t) => unitsOf(game, playerId, t).length < (t === "infanteria" ? 2 : 1));
  const freeControlled = game.board
    .getControlledLocations(playerId)
    .filter((n) => game.board.unitAt(n.id) === undefined)
    .map((n) => n.id);
  const scoutCells = deployable.includes("explorador")
    ? [...new Set(ownUnits(game, playerId).flatMap((u) => game.board.getNeighbors(u.position).filter((p) => game.board.unitAt(p) === undefined)))]
    : [];
  if (deployable.length > 0 && (freeControlled.length > 0 || scoutCells.length > 0)) {
    options.push({
      label: `Desplegar (${deployable.map((t) => UNIT_NAMES[t]).join(", ")})`,
      run: async () => {
        const type = await pickFromList(rl, "Tipo a desplegar", deployable, (t) => `${UNIT_NAMES[t]} (${UNIT_TOTAL_COINS[t]} monedas)`);
        if (type === undefined) return undefined;
        const cells = type === "explorador" ? [...new Set([...freeControlled, ...scoutCells])] : freeControlled;
        const position = await pickFromList(
          rl,
          type === "explorador" ? "Casilla de despliegue (controlada o adyacente a un aliado)" : "Localización controlada libre",
          cells,
          (p) => p,
        );
        if (position === undefined) return undefined;
        return game.deploy(playerId, type, position);
      },
    });
  }

  // 2. Reforzar — unidades propias con moneda de su tipo en la mano.
  const bolsterable = units.filter((u) => player.hand.hasUnit(u.type));
  if (bolsterable.length > 0) {
    options.push({
      label: "Reforzar",
      run: async () => {
        const unit = await pickFromList(
          rl,
          "Unidad a reforzar (apilar otra moneda)",
          bolsterable,
          (u) => `${UNIT_NAMES[u.type]} en ${u.position} (pila ${u.coins})`,
        );
        if (unit === undefined) return undefined;
        return game.bolster(playerId, unit.type);
      },
    });
  }

  // 3. Mover — unidades con algún vecino libre y su moneda de maniobra en mano.
  const movable = units.filter(
    (u) => player.hand.hasUnit(u.type) && game.board.getNeighbors(u.position).some((p) => game.board.unitAt(p) === undefined),
  );
  if (movable.length > 0) {
    options.push({
      label: "Mover",
      run: async () => {
        const unit = await pickFromList(rl, "Unidad a mover", movable, (u) => `${UNIT_NAMES[u.type]} en ${u.position}`);
        if (unit === undefined) return undefined;
        const to = await askMoveDest(rl, game, unit);
        if (to === undefined) return undefined;
        return game.executeManeuver(playerId, { kind: "move", unitType: unit.type, to, unitPos: unit.position });
      },
    });
  }

  // 4. Atacar — unidades sin restricción (X), con enemigo adyacente y su
  //    moneda de maniobra en la mano.
  const attackers = units.filter(
    (u) => !attackOnlyByAbility(u.type) && player.hand.hasUnit(u.type) && adjacentEnemies(game, playerId, u.position).length > 0,
  );
  if (attackers.length > 0) {
    options.push({
      label: "Atacar",
      run: async () => {
        const unit = await pickFromList(rl, "Unidad que ataca", attackers, (u) => `${UNIT_NAMES[u.type]} en ${u.position} (pila ${u.coins})`);
        if (unit === undefined) return undefined;
        const attack = await askAttackTarget(rl, game, playerId, unit);
        if (attack === undefined) return undefined;
        return game.executeManeuver(playerId, {
          kind: "attack",
          unitType: unit.type,
          target: attack.target.position,
          unitPos: unit.position,
          royalGuardFromReserve: attack.royalGuardFromReserve,
        });
      },
    });
  }

  // 5. Dominar — unidades en una localización que no controlan y con su
  //    moneda de maniobra en la mano.
  const controllers = units.filter((u) => {
    const node = game.board.getNode(u.position);
    return node !== undefined && node.isLocation() && !node.isControlledBy(playerId) && player.hand.hasUnit(u.type);
  });
  if (controllers.length > 0) {
    options.push({
      label: "Dominar",
      run: async () => {
        const unit = await pickFromList(
          rl,
          "Unidad que coloca la ficha",
          controllers,
          (u) => `${UNIT_NAMES[u.type]} en ${u.position}`,
        );
        if (unit === undefined) return undefined;
        return game.executeManeuver(playerId, { kind: "control", unitType: unit.type, unitPos: unit.position });
      },
    });
  }

  // 6. Usar habilidad — unidades con táctica activable Y la moneda que la
  //    paga en la mano (la Guardia Real paga con la moneda real).
  const tacticians = units.filter(
    (u) => ACTIVATABLE_TACTICS.has(u.type) && (u.type === "guardia-real" ? player.hand.hasRoyal() : player.hand.hasUnit(u.type)),
  );
  if (tacticians.length > 0) {
    options.push({
      label: "Usar habilidad (táctica)",
      run: async () => {
        const unit = await pickFromList(
          rl,
          "Unidad que usa su táctica (descarta 1 moneda suya)",
          tacticians,
          (u) => UNIT_NAMES[u.type],
        );
        if (unit === undefined) return undefined;
        const params = await askAbility(rl, game, playerId, unit);
        if (params === undefined) return undefined;
        return game.executeManeuver(playerId, { kind: "ability", unitType: unit.type, params, unitPos: unit.position });
      },
    });
  }

  // 7. Reclamar iniciativa — descarte boca abajo (una vez por ronda).
  if (coins.length > 0 && game.initiative !== playerId && !game.initiativeClaimedThisRound) {
    options.push({
      label: `Reclamar la iniciativa (actual: ${FACTION_NAMES[game.initiative]})`,
      run: async () => {
        const discard = await pickFromList(rl, "Moneda a descartar boca abajo", coins, (c) => coinLabel(c));
        if (discard === undefined) return undefined;
        return game.claimInitiative(playerId, discard);
      },
    });
  }

  // 8. Reclutar — descarte boca abajo + reserva.
  if (coins.length > 0 && player.reserve.total() > 0) {
    options.push({
      label: `Reclutar (reserva: ${formattedReserve(player)})`,
      run: async () => {
        const discard = await pickFromList(rl, "Moneda a descartar boca abajo", coins, (c) => coinLabel(c));
        if (discard === undefined) return undefined;
        const reserveTypes = player.unitCards.filter((t) => player.reserve.countUnit(t) > 0);
        const reserveType = await pickFromList(rl, "Tipo a reclutar (moneda al descarte boca arriba)", reserveTypes, (t) => UNIT_NAMES[t]);
        if (reserveType === undefined) return undefined;
        return game.recruit(playerId, discard, reserveType);
      },
    });
  }

  // 9. Pasar — descarte boca abajo y fuera de la ronda.
  if (coins.length > 0) {
    options.push({
      label: "Pasar (descarta 1 moneda y sales de la ronda)",
      run: async () => {
        const discard = await pickFromList(rl, "Moneda a descartar boca abajo", coins, (c) => coinLabel(c));
        if (discard === undefined) return undefined;
        return game.pass(playerId, discard);
      },
    });
  }

  return options;
}

function coinLabel(choice: DiscardChoice): string {
  return choice.kind === "royal" ? "Moneda real" : UNIT_NAMES[choice.unitType];
}

function formattedReserve(player: Player): string {
  return player.unitCards
    .filter((t) => player.reserve.countUnit(t) > 0)
    .map((t) => `${UNIT_NAMES[t]} ×${player.reserve.countUnit(t)}`)
    .join(", ");
}

function formatHand(player: Player): string {
  const parts = player.hand.toArray().map((coin) => (coin.isRoyal() ? "Moneda real" : UNIT_NAMES[(coin as UnitCoin).type]));
  return parts.length > 0 ? parts.join(", ") : "(vacía)";
}

/** Estado de un jugador (fichas, unidades en tablero, mano, reserva). */
function playerPanel(game: Game, playerId: PlayerId): string {
  const player = game.player(playerId);
  const color = playerId === "player1" ? YELLOW : PURPLE;
  const onBoard = ownUnits(game, playerId)
    .map((u) => `${UNIT_NAMES[u.type]}@${u.position}(${u.coins})`)
    .join(", ");
  return [
    `${color}${player.factionName} (${playerId})${RESET} · fichas ${game.countPlacedMarkers(playerId)}/${player.controlMarkers}`
    + `${onBoard.length > 0 ? ` · tablero: ${onBoard}` : ""}`,
    `  Mano: ${formatHand(player)}`,
    `  Reserva: ${formattedReserve(player) || "(vacía)"}`,
  ].join("\n");
}

function renderState(game: Game): void {
  const playerId = game.currentPlayer;
  renderMap(game);
  console.log(`\n${WHITE}══ Ronda ${game.round} · Turno de ${FACTION_NAMES[playerId]}${RESET} ══`);
  console.log(
    `${DIM}Iniciativa: ${FACTION_NAMES[game.initiative]} · quien pasó ya no actúa: ${game.passed.player1 ? `${FACTION_NAMES.player1}` : ""}${game.passed.player2 ? (game.passed.player1 ? ", " : "") + FACTION_NAMES.player2 : ""}${RESET}`,
  );
  console.log(playerPanel(game, "player1"));
  console.log(playerPanel(game, "player2"));
}

/** Ofrece las maniobras gratis pendientes (atributos I) y las ejecuta si se quiere. */
async function handleFreeManeuvers(rl: Interface, game: Game, playerId: PlayerId): Promise<void> {
  for (;;) {
    const grants = game.pendingFreeManeuvers
      .filter((fm) => fm.player === playerId && game.board.getAllUnits().includes(fm.unit))
      .filter((fm, i, all) => all.findIndex((g) => g.unit === fm.unit && g.kind === fm.kind) === i);
    if (grants.length === 0) return;
    const kindLabel = (kind: string) => (kind === "move" ? "movimiento gratis" : "maniobra gratis");
    const grant = await pickFromList(
      rl,
      "Maniobra gratis disponible",
      grants,
      (fm) => `${UNIT_NAMES[fm.unit.type]} (${kindLabel(fm.kind)}) — ¿usarla?`,
    );
    if (grant === undefined) return; // el jugador no la quiere aprovechar

    const kinds: { label: string; kind: "move" | "attack" | "control" }[] = [{ label: "Mover", kind: "move" }];
    if (grant.kind !== "move" && !attackOnlyByAbility(grant.unit.type)) {
      kinds.push({ label: "Atacar", kind: "attack" });
    }
    if (grant.kind !== "move") kinds.push({ label: "Dominar", kind: "control" });

    const kind = await pickFromList(rl, "¿Qué maniobra gratis?", kinds, (k) => k.label);
    if (kind === undefined) continue;

    let request: FreeManeuverRequest | undefined;
    switch (kind.kind) {
      case "move": {
        const to = await askMoveDest(rl, game, grant.unit);
        if (to === undefined) continue;
        request = { kind: "move", unitType: grant.unit.type, to, unitPos: grant.unit.position };
        break;
      }
      case "attack": {
        const attack = await askAttackTarget(rl, game, playerId, grant.unit);
        if (attack === undefined) continue;
        request = { kind: "attack", unitType: grant.unit.type, target: attack.target.position, unitPos: grant.unit.position };
        break;
      }
      case "control":
        request = { kind: "control", unitType: grant.unit.type, unitPos: grant.unit.position };
        break;
    }
    if (request === undefined) continue;

    const result = game.executeFreeManeuver(playerId, request);
    console.log(result.success ? `  ✓ ${result.message}` : `  ✗ ${result.message}`);
    for (const event of result.events) console.log(`    · ${event.message}`);
  }
}

/** Menú del turno: ejecuta la acción elegida (reintenta si falla la validación). */
async function takeAction(rl: Interface, game: Game, playerId: PlayerId): Promise<GameResult | undefined> {
  const options = buildOptions(rl, game, playerId);
  if (options.length === 0) {
    console.log("  (no hay acciones posibles: se cuenta como pase automático al quedarte sin opciones)");
    return undefined;
  }
  for (;;) {
    console.log("");
    const option = await pickFromList(rl, "Acción", options, (o) => o.label);
    if (option === undefined) return undefined;
    const result = await option.run();
    if (result === undefined) return undefined; // el jugador canceló dentro de la acción
    if (!result.success) {
      console.log(`  ✗ ${result.message}`);
      continue; // misma acción, mismo turno: reintenta
    }
    return result;
  }
}

/** Cabecera con el estado del tablero cargado. */
function printHeader(board: Board): void {
  console.log("── War Chest 1v1 — partida en la terminal (hot-seat) ──");
  console.log(
    `Tablero: ${board.size} casillas, ${board.getLocations().length} localizaciones (bases de ${FACTION_NAMES.player1}: `
    + `${board.getStartLocations("player1").join(", ")}; ${FACTION_NAMES.player2}: ${board.getStartLocations("player2").join(", ")}).`,
  );
  console.log("Draft → rondas → victoria (coloca tus 6 fichas de dominio).");
}

function printSetupSummary(game: Game): void {
  console.log("\n── Ejércitos elegidos ──");
  for (const id of ["player1", "player2"] as const) {
    const player = game.player(id);
    console.log(
      `${FACTION_NAMES[id]}: ${player.unitCards.map((t) => `${UNIT_NAMES[t]} (${UNIT_TOTAL_COINS[t]} monedas)`).join(", ")}`,
    );
  }
  console.log(`Iniciativa de la primera ronda: ${FACTION_NAMES[game.initiative]}.`);
}

/** Bucle principal de la partida. */
export async function runPlay(): Promise<void> {
  const board = await new SVGBoardLoader().load();
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    printHeader(board);
    const chosen = await runDraft(rl);
    const config = configureGame(board, chosen);
    const game = new Game({
      board,
      players: { player1: config.player1, player2: config.player2 },
      initiative: config.initiative,
    });
    printSetupSummary(game);

    while (game.winner === undefined) {
      const started = game.startRound();
      if (!started.success) {
        console.log(started.message);
        break;
      }
      console.log(`\n${WHITE}══ Ronda ${game.round} ══${RESET}  Iniciativa: ${FACTION_NAMES[game.initiative]}`);
      for (const event of started.events) console.log(`  ${event.message}`);

      while (!game.roundOver && game.winner === undefined) {
        const playerId = game.currentPlayer;
        if (game.passed[playerId]) {
          game.nextTurn();
          continue;
        }
        if (game.player(playerId).hand.isEmpty()) {
          const retired = game.retire(playerId);
          console.log(`  ${retired.message}`);
          continue;
        }
        renderState(game);
        const result = await takeAction(rl, game, playerId);
        if (result === undefined) continue; // cancelado: se vuelve a dibujar el turno
        console.log(`  ✓ ${result.message}`);
        for (const event of result.events) console.log(`    · ${event.message}`);

        // Maniobras gratis de atributos (Espadachín, Mercenario, Guerrero).
        await handleFreeManeuvers(rl, game, playerId);

        // El Clérigo que robó una moneda actúa de nuevo de inmediato; si no,
        // el turno pasa al otro jugador.
        const clerigoDraws = result.events.some((e) => e.type === "drawn" && e.player === playerId);
        if (!game.passed[playerId] && !clerigoDraws) game.nextTurn();
      }

      if (game.winner === undefined) {
        const ended = game.endRound();
        console.log(`  ${ended.message}`);
      }
    }

    if (game.winner !== undefined) {
      console.log(`\n🏆 ¡${FACTION_NAMES[game.winner]} gana la partida en la ronda ${game.round}!`);
    } else {
      console.log("\nFin de la partida sin ganador.");
    }
  } finally {
    rl.close();
  }
}

// Ejecución directa como script: `bun run play`.
if (import.meta.main) {
  await runPlay();
}