import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { configureGame } from "../domain/game-setup.ts";
import type { Player } from "../domain/player.ts";
import { Game } from "../domain/game.ts";
import { Unit } from "../domain/unit.ts";
import type { UnitType } from "../domain/units.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import { distanceInHexes, hexesInStraightLine } from "../domain/geometry.ts";
import { projectGame } from "./engine-view.ts";
import { targetPositions, ownUnitPositions } from "./targeting.ts";
import { viableActions } from "./menu-viability.ts";

async function newGame(p1: UnitType[], p2: UnitType[]): Promise<Game> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: p1, player2: p2 });
  return new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
}

/** Sustituye la mano del jugador por exactamente estas monedas (determinista). */
function setHand(player: Player, ...types: UnitType[]): void {
  drain(player);
  for (const type of types) player.hand.addUnit(type);
}

function drain(player: Player): void {
  for (const coin of player.hand.toArray()) {
    const type = (coin as { type?: UnitType }).type;
    if (typeof type === "string") player.hand.removeUnit(type);
    else player.hand.removeRoyal();
  }
}

/** Vacía la mano de `playerId` y le hace retirarse (queda en turno el rival). */
function retireToPass(game: Game, playerId: PlayerId): void {
  drain(game.player(playerId));
  expect(game.retire(playerId).success).toBe(true);
}

function rawPlace(game: Game, owner: PlayerId, type: UnitType, at: Position): Unit {
  const unit = new Unit({ type, owner, position: at });
  game.board.placeUnit(unit, at);
  return unit;
}

function firstEmptyBase(game: Game, playerId: PlayerId): Position {
  const node = game.board.getControlledLocations(playerId).find((n) => game.board.unitAt(n.id) === undefined);
  if (node === undefined) throw new Error("Sin base libre");
  return node.id;
}

function cellAt(game: Game, from: Position, distance: number, empty: boolean, pred?: (position: Position) => boolean): Position {
  const cell = game.board.getAllNodes().find((n) => {
    if (distanceInHexes(game.board, from, n.id) !== distance) return false;
    if (empty ? game.board.unitAt(n.id) !== undefined : game.board.unitAt(n.id) === undefined) return false;
    return pred === undefined || pred(n.id);
  });
  if (cell === undefined) throw new Error("No se encontró la casilla");
  return cell.id;
}

function coinIndex(view: ReturnType<typeof projectGame>, type: UnitType): number {
  return view.hand.findIndex((coin) => coin.type === type);
}

describe("TUI: mecánicas por acción", () => {
  test("desplegar: solo base propia vacía; gasta la moneda y coloca la unidad", async () => {
    const game = await newGame(["guardia-real"], ["piquero"]);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    const p1 = game.player("player1");
    setHand(p1, "guardia-real");
    const view = projectGame(game, "player1");
    const actions = viableActions(view, coinIndex(view, "guardia-real"));
    expect(actions).toContain("deploy");
    expect(actions).not.toContain("bolster"); // aún no hay unidad en el tablero
    const emptyBases = game.board.getControlledLocations("player1").filter((n) => game.board.unitAt(n.id) === undefined).map((n) => n.id);
    expect(emptyBases.length).toBeGreaterThan(0);
    const base = firstEmptyBase(game, "player1");
    const deployTargets = targetPositions(view, "player1", "deploy", undefined, "guardia-real");
    expect(deployTargets.sort()).toEqual(emptyBases.sort());
    expect(deployTargets).toContain(base);
    expect(game.deploy("player1", "guardia-real", base).success).toBe(true);
    expect(game.board.unitAt(base)?.type).toBe("guardia-real");
    expect(p1.hand.countUnit("guardia-real")).toBe(0);
    // Tras desplegar ya no se ofrece Desplegar (no hay otra base vacía donde la moneda mande),
    // pero con la unidad en el tablero y sin moneda no se ofrece nada de unidad.
    const after = projectGame(game, "player1");
    expect(viableActions(after, 0)).not.toContain("deploy");
    expect(viableActions(after, 0)).not.toContain("bolster");
  });

  test("reforzar (bolster): unidad en el tablero + moneda → +1 pila y gasta la moneda", async () => {
    const game = await newGame(["guardia-real"], ["piquero"]);
    const base = firstEmptyBase(game, "player1");
    const unit = rawPlace(game, "player1", "guardia-real", base);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    const p1 = game.player("player1");
    setHand(p1, "guardia-real");
    const view = projectGame(game, "player1");
    expect(viableActions(view, coinIndex(view, "guardia-real"))).toContain("bolster");
    const before = unit.coins;
    expect(game.bolster("player1", "guardia-real").success).toBe(true);
    expect(unit.coins).toBe(before + 1);
    expect(p1.hand.countUnit("guardia-real")).toBe(0);
    // Sin la moneda en la mano la acción ya no se ofrece (el motor la rechazaría).
    const after = projectGame(game, "player1");
    expect(viableActions(after, 0)).not.toContain("bolster");
  });

  test("arquero ataca solo con habilidad; piquero adyacente sí tiene Atacar normal", async () => {
    const game = await newGame(["arquero", "piquero"], ["piquero"]);
    const base = firstEmptyBase(game, "player1");
    rawPlace(game, "player1", "arquero", base);
    // Enemigo adyacente al Arquero (el ataque normal del Arquero NO vale)…
    const enemySpot = cellAt(game, base, 1, true, (p) => !game.board.getControlledLocations("player1").some((n) => n.id === p));
    rawPlace(game, "player2", "piquero", enemySpot);
    // …y un piquero propio junto a ese enemigo para comparar.
    const p1Spot = cellAt(game, enemySpot, 1, true, (p) => p !== base);
    rawPlace(game, "player1", "piquero", p1Spot);
    // Enemigo a 2 del Arquero (sin ser adyacente al piquero propio) para su habilidad.
    const far = cellAt(game, base, 2, true, (p) => !game.board.getNeighbors(p1Spot).includes(p));
    rawPlace(game, "player2", "piquero", far);

    game.startRound(() => 0);
    retireToPass(game, "player2");
    const p1 = game.player("player1");
    setHand(p1, "arquero", "piquero");
    const view = projectGame(game, "player1");

    const archerActions = viableActions(view, coinIndex(view, "arquero"));
    expect(archerActions).not.toContain("attack");
    expect(archerActions).toContain("ability");

    const piqueroActions = viableActions(view, coinIndex(view, "piquero"));
    expect(piqueroActions).toContain("attack");
    const piqueroPos = ownUnitPositions(view, "player1", "piquero")[0]!;
    expect(targetPositions(view, "player1", "attack", piqueroPos)).toEqual([enemySpot]);
  });

  test("reclamar iniciativa: solo sin iniciativa; descarta la moneda y el rival no puede repetir en la ronda", async () => {
    const game = await newGame(["arquero", "caballeria"], ["piquero"]);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    const p1 = game.player("player1");
    setHand(p1, "arquero");
    const view = projectGame(game, "player1");
    const index = coinIndex(view, "arquero");
    expect(viableActions(view, index)).toContain("initiative");
    expect(game.claimInitiative("player1", { kind: "unit", unitType: "arquero" }).success).toBe(true);
    expect(p1.hand.countUnit("arquero")).toBe(0);
    const after = projectGame(game, "player1");
    expect(after.initiative).toBe("player1");
    // Ya con la iniciativa (y la reclamación de esta ronda gastada) no se vuelve a ofrecer.
    setHand(p1, "arquero");
    const again = projectGame(game, "player1");
    expect(viableActions(again, coinIndex(again, "arquero"))).not.toContain("initiative");
    expect(game.claimInitiative("player1", { kind: "unit", unitType: "arquero" }).success).toBe(false);
  });

  test("reclutar: con reserva lleva la moneda boca arriba al descarte y baja la reserva", async () => {
    const game = await newGame(["guardia-real"], ["piquero"]);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    const p1 = game.player("player1");
    setHand(p1, "guardia-real");
    const view = projectGame(game, "player1");
    const before = p1.reserve.countUnit("guardia-real");
    expect(before).toBeGreaterThan(0);
    expect(viableActions(view, coinIndex(view, "guardia-real"))).toContain("recruit");
    expect(game.recruit("player1", { kind: "unit", unitType: "guardia-real" }, "guardia-real").success).toBe(true);
    expect(p1.reserve.countUnit("guardia-real")).toBe(before - 1);
    expect(p1.hand.countUnit("guardia-real")).toBe(0); // descartada boca abajo
    const after = projectGame(game, "player1");
    expect(viableActions(after, 0)).not.toContain("recruit");
  });

  test("dominio (control): colocar la última ficha declara al ganador y cierra la partida", async () => {
    const game = await newGame(["piquero"], ["piquero"]);
    // player1 ya coloca 2 fichas en sus bases al empezar; con 4 conquistas llega a 6.
    for (const neutral of ["A7", "B4", "C7", "E5"] as const) {
      expect(game.controlLocation("player1", neutral).success).toBe(true);
    }
    expect(game.winner).toBe("player1");
    const view = projectGame(game, "player1");
    expect(view.winner).toBe("player1");
    expect(view.phase).toBe("finished");
    expect(viableActions(view, 0)).toEqual([]);
  });

  test("Usar habilidad NO se ofrece sin blancos (Lancero sin línea 2-3 despejada)", async () => {
    const game = await newGame(["lancero"], ["piquero", "caballeria"]);
    const base = firstEmptyBase(game, "player1");
    rawPlace(game, "player1", "lancero", base);
    // Enemigo adyacente: NO es objetivo de embestida (exige línea recta 2-3).
    const near = cellAt(game, base, 1, true, (p) => !game.board.getControlledLocations("player1").some((n) => n.id === p));
    rawPlace(game, "player2", "piquero", near);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    setHand(game.player("player1"), "lancero");

    let view = projectGame(game, "player1");
    expect(viableActions(view, coinIndex(view, "lancero"), game)).not.toContain("ability");

    // Con un enemigo en línea recta a 2 con camino libre la habilidad SÍ aparece.
    const farNode = game.board.getAllNodes().find((n) => {
      const d = distanceInHexes(game.board, base, n.id);
      return d === 2 && game.board.unitAt(n.id) === undefined && hexesInStraightLine(game.board, base, n.id).length === 1;
    });
    expect(farNode).toBeDefined();
    rawPlace(game, "player2", "caballeria", farNode!.id);
    view = projectGame(game, "player1");
    expect(viableActions(view, coinIndex(view, "lancero"), game)).toContain("ability");
  });

  test("táctica de la Guardia Real exige la moneda Real en la mano", async () => {
    const game = await newGame(["guardia-real"], ["piquero"]);
    // Conquista una base neutral alcanzable y coloca a la Guardia Real a ≤2.
    const neutral = game.board.getLocations().find((n) => n.isNeutral() && !n.isControlledBy("player1"));
    expect(neutral).toBeDefined();
    expect(game.controlLocation("player1", neutral!.id).success).toBe(true);
    const guardSpot = cellAt(game, neutral!.id, 2, true);
    rawPlace(game, "player1", "guardia-real", guardSpot);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    const p1 = game.player("player1");
    setHand(p1, "guardia-real");

    // Sin la moneda Real la táctica no es ejecutable → no se ofrece.
    let view = projectGame(game, "player1");
    expect(viableActions(view, coinIndex(view, "guardia-real"), game)).not.toContain("ability");
    // Con la moneda Real en la mano sí.
    p1.hand.addRoyal();
    view = projectGame(game, "player1");
    expect(viableActions(view, coinIndex(view, "guardia-real"), game)).toContain("ability");
  });

  test("Atacar a un Caballero requiere atacante reforzado (2+ monedas)", async () => {
    const game = await newGame(["infanteria"], ["caballero"]);
    const base = firstEmptyBase(game, "player1");
    const attacker = rawPlace(game, "player1", "infanteria", base);
    const knightSpot = cellAt(game, base, 1, true, (p) => !game.board.getControlledLocations("player1").some((n) => n.id === p));
    rawPlace(game, "player2", "caballero", knightSpot);
    game.startRound(() => 0);
    retireToPass(game, "player2");
    setHand(game.player("player1"), "infanteria");

    let view = projectGame(game, "player1");
    const index = coinIndex(view, "infanteria");
    expect(attacker.coins).toBe(1);
    expect(viableActions(view, index, game)).not.toContain("attack");
    expect(targetPositions(view, "player1", "attack", base)).toEqual([]);

    attacker.addCoin(); // pila 2 → ya puede atacar al Caballero
    view = projectGame(game, "player1");
    expect(viableActions(view, coinIndex(view, "infanteria"), game)).toContain("attack");
    expect(targetPositions(view, "player1", "attack", base)).toEqual([knightSpot]);
  });

  test("pasar con descarte y retirarse sin monedas cierran la ronda y roban 3 de nuevo", async () => {
    const game = await newGame(["arquero", "caballeria", "infanteria"], ["piquero", "caballeria-ligera", "explorador"]);
    game.startRound(() => 0);
    // player2 (iniciativa) se retira sin monedas → la única acción ofrecida es retirarse.
    const p2 = game.player("player2");
    drain(p2);
    const p2View = projectGame(game, "player2");
    expect(viableActions(p2View, 0)).toEqual(["retire"]);
    expect(game.retire("player2").success).toBe(true);
    expect(game.currentPlayer).toBe("player1");
    // player1 pasa descartando su última moneda (mano forzada a 1).
    const p1 = game.player("player1");
    drain(p1);
    p1.hand.addUnit("arquero");
    const p1View = projectGame(game, "player1");
    const index = coinIndex(p1View, "arquero");
    expect(viableActions(p1View, index)).toContain("pass");
    expect(game.pass("player1", { kind: "unit", unitType: "arquero" }).success).toBe(true);
    expect(game.roundOver).toBe(true);
    expect(game.endRound().success).toBe(true);
    expect(game.startRound(() => 0).success).toBe(true);
    expect(game.round).toBe(2);
    expect(game.player("player1").hand.total()).toBe(3);
    expect(game.player("player2").hand.total()).toBe(3);
    expect(projectGame(game, game.currentPlayer).phase).toBe("playing");
  });
});
