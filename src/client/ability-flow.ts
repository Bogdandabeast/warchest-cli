/**
 * Asistente de TÁCTICAS para la TUI (acción "Usar habilidad").
 *
 * Cada unidad activable recorre una secuencia de pasos guiados (como hace
 * `bun run play` con `askAbility`) pero navegando con ← → + Enter:
 *
 *  - Alférez (ensign): aliado a 1-2 → destino adyacente a ese aliado (1-2 del Alférez).
 *  - Arquero (archer): enemigo a EXACTAMENTE 2 casillas.
 *  - Ballestero (crossbowman): enemigo en línea recta a 1-2.
 *  - Caballería (cavalry): casilla de carga adyacente → enemigo adyacente a esa casilla.
 *  - Caballería ligera (light-cavalry): destino a ≤2 por casillas vacías.
 *  - Guardia Real (royal-guard): localización propia dominada y libre a ≤2.
 *  - Infantería (footman): una maniobra por cada Infantería del tablero
 *    (mover/atacar/dominar), atómico — se puede parar antes y ejecutar.
 *  - Lancero (lancer): enemigo en línea recta a 2-3 con camino libre.
 *  - Mariscal (marshal): aliado a 1-2 (no de ataque solo-habilidad) → enemigo
 *    adyacente a ese aliado.
 *
 * El estado del asistente son `tokens`: cada token es una elección ya tomada.
 * `abilityNext` reproduce las elecciones y devuelve el siguiente paso (título
 * + opciones) o, cuando la secuencia está completa, la `AbilityRequest` lista
 * para ejecutar. Esc en un paso quita el último token (`popAbilityToken`).
 */
import type { Game } from "../domain/game.ts";
import type { Unit } from "../domain/unit.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import { distanceInHexes, hexesInStraightLine, reachableWithin } from "../domain/geometry.ts";
import type { AbilityRequest, FootmanManeuver } from "../domain/abilities.ts";
import { attackOnlyByAbility } from "../domain/units.ts";
import { UNIT_NAMES } from "../domain/units.ts";

export type FootmanAct = "move" | "attack" | "control";

export type AbilityToken =
  | { kind: "pos"; position: Position }
  | { kind: "fm"; footman: Position; act: FootmanAct; target?: Position }
  | { kind: "fm-skip"; footman: Position }
  | { kind: "done" };

export interface AbilityOption {
  label: string;
  token: AbilityToken;
}

export interface AbilityStep {
  title: string;
  options: readonly AbilityOption[];
}

export type AbilityProgress = { step: AbilityStep } | { request: AbilityRequest };

// ── Utilidades del tablero ─────────────────────────────────────────────────

function enemiesOf(game: Game, playerId: PlayerId): Unit[] {
  return game.board.getUnitsByPlayer(game.other(playerId));
}

function alliedUnits(game: Game, playerId: PlayerId, from: Position, range: number, excludeSelf = true): Unit[] {
  return game.board
    .getUnitsByPlayer(playerId)
    .filter((unit) => {
      if (excludeSelf && unit.position === from) return false;
      const distance = distanceInHexes(game.board, from, unit.position);
      return distance >= 1 && distance <= range;
    });
}

function unitLabel(unit: Unit): string {
  return `${UNIT_NAMES[unit.type]} en ${unit.position}`;
}

function posOption(position: Position, label: string): AbilityOption {
  return { label, token: { kind: "pos", position } };
}

/**
 * ¿La unidad cargadora (Caballería/Lancero/Infantería) puede atacar a este
 * enemigo? Espejo del motor: un Caballero solo es atacable por unidades
 * reforzadas (2+ monedas), así que no se ofrece un blanco imposible.
 */
function canCharge(attacker: Unit, enemy: Unit): boolean {
  return enemy.type !== "caballero" || attacker.isReinforced();
}

/** ¿La Infantería en `footman` puede hacer esta maniobra? (espejo del motor). */
function footmanCan(game: Game, playerId: PlayerId, footman: Unit, act: FootmanAct): boolean {
  const board = game.board;
  if (act === "move") {
    return board.getNeighbors(footman.position).some((p) => board.unitAt(p) === undefined);
  }
  if (act === "attack") {
    return board.getNeighbors(footman.position).some((p) => {
      const enemy = board.unitAt(p);
      if (enemy === undefined || enemy.owner === playerId) return false;
      if (enemy.type === "caballero" && !footman.isReinforced()) return false;
      return true;
    });
  }
  const node = board.getNode(footman.position);
  return node !== undefined && node.isLocation() && !node.isControlledBy(playerId);
}

// ── Máquina de pasos ───────────────────────────────────────────────────────

export function abilityStep(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  switch (unit.type) {
    case "alferez": return ensign(game, playerId, unit, tokens);
    case "arquero": return archer(game, playerId, unit, tokens);
    case "ballestero": return crossbowman(game, playerId, unit, tokens);
    case "caballeria": return cavalry(game, playerId, unit, tokens);
    case "caballeria-ligera": return lightCavalry(game, playerId, unit, tokens);
    case "guardia-real": return royalGuard(game, playerId, unit, tokens);
    case "infanteria": return footman(game, playerId, unit, tokens);
    case "lancero": return lancer(game, playerId, unit, tokens);
    case "mariscal": return marshal(game, playerId, unit, tokens);
    default: {
      // Sin táctica activable (atributos I/pasivas): no hay asistente.
      return { step: { title: "Esta unidad no tiene táctica activable", options: [] } };
    }
  }
}

function posOf(tokens: readonly AbilityToken[], index: number): Position | undefined {
  const token = tokens[index];
  return token?.kind === "pos" ? token.position : undefined;
}

function ensign(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const board = game.board;
  const ally = tokens[0]?.kind === "pos" ? board.unitAt(tokens[0].position) : undefined;
  if (ally === undefined) {
    const options = alliedUnits(game, playerId, unit.position, 2)
      .filter((u) => u.type !== "alferez")
      .map((u) => posOption(u.position, unitLabel(u)));
    return { step: { title: "Alférez: unidad aliada a 1-2 que se mueve", options } };
  }
  if (tokens[1]?.kind === "pos") {
    const to = tokens[1].position;
    return { request: { ability: "ensign", ally: ally.position, to } };
  }
  const options = board
    .getNeighbors(ally.position)
    .filter((p) => {
      if (board.unitAt(p) !== undefined) return false;
      const d = distanceInHexes(board, unit.position, p);
      return d >= 1 && d <= 2;
    })
    .map((p) => posOption(p, `Mover a ${p}`));
  return { step: { title: "Alférez: destino (adyacente a la aliada, a 1-2 del Alférez)", options } };
}

function archer(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const target = posOf(tokens, 0);
  if (target !== undefined) return { request: { ability: "archer", target } };
  const options = enemiesOf(game, playerId)
    .filter((enemy) => distanceInHexes(game.board, unit.position, enemy.position) === 2)
    .map((enemy) => posOption(enemy.position, `Atacar ${unitLabel(enemy)}`));
  return { step: { title: "Arquero: blanco a EXACTAMENTE 2 casillas", options } };
}

function crossbowman(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const target = posOf(tokens, 0);
  if (target !== undefined) return { request: { ability: "crossbowman", target } };
  const options = enemiesOf(game, playerId)
    .filter((enemy) => {
      const d = distanceInHexes(game.board, unit.position, enemy.position);
      if (d < 1 || d > 2) return false;
      return hexesInStraightLine(game.board, unit.position, enemy.position).length === d - 1;
    })
    .map((enemy) => posOption(enemy.position, `Disparar a ${unitLabel(enemy)}`));
  return { step: { title: "Ballestero: enemigo en línea recta a 1-2", options } };
}

function cavalry(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const board = game.board;
  const moveTo = posOf(tokens, 0);
  if (moveTo === undefined) {
    const options = board
      .getNeighbors(unit.position)
      .filter((p) => board.unitAt(p) === undefined)
      .map((p) => posOption(p, `Cargar desde ${p}`));
    return { step: { title: "Caballería: casilla adyacente a la que carga", options } };
  }
  const attackTarget = posOf(tokens, 1);
  if (attackTarget !== undefined) {
    return { request: { ability: "cavalry", moveTo, attackTarget } };
  }
  const options = enemiesOf(game, playerId)
    .filter((enemy) => board.areAdjacent(moveTo, enemy.position) && canCharge(unit, enemy))
    .map((enemy) => posOption(enemy.position, `Atacar ${unitLabel(enemy)}`));
  return { step: { title: "Caballería: objetivo de la carga (adyacente al destino)", options } };
}

function lightCavalry(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const to = posOf(tokens, 0);
  if (to !== undefined) return { request: { ability: "light-cavalry", to } };
  const options = reachableWithin(game.board, unit.position, 2, (p) => game.board.unitAt(p) !== undefined)
    .filter((p) => p !== unit.position)
    .map((p) => posOption(p, `Mover a ${p}`));
  return { step: { title: "Caballería ligera: destino a ≤2 casillas (por casillas vacías)", options } };
}

function royalGuard(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const board = game.board;
  const to = posOf(tokens, 0);
  if (to !== undefined) return { request: { ability: "royal-guard", to } };
  const reachable = reachableWithin(board, unit.position, 2, (p) => board.unitAt(p) !== undefined);
  const options = board
    .getLocations()
    .filter((node) => node.isControlledBy(playerId) && board.unitAt(node.id) === undefined && reachable.includes(node.id))
    .map((node) => posOption(node.id, `Mover a ${node.id}`));
  return { step: { title: "Guardia Real: localización dominada libre a ≤2 (descarta la moneda Real)", options } };
}

function footman(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const board = game.board;
  const footmen = board.getUnitsByPlayer(playerId).filter((u) => u.type === "infanteria");

  // Recorre los tokens: cada Infantería resuelta consume [fm] (+ [pos] si la
  // maniobra lleva blanco) o [fm-skip]. `done` cierra la secuencia antes de
  // terminar con todas las Infanterías.
  const chosen: Extract<AbilityToken, { kind: "fm" }>[] = [];
  let index = 0;
  let fmIndex = 0;
  let stop = false;
  let awaitingTarget: Extract<AbilityToken, { kind: "fm" }> | undefined;
  while (index < tokens.length && fmIndex < footmen.length && !stop) {
    const token = tokens[index]!;
    if (token.kind === "done") { stop = true; break; }
    if (token.kind === "fm-skip") { fmIndex += 1; index += 1; continue; }
    if (token.kind === "fm") {
      if (token.act === "control") { chosen.push(token); fmIndex += 1; index += 1; continue; }
      const targetToken = tokens[index + 1];
      if (targetToken?.kind === "pos") { chosen.push({ ...token, target: targetToken.position }); fmIndex += 1; index += 2; continue; }
      awaitingTarget = token;
      break;
    }
    index += 1;
  }

  if (awaitingTarget !== undefined) {
    const footmanUnit = board.unitAt(awaitingTarget.footman)!;
    const options = awaitingTarget.act === "move"
      ? board.getNeighbors(awaitingTarget.footman).filter((p) => board.unitAt(p) === undefined).map((p) => posOption(p, `Mover a ${p}`))
      : enemiesOf(game, playerId)
          .filter((enemy) => board.areAdjacent(awaitingTarget.footman, enemy.position) && canCharge(footmanUnit, enemy))
          .map((enemy) => posOption(enemy.position, `Atacar ${unitLabel(enemy)}`));
    return { step: { title: `Infantería en ${awaitingTarget.footman}: elige el blanco`, options } };
  }

  const maneuvers: FootmanManeuver[] = chosen.map((token) => {
    if (token.act === "move" && token.target !== undefined) return { kind: "move", unitPos: token.footman, to: token.target };
    if (token.act === "attack" && token.target !== undefined) return { kind: "attack", unitPos: token.footman, target: token.target };
    return { kind: "control", unitPos: token.footman };
  });
  const completed = stop || fmIndex >= footmen.length;
  if (completed) {
    if (maneuvers.length === 0) {
      return { step: { title: "Infantería: no has elegido ninguna maniobra", options: [] } };
    }
    return { request: { ability: "footman", maneuvers } };
  }

  const pending = footmen[fmIndex]!;
  const acts: FootmanAct[] = (["move", "attack", "control"] as const).filter((act) => footmanCan(game, playerId, pending, act));
  const options: AbilityOption[] = [
    ...acts.map((act) => ({ label: `Maniobra: ${act === "move" ? "Mover" : act === "attack" ? "Atacar" : "Dominar"}`, token: { kind: "fm", footman: pending.position, act } as const })),
    ...(chosen.length > 0 ? [{ label: "Ejecutar las maniobras elegidas", token: { kind: "done" } as const }] : []),
    { label: "Omitir esta Infantería (sin maniobra)", token: { kind: "fm-skip", footman: pending.position } as const },
  ];
  return { step: { title: `Infantería en ${pending.position}: qué maniobra hace (${chosen.length}/${footmen.length} elegidas)`, options } };
}

function lancer(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const target = posOf(tokens, 0);
  if (target !== undefined) return { request: { ability: "lancer", target } };
  const options = enemiesOf(game, playerId)
    .filter((enemy) => {
      const d = distanceInHexes(game.board, unit.position, enemy.position);
      if (d < 2 || d > 3) return false;
      if (!canCharge(unit, enemy)) return false;
      const between = hexesInStraightLine(game.board, unit.position, enemy.position);
      return between.length === d - 1 && between.every((p) => game.board.unitAt(p) === undefined);
    })
    .map((enemy) => posOption(enemy.position, `Embestir a ${unitLabel(enemy)}`));
  return { step: { title: "Lancero: enemigo en línea recta a 2-3 con camino libre", options } };
}

function marshal(game: Game, playerId: PlayerId, unit: Unit, tokens: readonly AbilityToken[]): AbilityProgress {
  const board = game.board;
  const ally = tokens[0]?.kind === "pos" ? board.unitAt(tokens[0].position) : undefined;
  if (ally === undefined) {
    const options = alliedUnits(game, playerId, unit.position, 2)
      .filter((u) => !attackOnlyByAbility(u.type))
      .map((u) => posOption(u.position, `Ordenar a ${unitLabel(u)}`));
    return { step: { title: "Mariscal: unidad aliada a 1-2 que ataca", options } };
  }
  const attackTarget = posOf(tokens, 1);
  if (attackTarget !== undefined) {
    return { request: { ability: "marshal", ally: ally.position, attackTarget } };
  }
  const options = enemiesOf(game, playerId)
    .filter((enemy) => board.areAdjacent(ally.position, enemy.position))
    .map((enemy) => posOption(enemy.position, `Atacar ${unitLabel(enemy)}`));
  return { step: { title: `Mariscal: objetivo del ataque ordenado a ${unitLabel(ally)}`, options } };
}

/** Retrocede un paso en el asistente (Esc); devuelve los tokens sin el último. */
export function popAbilityToken(tokens: readonly AbilityToken[]): readonly AbilityToken[] {
  return tokens.slice(0, -1);
}

/** ¿La táctica exige elegir primero algún blanco? (para validar antes de entrar). */
export function abilityHasTargets(game: Game, playerId: PlayerId, unit: Unit): boolean {
  const progress = abilityStep(game, playerId, unit, []);
  if ("request" in progress) return true;
  return progress.step.options.length > 0;
}

/**
 * Si el paso actual del asistente solo pide BLANCOS DE CASILLA (todas las
 * opciones son posiciones), devuelve esas posiciones en orden de cursor; si
 * el paso mezcla opciones no-posicionales (Infantería: maniobra/omitir/
 * ejecutar) o no tiene blancos, devuelve `null` (se usa el menú de texto).
 * La TUI muestra el paso posicional SOBRE EL TABLERO (oscurecido + brillo +
 * cursor ← →), igual que desplegar/mover: Caballería (casilla de carga y
 * objetivo), Caballería ligera (destino ≤2), Lancero (embestida en línea
 * recta), Alférez, Arquero, Ballestero, Guardia Real, Mariscal e Infantería.
 */
export function abilityStepPositions(progress: AbilityProgress): readonly string[] | null {
  if ("request" in progress) return null;
  const options = progress.step.options;
  if (options.length === 0) return null;
  if (!options.every((option) => option.token.kind === "pos")) return null;
  return options.map((option) => (option.token as { kind: "pos"; position: string }).position);
}
