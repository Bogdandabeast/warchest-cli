import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { configureGame } from "../domain/game-setup.ts";
import type { Player } from "../domain/player.ts";
import { Game } from "../domain/game.ts";
import { Unit } from "../domain/unit.ts";
import type { UnitType } from "../domain/units.ts";
import { UNIT_NAMES } from "../domain/units.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import { distanceInHexes, hexesInStraightLine } from "../domain/geometry.ts";
import { abilityStep, abilityStepPositions, popAbilityToken } from "./ability-flow.ts";
import type { AbilityProgress } from "./ability-flow.ts";
import type { AbilityToken } from "./ability-flow.ts";
import type { AbilityRequest } from "../domain/abilities.ts";
import type { AbilityStep } from "./ability-flow.ts";

async function newGame(p1: UnitType[], p2: UnitType[]): Promise<Game> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: p1, player2: p2 });
  return new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
}

function giveHand(player: Player, coins: UnitType[]): void {
  for (const type of coins) player.hand.addUnit(type);
}

function freeControlledLocation(game: Game, playerId: PlayerId): Position {
  const node = game.board.getControlledLocations(playerId).find((n) => game.board.unitAt(n.id) === undefined);
  if (node === undefined) throw new Error("Sin localizaciones controladas libres");
  return node.id;
}

function rawPlace(game: Game, owner: PlayerId, type: UnitType, at: Position): Unit {
  const unit = new Unit({ type, owner, position: at });
  game.board.placeUnit(unit, at);
  return unit;
}

function stepOf(progress: AbilityProgress): AbilityStep {
  if (!("step" in progress)) throw new Error("Se esperaba un paso del asistente");
  return progress.step;
}

function requestOf(progress: AbilityProgress): AbilityRequest {
  if (!("request" in progress)) throw new Error("Se esperaba una petición lista");
  return progress.request;
}

function cellsAt(game: Game, from: Position, distance: number, empty: boolean): Position[] {
  return game.board.getAllNodes().filter((n) => {
    if (distanceInHexes(game.board, from, n.id) !== distance) return false;
    return empty ? game.board.unitAt(n.id) === undefined : game.board.unitAt(n.id) !== undefined;
  }).map((n) => n.id);
}

/** Busca la primera casilla a `distance` de `from` que cumpla `pred`. */
function findCell(game: Game, from: Position, distance: number, pred: (position: Position) => boolean): Position {
  const cell = cellsAt(game, from, distance, true).find(pred);
  if (cell === undefined) throw new Error("No se encontró la casilla");
  return cell;
}

describe("TUI: asistente de tácticas", () => {
  test("alférez: aliado a 1-2 → destino adyacente a 1-2 del Alférez", async () => {
    const game = await newGame(["alferez", "caballeria"], ["piquero"]);
    const base = freeControlledLocation(game, "player1");
    const ensign = rawPlace(game, "player1", "alferez", base);
    const allySpot = findCell(game, base, 2, () => true);
    rawPlace(game, "player1", "caballeria", allySpot);

    const first = stepOf(abilityStep(game, "player1", ensign, []));
    expect(first.options.some((o) => o.label.includes(UNIT_NAMES.caballeria))).toBe(true);

    const second = stepOf(abilityStep(game, "player1", ensign, [{ kind: "pos", position: allySpot }]));
    expect(second.title).toContain("destino");
    expect(second.options.length).toBeGreaterThan(0);

    const dest = findCell(game, allySpot, 1, (p) => {
      const d = distanceInHexes(game.board, base, p);
      return d >= 1 && d <= 2;
    });
    const done = requestOf(abilityStep(game, "player1", ensign, [{ kind: "pos", position: allySpot }, { kind: "pos", position: dest }]));
    expect(done).toEqual({ ability: "ensign", ally: allySpot, to: dest });
  });

  test("arquero: solo blancos a EXACTAMENTE 2 casillas", async () => {
    const game = await newGame(["arquero"], ["piquero", "caballeria"]);
    const base = freeControlledLocation(game, "player1");
    const archer = rawPlace(game, "player1", "arquero", base);
    rawPlace(game, "player2", "piquero", cellsAt(game, base, 1, true)[0]!); // a 1 → no
    const far = cellsAt(game, base, 2, true)[0]!;
    rawPlace(game, "player2", "caballeria", far); // a 2 → sí

    const step = stepOf(abilityStep(game, "player1", archer, []));
    expect(step.options).toHaveLength(1);
    expect(step.options[0]!.label).toContain(UNIT_NAMES.caballeria);
    const done = requestOf(abilityStep(game, "player1", archer, [{ kind: "pos", position: far }]));
    expect(done).toEqual({ ability: "archer", target: far });
  });

  test("ballestero: enemigo en línea recta a 1-2", async () => {
    const game = await newGame(["ballestero"], ["caballeria"]);
    const base = freeControlledLocation(game, "player1");
    const crossbowman = rawPlace(game, "player1", "ballestero", base);
    const inLine = game.board.getAllNodes().find((n) => {
      const d = distanceInHexes(game.board, base, n.id);
      return d === 2 && hexesInStraightLine(game.board, base, n.id).length === 1;
    });
    expect(inLine).toBeDefined();
    rawPlace(game, "player2", "caballeria", inLine!.id);

    const step = stepOf(abilityStep(game, "player1", crossbowman, []));
    expect(step.options.length).toBeGreaterThanOrEqual(1);
    expect(step.options.some((o) => o.label.includes(UNIT_NAMES.caballeria))).toBe(true);
    expect(requestOf(abilityStep(game, "player1", crossbowman, [{ kind: "pos", position: inLine!.id }]))).toMatchObject({ ability: "crossbowman" });
  });

  test("caballería: casilla de carga y luego objetivo adyacente al destino", async () => {
    const game = await newGame(["caballeria"], ["piquero"]);
    const base = freeControlledLocation(game, "player1");
    const cavalry = rawPlace(game, "player1", "caballeria", base);
    const moveTo = cellsAt(game, base, 1, true)[0]!;
    const targetSpot = cellsAt(game, moveTo, 1, true).find((p) => p !== base)!;
    rawPlace(game, "player2", "piquero", targetSpot);

    const first = stepOf(abilityStep(game, "player1", cavalry, []));
    expect(first.options.some((o) => o.label.includes(moveTo))).toBe(true);

    const second = stepOf(abilityStep(game, "player1", cavalry, [{ kind: "pos", position: moveTo }]));
    expect(second.options.some((o) => o.label.includes(UNIT_NAMES.piquero))).toBe(true);

    const done = requestOf(abilityStep(game, "player1", cavalry, [{ kind: "pos", position: moveTo }, { kind: "pos", position: targetSpot }]));
    expect(done).toEqual({ ability: "cavalry", moveTo, attackTarget: targetSpot });
  });

  test("caballería ligera: destino a ≤2 por casillas vacías", async () => {
    const game = await newGame(["caballeria-ligera"], ["piquero"]);
    const base = freeControlledLocation(game, "player1");
    const unit = rawPlace(game, "player1", "caballeria-ligera", base);
    const step = stepOf(abilityStep(game, "player1", unit, []));
    expect(step.options.length).toBeGreaterThan(0);
    const to = requestOf(abilityStep(game, "player1", unit, [step.options[0]!.token]));
    expect(to).toMatchObject({ ability: "light-cavalry" });
  });

  test("guardia real: solo localizaciones propias dominadas y libres a ≤2", async () => {
    const game = await newGame(["guardia-real"], ["piquero"]);
    // Conquista una base neutral para el jugador 1 y coloca a la Guardia Real
    // a ≤2 de ella (la táctica solo admite localizaciones propias dominadas).
    const neutral = game.board.getLocations().find((n) => n.isNeutral() && !n.isControlledBy("player1"));
    expect(neutral).toBeDefined();
    expect(game.controlLocation("player1", neutral!.id).success).toBe(true);
    const guardSpot = findCell(game, neutral!.id, 2, () => true);
    const guard = rawPlace(game, "player1", "guardia-real", guardSpot);
    const step = stepOf(abilityStep(game, "player1", guard, []));
    expect(step.options.length).toBeGreaterThan(0);
    const ids = step.options.map((o) => (o.token.kind === "pos" ? o.token.position : ""));
    expect(ids).toContain(neutral!.id);
    for (const option of step.options) {
      const position = option.token.kind === "pos" ? option.token.position : undefined;
      const node = game.board.getNode(position ?? "");
      expect(node?.isControlledBy("player1")).toBe(true);
      expect(game.board.unitAt(node!.id)).toBeUndefined();
    }
  });

  test("infantería: maniobras por Infantería; los saltos no entran en la petición", async () => {
    const game = await newGame(["infanteria"], ["piquero"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const otherBase = game.board.getControlledLocations("player1").find((n) => n.id !== base && game.board.unitAt(n.id) === undefined);
    expect(otherBase).toBeDefined();
    const footmanA = rawPlace(game, "player1", "infanteria", base);
    const footmanB = rawPlace(game, "player1", "infanteria", otherBase!.id);
    const enemySpot = cellsAt(game, base, 1, true).find((p) => !game.board.getControlledLocations("player1").some((n) => n.id === p))!;
    rawPlace(game, "player2", "piquero", enemySpot);
    giveHand(p1, ["infanteria"]);

    const first = stepOf(abilityStep(game, "player1", footmanA, []));
    const attack = first.options.find((o) => o.label === "Maniobra: Atacar");
    expect(attack).toBeDefined();
    const targetStep = stepOf(abilityStep(game, "player1", footmanA, [attack!.token]));
    const target = targetStep.options.find((o) => o.label.includes(UNIT_NAMES.piquero));
    expect(target).toBeDefined();
    expect(targetStep.options.length).toBeGreaterThan(0);
    const tokens: AbilityToken[] = [attack!.token, target!.token];

    const second = stepOf(abilityStep(game, "player1", footmanA, tokens));
    const skip = second.options.find((o) => o.label.startsWith("Omitir"));
    expect(skip).toBeDefined();

    // Al omitir la segunda Infantería la secuencia queda completa → petición
    // directa con SOLO la maniobra elegida (el salto no entra).
    const afterSkip = requestOf(abilityStep(game, "player1", footmanA, [...tokens, skip!.token]));
    expect(afterSkip).toMatchObject({ ability: "footman" });
    if ("maneuvers" in afterSkip) {
      expect(afterSkip.maneuvers).toHaveLength(1);
      expect(afterSkip.maneuvers[0]).toMatchObject({ kind: "attack", unitPos: base });
    }
    expect(footmanA.position).toBe(base);
    expect(footmanB.position).toBe(otherBase!.id);
  });

  test("lancero: embestida en línea recta a 2-3 con camino libre", async () => {
    const game = await newGame(["lancero"], ["piquero", "caballeria"]);
    const base = freeControlledLocation(game, "player1");
    const lancer = rawPlace(game, "player1", "lancero", base);
    const targetSpot = game.board.getAllNodes().find((n) => {
      const d = distanceInHexes(game.board, base, n.id);
      return d === 2 && hexesInStraightLine(game.board, base, n.id).length === 1;
    })!.id;
    rawPlace(game, "player2", "piquero", targetSpot);
    // Enemigo detrás del mismo objetivo: camino bloqueado → no se ofrece.
    const behind = game.board.getAllNodes().find((n) => {
      const d = distanceInHexes(game.board, base, n.id);
      return d === 3 && hexesInStraightLine(game.board, base, n.id).length === 2 && hexesInStraightLine(game.board, base, n.id).includes(targetSpot);
    });
    if (behind !== undefined) rawPlace(game, "player2", "caballeria", behind.id);

    const step = stepOf(abilityStep(game, "player1", lancer, []));
    const labels = step.options.map((o) => o.label);
    expect(labels.length).toBeGreaterThanOrEqual(1);
    expect(labels.join()).toContain(UNIT_NAMES.piquero);
    if (behind !== undefined) expect(labels.join()).not.toContain(UNIT_NAMES.caballeria);
  });

  test("lancero: no ofrece embestir a un Caballero si el Lancero no está reforzado", async () => {
    const game = await newGame(["lancero"], ["caballero"]);
    const base = freeControlledLocation(game, "player1");
    const lancer = rawPlace(game, "player1", "lancero", base);
    const targetSpot = game.board.getAllNodes().find((n) => {
      const d = distanceInHexes(game.board, base, n.id);
      return d === 2 && hexesInStraightLine(game.board, base, n.id).length === 1;
    })!.id;
    rawPlace(game, "player2", "caballero", targetSpot);

    // Lancero sin reforzar (1 moneda): el Caballero NO se ofrece (el motor lo
    // rechazaría igualmente) → la habilidad no parece ejecutable.
    const blocked = stepOf(abilityStep(game, "player1", lancer, []));
    expect(blocked.options).toHaveLength(0);

    // Reforzado (2+ monedas): la embestida al Caballero SÍ es un blanco válido.
    lancer.addCoin();
    const step = stepOf(abilityStep(game, "player1", lancer, []));
    expect(step.options.some((o) => o.token.kind === "pos" && o.token.position === targetSpot)).toBe(true);
  });

  test("mariscal: aliado a 1-2 y objetivo adyacente a la aliada", async () => {
    const game = await newGame(["mariscal", "piquero"], ["caballeria"]);
    const base = freeControlledLocation(game, "player1");
    const marshal = rawPlace(game, "player1", "mariscal", base);
    const allySpot = findCell(game, base, 2, () => true);
    rawPlace(game, "player1", "piquero", allySpot);
    const targetSpot = findCell(game, allySpot, 1, (p) => p !== base);
    rawPlace(game, "player2", "caballeria", targetSpot);

    const first = stepOf(abilityStep(game, "player1", marshal, []));
    expect(first.options.some((o) => o.label.includes(UNIT_NAMES.piquero))).toBe(true);
    const second = stepOf(abilityStep(game, "player1", marshal, [{ kind: "pos", position: allySpot }]));
    expect(second.options.some((o) => o.label.includes(UNIT_NAMES.caballeria))).toBe(true);
    const done = requestOf(abilityStep(game, "player1", marshal, [{ kind: "pos", position: allySpot }, { kind: "pos", position: targetSpot }]));
    expect(done).toEqual({ ability: "marshal", ally: allySpot, attackTarget: targetSpot });
  });

  test("popAbilityToken retrocede un paso; unidades pasivas sin asistente", async () => {
    const game = await newGame(["arquero", "piquero"], ["piquero"]);
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "arquero", base);
    const far = cellsAt(game, base, 2, true)[0]!;
    const tokens: AbilityToken[] = [{ kind: "pos", position: far }];
    expect(popAbilityToken(tokens)).toEqual([]);
    const idle = rawPlace(game, "player1", "piquero", cellsAt(game, base, 1, true)[0]!);
    const passive = abilityStep(game, "player1", idle, []);
    expect("step" in passive && passive.step.options.length === 0).toBe(true);
  });

  test("abilityStepPositions: los pasos de casillas se eligen SOBRE EL TABLERO", async () => {
    // Caballería ligera: el primer paso son destinos (todas opciones pos).
    const game = await newGame(["caballeria-ligera", "lancero", "infanteria"], ["piquero", "caballeria"]);
    const base = freeControlledLocation(game, "player1");
    const light = rawPlace(game, "player1", "caballeria-ligera", base);
    const positions = abilityStepPositions(abilityStep(game, "player1", light, []));
    expect(positions).not.toBeNull();
    expect(positions!.length).toBeGreaterThan(0);
    for (const position of positions!) {
      expect(game.board.getNode(position)).toBeDefined();
      expect(game.board.unitAt(position)).toBeUndefined();
    }

    // Lancero: los blancos en línea recta también son posiciones.
    const lancer = rawPlace(game, "player1", "lancero", cellsAt(game, base, 1, true)[0]!);
    const enemySpot = game.board.getAllNodes().find((n) => {
      const d = distanceInHexes(game.board, lancer.position, n.id);
      return d === 2 && hexesInStraightLine(game.board, lancer.position, n.id).length === 1;
    })!;
    rawPlace(game, "player2", "caballeria", enemySpot.id);
    const lancerPositions = abilityStepPositions(abilityStep(game, "player1", lancer, []));
    expect(lancerPositions).not.toBeNull();
    expect(lancerPositions).toContain(enemySpot.id);

    // Infantería: el paso de "qué maniobra" mezcla opciones no-posicionales
    // (Maniobra/Omitir/Ejecutar) → NO es selección de tablero.
    const footman = rawPlace(game, "player1", "infanteria", cellsAt(game, base, 1, true).find((p) => p !== lancer.position)!);
    const footmanStep = abilityStep(game, "player1", footman, []);
    expect("step" in footmanStep && footmanStep.step.options.length).toBeGreaterThan(0);
    expect(abilityStepPositions(footmanStep)).toBeNull();

    // Progreso ya completo (request) → no es una selección pendiente.
    const done = abilityStep(game, "player1", light, [{ kind: "pos", position: positions![0]! }]);
    expect("request" in done).toBe(true);
    expect(abilityStepPositions(done)).toBeNull();
  });
});
