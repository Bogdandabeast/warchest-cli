import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import type { Board } from "./board.ts";
import { configureGame } from "./game-setup.ts";
import type { Player } from "./player.ts";
import type { UnitType } from "./units.ts";
import { Game } from "./game.ts";
import type { PlayerId, Position } from "./types.ts";

/** Configura una partida sobre el tablero real con las cartas dadas. */
async function newGame(p1: UnitType[], p2: UnitType[]): Promise<{ game: Game; board: Board }> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: p1, player2: p2 });
  const game = new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
  return { game, board };
}

/** Rellena la mano del jugador con monedas (para poder actuar en tests). */
function giveHand(player: Player, coins: UnitType[], royal = 0): void {
  for (const type of coins) player.hand.addUnit(type);
  for (let i = 0; i < royal; i++) player.hand.addRoyal();
}

/** Primera localización libre y controlada del jugador (para desplegar). */
function freeControlledLocation(game: Game, playerId: PlayerId): Position {
  for (const node of game.board.getControlledLocations(playerId)) {
    if (game.board.unitAt(node.id) === undefined) return node.id;
  }
  throw new Error("Sin localizaciones controladas libres");
}

/**
 * Despliega una unidad en la primera localización controlada libre del
 * jugador. Da antes la moneda del tipo a la mano (desplegar la gasta) y
 * devuelve la posición.
 */
function deployOwn(game: Game, playerId: PlayerId, type: UnitType): Position {
  const position = freeControlledLocation(game, playerId);
  giveHand(game.player(playerId), [type]);
  const result = game.deploy(playerId, type, position);
  if (!result.success) throw new Error(`No se pudo desplegar ${type}: ${result.message}`);
  return position;
}

/** Casilla adyacente vacía a `from`. */
function freeAdjacent(game: Game, from: Position): Position {
  for (const neighbor of game.board.getNeighbors(from)) {
    if (game.board.unitAt(neighbor) === undefined) return neighbor;
  }
  throw new Error("Sin vecinos libres");
}

describe("Desplegar y Reforzar", () => {
  test("despliega en una localización controlada, gastando la moneda", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    const target = deployOwn(game, "player1", "arquero");
    expect(game.board.findUnit("player1", "arquero")?.position).toBe(target);
    expect(p1.hand.countUnit("arquero")).toBe(0);
  });

  test("rechaza desplegar en casilla no controlada, no localización u ocupada", async () => {
    const { game, board } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    giveHand(p1, ["arquero", "arquero"]);

    // Casilla normal (no localización) → error.
    const normal = board.getAllNodes().find((n) => n.terrain === "normal")!;
    expect(game.deploy("player1", "arquero", normal.id).success).toBe(false);

    // Base del rival (no controlada) → error.
    const enemyBase = game.board.getStartLocations("player2")[0]!;
    expect(game.deploy("player1", "arquero", enemyBase).success).toBe(false);

    // Despliegue correcto y luego otra unidad del mismo tipo → error.
    const own = freeControlledLocation(game, "player1");
    expect(game.deploy("player1", "arquero", own).success).toBe(true);
    expect(game.deploy("player1", "arquero", own).success).toBe(false);
  });

  test("la Infantería puede desplegar 2 unidades; el resto solo 1", async () => {
    const { game, board } = await newGame(["infanteria", "caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    giveHand(p1, ["infanteria", "infanteria", "caballeria", "caballeria"]);

    const own = game.board.getControlledLocations("player1");
    expect(game.deploy("player1", "infanteria", own[0]!.id).success).toBe(true);
    const otherBase = board.getStartLocations("player2")[0]!; // no controlada → falla
    expect(game.deploy("player1", "infanteria", otherBase).success).toBe(false);
    const free2 = game.board.getControlledLocations("player1").find((n) => game.board.unitAt(n.id) === undefined)!;
    expect(game.deploy("player1", "infanteria", free2.id).success).toBe(true);
    expect(game.board.getUnitsByPlayer("player1").filter((u) => u.type === "infanteria")).toHaveLength(2);

    // La caballería no puede desplegar 2. Liberar un hueco y dar una tercera
    // localización controlada para intentar la segunda caballería.
    game.board.removeUnit(game.board.getUnitsByPlayer("player1").filter((u) => u.type === "infanteria")[0]!);
    const free3 = game.board.getControlledLocations("player1").find((n) => game.board.unitAt(n.id) === undefined)!;
    expect(game.deploy("player1", "caballeria", free3.id).success).toBe(true);
    const extra = board.getLocations().find((n) => n.isNeutral())!;
    game.board.placeControlMarker(extra.id, "player1");
    const free4 = game.board.getControlledLocations("player1").find((n) => game.board.unitAt(n.id) === undefined)!;
    expect(free4).toBeDefined();
    expect(game.deploy("player1", "caballeria", free4.id).success).toBe(false);
  });

  test("refuerza apilando y exige moneda y unidad", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    expect(game.board.findUnit("player1", "arquero")).toBeUndefined();

    // Sin unidad → error.
    giveHand(p1, ["arquero"]);
    expect(game.bolster("player1", "arquero").success).toBe(false);

    // Desplegar y reforzar.
    deployOwn(game, "player1", "arquero");
    expect(game.bolster("player1", "arquero").success).toBe(true);
    expect(game.board.findUnit("player1", "arquero")!.coins).toBe(2);
    expect(game.board.findUnit("player1", "arquero")!.isReinforced()).toBe(true);
    // Sin moneda ya → falla.
    expect(game.bolster("player1", "arquero").success).toBe(false);
  });
});

describe("Mover", () => {
  test("mueve 1 casilla adyacente descartando la moneda boca arriba", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    const start = deployOwn(game, "player1", "arquero");
    giveHand(p1, ["arquero"]);

    const to = freeAdjacent(game, start);
    const result = game.executeManeuver("player1", { kind: "move", unitType: "arquero", to });
    expect(result.success).toBe(true);
    expect(game.board.findUnit("player1", "arquero")!.position).toBe(to);
    expect(p1.hand.countUnit("arquero")).toBe(0);
    expect(p1.discard.countUnit("arquero")).toBe(1);
  });

  test("rechaza saltar 2 casillas, sin gastar moneda en fallos", async () => {
    const { game } = await newGame(["arquero"], ["caballeria"]);
    const p1 = game.player("player1");
    const start = deployOwn(game, "player1", "arquero");
    giveHand(p1, ["arquero", "arquero"]);

    // Salto de 2: coger un vecino del vecino que no sea adyacente.
    const twoAway = game.board
      .getAllNodes()
      .map((n) => n.id)
      .find(
        (pos) =>
          pos !== start
          && !game.board.areAdjacent(start, pos)
          && game.board.getNeighbors(pos).some((n) => game.board.areAdjacent(start, n)),
      )!;
    expect(game.executeManeuver("player1", { kind: "move", unitType: "arquero", to: twoAway }).success).toBe(false);
    expect(p1.hand.countUnit("arquero")).toBe(2); // no se gastó en el fallo
  });
});

describe("Atacar", () => {
  test("elimina la moneda de arriba de la pila enemiga adyacente (sale del juego)", async () => {
    const { game } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const p2 = game.player("player2");
    const p1Base = deployOwn(game, "player1", "caballeria");
    deployOwn(game, "player2", "piquero");
    const attacker = game.board.findUnit("player1", "caballeria")!;
    const target = game.board.findUnit("player2", "piquero")!;

    // Poner al piquero adyacente al atacante.
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(target, adjacent);
    giveHand(p1, ["caballeria"]);

    const result = game.executeManeuver("player1", { kind: "attack", unitType: "caballeria", target: target.position });
    expect(result.success).toBe(true);
    // Piquero sin reforzar muere; la moneda sale del juego (no vuelve a reserva/descarte).
    expect(game.board.findUnit("player2", "piquero")).toBeUndefined();
    expect(p2.reserve.countUnit("piquero")).toBe(2); // solo quedan las de reserva iniciales
    expect(result.events.some((e) => e.type === "unit-destroyed")).toBe(true);
  });

  test("rechaza atacar sin adyacencia, a aliados o sin moneda", async () => {
    const { game } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const p1Base = deployOwn(game, "player1", "caballeria");
    const attacker = game.board.findUnit("player1", "caballeria")!;
    const far = game.board.getAllNodes().find((n) => !game.board.areAdjacent(attacker.position, n.id))!.id;

    giveHand(p1, ["caballeria"]);
    expect(game.executeManeuver("player1", { kind: "attack", unitType: "caballeria", target: far }).success).toBe(false);
    expect(game.executeManeuver("player1", { kind: "attack", unitType: "caballeria", target: p1Base }).success).toBe(false); // propia

    // El fallo no gastó la moneda.
    expect(p1.hand.countUnit("caballeria")).toBe(1);
  });

  test("el Arquero no puede atacar con la acción normal (X)", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    const p1Base = deployOwn(game, "player1", "arquero");
    deployOwn(game, "player2", "piquero");
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(game.board.findUnit("player2", "piquero")!, adjacent);
    giveHand(p1, ["arquero"]);

    const result = game.executeManeuver("player1", { kind: "attack", unitType: "arquero", target: adjacent });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/solo puede atacar con su habilidad/);
  });

  test("el Caballero solo es atacable por unidades reforzadas", async () => {
    const { game } = await newGame(["caballeria"], ["caballero"]);
    const p1 = game.player("player1");
    const p1Base = deployOwn(game, "player1", "caballeria");
    deployOwn(game, "player2", "caballero");
    const knight = game.board.findUnit("player2", "caballero")!;
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(knight, adjacent);

    // Atacante sin reforzar → rechazado.
    giveHand(p1, ["caballeria"]);
    expect(game.executeManeuver("player1", { kind: "attack", unitType: "caballeria", target: knight.position }).success).toBe(false);
    expect(p1.hand.countUnit("caballeria")).toBe(1); // sin gastar

    // Reforzar al atacante y atacar → permitido.
    game.board.findUnit("player1", "caballeria")!.addCoin();
    expect(game.board.findUnit("player1", "caballeria")!.isReinforced()).toBe(true);
    const attack = game.executeManeuver("player1", { kind: "attack", unitType: "caballeria", target: knight.position });
    expect(attack.success).toBe(true);
  });

  test("el Piquero elimina una moneda del atacante adyacente al ser atacado", async () => {
    const { game } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const p1Base = deployOwn(game, "player1", "caballeria");
    deployOwn(game, "player2", "piquero");
    const piquero = game.board.findUnit("player2", "piquero")!;
    const caballeria = game.board.findUnit("player1", "caballeria")!;
    caballeria.addCoin(); // reforzada para sobrevivir al contraataque
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(piquero, adjacent);
    giveHand(p1, ["caballeria"]);

    const result = game.executeManeuver("player1", { kind: "attack", unitType: "caballeria", target: piquero.position });
    expect(result.success).toBe(true);
    // Ambos pierden su moneda de arriba.
    expect(game.board.findUnit("player2", "piquero")).toBeUndefined();
    expect(game.board.findUnit("player1", "caballeria")!.coins).toBe(1);
  });

  test("la Guardia Real puede perder una moneda de reserva en lugar de la del tablero", async () => {
    const { game } = await newGame(["caballeria"], ["guardia-real"]);
    const p1 = game.player("player1");
    const p2 = game.player("player2");
    const p1Base = deployOwn(game, "player1", "caballeria");
    deployOwn(game, "player2", "guardia-real");
    const royal = game.board.findUnit("player2", "guardia-real")!;
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(royal, adjacent);
    giveHand(p1, ["caballeria"]);

    const result = game.executeManeuver("player1", {
      kind: "attack",
      unitType: "caballeria",
      target: royal.position,
      royalGuardFromReserve: true,
    });
    expect(result.success).toBe(true);
    // La pila del tablero sigue intacta y la reserva pierde una moneda
    // (total 5 − 2 de la bolsa inicial − 1 reserva = 2).
    expect(game.board.findUnit("player2", "guardia-real")!.coins).toBe(1);
    expect(p2.reserve.countUnit("guardia-real")).toBe(2);
  });
});

describe("Dominar", () => {
  test("controla una base neutral/enemiga y no la propia", async () => {
    const { game, board } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const neutralBase = board.getLocations().find((n) => n.isNeutral())!.id;
    const p1Base = deployOwn(game, "player1", "caballeria");
    giveHand(p1, ["caballeria", "caballeria"]);

    // Ya controla su base → error.
    expect(game.executeManeuver("player1", { kind: "control", unitType: "caballeria" }).success).toBe(false);

    // Mover a la base neutral y dominarla.
    game.board.moveUnit(game.board.findUnit("player1", "caballeria")!, neutralBase);
    const control = game.executeManeuver("player1", { kind: "control", unitType: "caballeria" });
    expect(control.success).toBe(true);
    expect(board.getNode(neutralBase)!.isControlledBy("player1")).toBe(true);
    expect(game.countPlacedMarkers("player1")).toBe(3);
  });
});

describe("Descarte boca abajo", () => {
  test("reclamar iniciativa descarta y transfiere (una vez por ronda)", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    expect(game.initiative).toBe("player2");
    giveHand(p1, ["arquero"]);

    const result = game.claimInitiative("player1", { kind: "unit", unitType: "arquero" });
    expect(result.success).toBe(true);
    expect(game.initiative).toBe("player1");
    expect(p1.hand.countUnit("arquero")).toBe(0);

    // Segundo intento en la misma ronda → error.
    giveHand(game.player("player2"), ["piquero"]);
    expect(game.claimInitiative("player2", { kind: "unit", unitType: "piquero" }).success).toBe(false);
  });

  test("reclutar lleva moneda de la reserva al descarte", async () => {
    const { game } = await newGame(["arquero", "piquero"], ["caballeria"]);
    const p1 = game.player("player1");
    giveHand(p1, ["caballeria"]);
    const reserveBefore = p1.reserve.countUnit("piquero");
    const result = game.recruit("player1", { kind: "unit", unitType: "caballeria" }, "piquero");
    expect(result.success).toBe(true);
    expect(p1.reserve.countUnit("piquero")).toBe(reserveBefore - 1);
    expect(p1.discard.countUnit("piquero")).toBe(1);
    expect(p1.discard.countUnit("caballeria")).toBe(1);
  });

  test("pasar descarta la moneda real", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    giveHand(p1, [], 1);
    const result = game.pass("player1", { kind: "royal" });
    expect(result.success).toBe(true);
    expect(p1.hand.hasRoyal()).toBe(false);
    expect(p1.discard.hasRoyal()).toBe(true);
  });
});

describe("Rondas (flujo de turnos)", () => {
  test("startRound roba 3 monedas a cada jugador y fija el orden por iniciativa", async () => {
    const { game } = await newGame(["arquero", "piquero"], ["caballeria"]);
    const p1 = game.player("player1");
    const p2 = game.player("player2");
    expect(game.round).toBe(1);
    expect(game.phase).toBe("setup");

    const start = game.startRound(() => 0);
    expect(start.success).toBe(true);
    expect(start.events.filter((e) => e.type === "drawn")).toHaveLength(2);
    expect(p1.hand.total()).toBe(3);
    expect(p2.hand.total()).toBe(3);
    expect(game.phase).toBe("playing");
    expect(game.currentPlayer).toBe("player2"); // iniciativa del segundo en elegir
    expect(game.passed.player1).toBe(false);
    expect(game.passed.player2).toBe(false);
  });

  test("pasar excluye al jugador de la ronda; con ambos pasando termina la ronda", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    const p1 = game.player("player1");
    const p2 = game.player("player2");
    game.startRound(() => 0);
    expect(game.currentPlayer).toBe("player2");

    // player2 pasa descartando una de sus monedas boca abajo.
    const passP2 = game.pass("player2", { kind: "unit", unitType: "piquero" });
    expect(passP2.success).toBe(true);
    expect(game.passed.player2).toBe(true);
    expect(p2.hand.countUnit("piquero")).toBe(1);
    expect(game.roundOver).toBe(false); // falta player1

    // player1 pasa → ronda terminada.
    const passP1 = game.pass("player1", { kind: "unit", unitType: "arquero" });
    expect(passP1.success).toBe(true);
    expect(game.passed.player1).toBe(true);
    expect(game.roundOver).toBe(true);

    // FinRondaFase: descarta las manos y sube de ronda al empezar la siguiente.
    expect(p1.hand.total()).toBe(2); // antes del fin de ronda
    const end = game.endRound();
    expect(end.success).toBe(true);
    expect(game.phase).toBe("round-over");
    expect(p1.hand.total()).toBe(0);

    const again = game.startRound(() => 0);
    expect(again.success).toBe(true);
    expect(game.round).toBe(2);
    expect(game.currentPlayer).toBe("player2");
    // La bolsa se rellenó barajando descartes: vuelve a robar 3.
    expect(p1.hand.total()).toBe(3);
    expect(game.roundOver).toBe(false);
  });

  test("un jugador sin monedas en mano solo puede retirarse (pase sin descarte)", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    game.startRound(() => 0);
    const p1 = game.player("player1");
    const p2 = game.player("player2");

    // Vaciar la mano de player2 (no puede pasar descartando).
    p2.discardHand();
    expect(p2.hand.total()).toBe(0);
    expect(game.pass("player2", { kind: "royal" }).success).toBe(false); // sin moneda
    const retired = game.retire("player2");
    expect(retired.success).toBe(true);
    expect(game.passed.player2).toBe(true);
    expect(game.currentPlayer).toBe("player1");

    // Con monedas en mano, retire se rechaza (debe usar Pasar).
    expect(game.retire("player1").success).toBe(false);
    expect(game.pass("player1", { kind: "unit", unitType: "arquero" }).success).toBe(true);
    expect(game.roundOver).toBe(true);
    expect(game.player("player1").hand.total()).toBe(2);
  });

  test("reclamar la iniciativa se aplica en la siguiente ronda", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    game.startRound(() => 0);
    expect(game.currentPlayer).toBe("player2");

    // player1 (sin iniciativa) reclama descartando una moneda.
    const p1 = game.player("player1");
    expect(game.claimInitiative("player1", { kind: "unit", unitType: "arquero" }).success).toBe(true);
    expect(game.initiative).toBe("player1");

    // Terminar la ronda y comprobar que la nueva ronda la empieza player1.
    expect(game.pass("player2", { kind: "unit", unitType: "piquero" }).success).toBe(true);
    expect(game.pass("player1", { kind: "unit", unitType: "arquero" }).success).toBe(true);
    expect(game.endRound().success).toBe(true);
    expect(game.startRound(() => 0).success).toBe(true);
    expect(game.round).toBe(2);
    expect(game.currentPlayer).toBe("player1");
    expect(p1.hand.total()).toBe(3);
  });

  test("no se puede empezar una ronda durante otra ni con partida ganada", async () => {
    const { game } = await newGame(["arquero"], ["piquero"]);
    game.startRound(() => 0);
    expect(game.startRound(() => 0).success).toBe(false); // ya en curso
    expect(game.endRound().success).toBe(false); // nadie ha pasado

    // Marcar ganador y comprobar que startRound/endRound se bloquean.
    game.winner = "player1";
    game.phase = "finished";
    expect(game.startRound(() => 0).success).toBe(false);
    expect(game.endRound().success).toBe(false);
  });
});

describe("Maniobras gratis (atributos I)", () => {
  test("Espadachín: tras atacar puede moverse gratis, sin descartar otra moneda", async () => {
    const { game } = await newGame(["espadachin"], ["piquero"]);
    const p1 = game.player("player1");
    const p1Base = deployOwn(game, "player1", "espadachin");
    deployOwn(game, "player2", "piquero");

    const espadachin = game.board.findUnit("player1", "espadachin")!;
    espadachin.addCoin(); // reforzado: sobrevive al contraataque del Piquero
    const piquero = game.board.findUnit("player2", "piquero")!;
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(piquero, adjacent);
    giveHand(p1, ["espadachin", "espadachin"]);

    // Atacar gasta UNA moneda y concede el movimiento gratis.
    const attack = game.executeManeuver("player1", { kind: "attack", unitType: "espadachin", target: piquero.position });
    expect(attack.success).toBe(true);
    expect(p1.hand.countUnit("espadachin")).toBe(1); // solo se gastó la del ataque
    expect(attack.events.some((e) => e.type === "free-maneuver")).toBe(true);

    // Mover gratis: con 1 moneda aún en mano, el movimiento no la consume.
    const to = freeAdjacent(game, espadachin.position);
    const freeMove = game.executeFreeManeuver("player1", { kind: "move", unitType: "espadachin", to });
    expect(freeMove.success).toBe(true);
    expect(espadachin.position).toBe(to);
    expect(p1.hand.countUnit("espadachin")).toBe(1); // la moneda sigue en la mano
    expect(game.pendingFreeManeuvers).toHaveLength(0);

    // Sin concesión pendiente → falla.
    const another = freeAdjacent(game, espadachin.position);
    expect(game.executeFreeManeuver("player1", { kind: "move", unitType: "espadachin", to: another }).success).toBe(false);
  });

  test("Mercenario: reclutar su moneda da una maniobra gratis al Mercenario en el tablero", async () => {
    const { game } = await newGame(["mercenario", "arquero"], ["piquero"]);
    const p1 = game.player("player1");
    deployOwn(game, "player1", "mercenario");
    const mercenario = game.board.findUnit("player1", "mercenario")!;

    // Pagar con una moneda (cualquiera) con descarte boca abajo.
    giveHand(p1, ["arquero"]);
    const reserveBefore = p1.reserve.countUnit("mercenario");
    const result = game.recruit("player1", { kind: "unit", unitType: "arquero" }, "mercenario");
    expect(result.success).toBe(true);
    // La moneda reclutada va boca arriba al descarte (como cualquier recluta).
    expect(p1.reserve.countUnit("mercenario")).toBe(reserveBefore - 1);
    expect(p1.discard.countUnit("mercenario")).toBe(1);
    expect(p1.discard.countUnit("arquero")).toBe(1);
    expect(result.events.some((e) => e.type === "free-maneuver")).toBe(true);
    expect(game.pendingFreeManeuvers).toHaveLength(1);

    // Maniobra gratis: mover el Mercenario sin gastar moneda (ya no hay en mano).
    const dest = freeAdjacent(game, mercenario.position);
    const freeManeuver = game.executeFreeManeuver("player1", { kind: "move", unitType: "mercenario", to: dest });
    expect(freeManeuver.success).toBe(true);
    expect(mercenario.position).toBe(dest);
    expect(game.pendingFreeManeuvers).toHaveLength(0);
  });

  test("reclutar Mercenario sin unidad en el tablero no concede maniobra", async () => {
    const { game } = await newGame(["mercenario", "arquero"], ["piquero"]);
    const p1 = game.player("player1");
    giveHand(p1, ["arquero"]);
    const result = game.recruit("player1", { kind: "unit", unitType: "arquero" }, "mercenario");
    expect(result.success).toBe(true);
    expect(game.pendingFreeManeuvers).toHaveLength(0);
  });
});

describe("Clérigo (I) y Guerrero (I)", () => {
  test("Clérigo: tras atacar roba 1 moneda de su bolsa a la mano", async () => {
    const { game } = await newGame(["clerigo"], ["piquero"]);
    const p1 = game.player("player1");
    const p1Base = deployOwn(game, "player1", "clerigo");
    game.board.findUnit("player1", "clerigo")!.addCoin(); // sobrevive al Piquero
    deployOwn(game, "player2", "piquero");
    const clerigo = game.board.findUnit("player1", "clerigo")!;
    const piquero = game.board.findUnit("player2", "piquero")!;
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(piquero, adjacent);

    const bagBefore = p1.bag.total();
    giveHand(p1, ["clerigo"]);
    const result = game.executeManeuver("player1", { kind: "attack", unitType: "clerigo", target: piquero.position });
    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === "drawn")).toBe(true);
    // La moneda de la mano se gastó en el ataque y entra 1 robada de la bolsa.
    expect(p1.hand.total()).toBe(1);
    expect(p1.bag.total()).toBe(bagBefore - 1);
  });

  test("Clérigo: tras dominar roba 1 moneda de su bolsa", async () => {
    const { game, board } = await newGame(["clerigo"], ["piquero"]);
    const p1 = game.player("player1");
    deployOwn(game, "player1", "clerigo");
    const clerigo = game.board.findUnit("player1", "clerigo")!;
    const neutralBase = board.getLocations().find((n) => n.isNeutral())!.id;
    game.board.moveUnit(clerigo, neutralBase);

    const bagBefore = p1.bag.total();
    giveHand(p1, ["clerigo"]);
    const result = game.executeManeuver("player1", { kind: "control", unitType: "clerigo" });
    expect(result.success).toBe(true);
    expect(result.events.some((e) => e.type === "drawn")).toBe(true);
    expect(board.getNode(neutralBase)!.isControlledBy("player1")).toBe(true);
    expect(p1.hand.total()).toBe(1); // una robada; la de la mano se gastó
    expect(p1.bag.total()).toBe(bagBefore - 1);
  });

  test("Guerrero: encadena maniobras pagando monedas de su propia pila", async () => {
    const { game } = await newGame(["guerrero"], ["piquero"]);
    const p1 = game.player("player1");
    const start = deployOwn(game, "player1", "guerrero");
    const guerrero = game.board.findUnit("player1", "guerrero")!;

    // Reforzar para poder pagar una encadenada sin retirar la última.
    giveHand(p1, ["guerrero"]);
    expect(game.bolster("player1", "guerrero").success).toBe(true);
    expect(guerrero.coins).toBe(2);

    // Primera maniobra: paga una moneda de la mano y concede la cadena.
    giveHand(p1, ["guerrero"]);
    const to = freeAdjacent(game, start);
    const first = game.executeManeuver("player1", { kind: "move", unitType: "guerrero", to });
    expect(first.success).toBe(true);
    expect(p1.hand.countUnit("guerrero")).toBe(0);
    expect(first.events.some((e) => e.type === "free-maneuver")).toBe(true);

    // Segunda maniobra (cadena): paga 1 moneda de la pila (queda la última).
    const to2 = freeAdjacent(game, guerrero.position);
    const chain = game.executeFreeManeuver("player1", { kind: "move", unitType: "guerrero", to: to2 });
    expect(chain.success).toBe(true);
    expect(guerrero.position).toBe(to2);
    expect(guerrero.coins).toBe(1);
    expect(chain.events.some((e) => e.type === "coin-spent")).toBe(true);

    // Tercera maniobra: con la pila en su última moneda se rechaza (y no paga).
    const to3 = freeAdjacent(game, guerrero.position);
    const last = game.executeFreeManeuver("player1", { kind: "move", unitType: "guerrero", to: to3 });
    expect(last.success).toBe(false);
    expect(last.message).toMatch(/última moneda/);
    expect(guerrero.position).toBe(to2); // no se movió
    expect(guerrero.coins).toBe(1);
  });
});

describe("Victoria", () => {
  test("colocar la última ficha declara ganador", async () => {
    const { game, board } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    deployOwn(game, "player1", "caballeria");
    const unit = game.board.findUnit("player1", "caballeria")!;

    // 2 fichas iniciales + 4 dominando bases neutrales = 6 → gana.
    const neutrals = board.getLocations().filter((n) => n.isNeutral()).slice(0, 4);
    expect(neutrals).toHaveLength(4);
    giveHand(p1, ["caballeria", "caballeria", "caballeria", "caballeria"]);

    for (const node of neutrals) {
      game.board.moveUnit(unit, node.id);
      const control = game.executeManeuver("player1", { kind: "control", unitType: "caballeria" });
      expect(control.success).toBe(true);
    }
    expect(game.countPlacedMarkers("player1")).toBe(6);
    expect(game.winner).toBe("player1");
  });
});
