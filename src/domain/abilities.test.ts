import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import type { Board } from "./board.ts";
import { configureGame } from "./game-setup.ts";
import type { Player } from "./player.ts";
import { Game } from "./game.ts";
import { Unit } from "./unit.ts";
import type { UnitType } from "./units.ts";
import { distanceInHexes, hexesInStraightLine } from "./geometry.ts";
import type { PlayerId, Position } from "./types.ts";

async function newGame(p1: UnitType[], p2: UnitType[]): Promise<{ game: Game; board: Board }> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: p1, player2: p2 });
  const game = new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
  return { game, board };
}

function giveHand(player: Player, coins: UnitType[], royal = 0): void {
  for (const type of coins) player.hand.addUnit(type);
  for (let i = 0; i < royal; i++) player.hand.addRoyal();
}

function freeControlledLocation(game: Game, playerId: PlayerId): Position {
  for (const node of game.board.getControlledLocations(playerId)) {
    if (game.board.unitAt(node.id) === undefined) return node.id;
  }
  throw new Error("Sin localizaciones controladas libres");
}

/** Coloca una unidad (aliada o enemiga) directamente en una casilla concreta. */
function rawPlace(game: Game, owner: PlayerId, type: UnitType, at: Position): Unit {
  const unit = new Unit({ type, owner, position: at });
  game.board.placeUnit(unit, at);
  return unit;
}

/** Casillas en línea recta desde `from` con exactamente 1 intermedia libre. */
function straightLine2(game: Game, from: Position): { target: Position; middle: Position }[] {
  const out: { target: Position; middle: Position }[] = [];
  for (const node of game.board.getAllNodes()) {
    const between = hexesInStraightLine(game.board, from, node.id);
    if (between.length === 1 && game.board.unitAt(node.id) === undefined) {
      out.push({ target: node.id, middle: between[0]! });
    }
  }
  return out;
}

describe("Alférez", () => {
  test("mueve una unidad aliada a 1-2 hacia una casilla a 1-2 del Alférez", async () => {
    const { game } = await newGame(["alferez", "caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "alferez", base);

    // Sin aliado en el blanco → falla.
    giveHand(p1, ["alferez"]);
    const allySpot = game.board.getAllNodes().find((n) => distanceInHexes(game.board, base, n.id) === 2 && game.board.unitAt(n.id) === undefined)!.id;
    const dest = game.board.getAllNodes().find((n) => distanceInHexes(game.board, base, n.id) === 1 && game.board.unitAt(n.id) === undefined)!.id;
    const noAlly = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "alferez",
      params: { ability: "ensign", ally: allySpot, to: dest },
    });
    expect(noAlly.success).toBe(false);

    // Desplegar la aliada y moverla a una casilla adyacente a 1-2 del Alférez.
    const ally = rawPlace(game, "player1", "caballeria", allySpot);
    const dest2 = game.board.getNeighbors(allySpot).find(
      (n) => distanceInHexes(game.board, base, n) >= 1 && distanceInHexes(game.board, base, n) <= 2 && game.board.unitAt(n) === undefined,
    )!;
    const result = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "alferez",
      params: { ability: "ensign", ally: allySpot, to: dest2 },
    });
    expect(result.success).toBe(true);
    expect(ally.position).toBe(dest2);
    expect(p1.hand.countUnit("alferez")).toBe(0); // pagó la moneda
  });
});

describe("Arquero (X)", () => {
  test("ataca a exactamente 2 casillas aunque la intermedia esté ocupada", async () => {
    const { game } = await newGame(["arquero"], ["caballeria"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "arquero", base);

    // Blanco a distancia 2 (con alguien en la intermedia).
    const line2 = straightLine2(game, base);
    expect(line2.length).toBeGreaterThan(0);
    const { target, middle } = line2[0]!;
    rawPlace(game, "player2", "caballeria", target);
    rawPlace(game, "player1", "piquero", middle); // la intermedia ocupada no molesta

    giveHand(p1, ["arquero"]);
    const result = game.executeManeuver("player1", { kind: "ability", unitType: "arquero", params: { ability: "archer", target } });
    expect(result.success).toBe(true);
    expect(game.board.unitAt(target)).toBeUndefined();

    // A distancia 1 → no válido (con moneda de sobra en la mano).
    const adjacent = game.board.getNeighbors(base)[0]!;
    giveHand(p1, ["arquero"]);
    expect(
      game.executeManeuver("player1", { kind: "ability", unitType: "arquero", params: { ability: "archer", target: adjacent } }).success,
    ).toBe(false);
  });
});

describe("Ballestero", () => {
  test("ataca a 2 en línea recta con la intermedia libre", async () => {
    const { game } = await newGame(["ballestero"], ["caballeria"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "ballestero", base);

    const line2 = straightLine2(game, base);
    expect(line2.length).toBeGreaterThan(0);
    const { target } = line2[0]!;
    rawPlace(game, "player2", "caballeria", target);

    giveHand(p1, ["ballestero"]);
    const ok = game.executeManeuver("player1", { kind: "ability", unitType: "ballestero", params: { ability: "crossbowman", target } });
    expect(ok.success).toBe(true);
    expect(game.board.unitAt(target)).toBeUndefined();
  });

  test("si la intermedia está ocupada, ataca a ESA unidad (no a la de detrás)", async () => {
    const { game } = await newGame(["ballestero"], ["caballeria", "caballeria-ligera"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "ballestero", base);

    const line2 = straightLine2(game, base);
    expect(line2.length).toBeGreaterThan(0);
    const { target, middle } = line2[0]!;
    rawPlace(game, "player2", "caballeria", target); // el objetivo pedido…
    rawPlace(game, "player2", "caballeria-ligera", middle); // …tapado por esta

    giveHand(p1, ["ballestero"]);
    const result = game.executeManeuver("player1", { kind: "ability", unitType: "ballestero", params: { ability: "crossbowman", target } });
    expect(result.success).toBe(true);
    // Muere la unidad intermedia; la de detrás sigue intacta.
    expect(game.board.unitAt(middle)).toBeUndefined();
    expect(game.board.unitAt(target)?.type).toBe("caballeria");
  });
});

describe("Lancero (X) — embestida", () => {
  test("avanza en línea recta y ataca a 2; la acción normal está prohibida", async () => {
    const { game } = await newGame(["lancero"], ["caballeria"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const lancer = rawPlace(game, "player1", "lancero", base);

    const line2 = straightLine2(game, base);
    expect(line2.length).toBeGreaterThan(0);
    const { target, middle } = line2[0]!;
    rawPlace(game, "player2", "caballeria", target);
    giveHand(p1, ["lancero"]);

    // No puede usar la acción Atacar normal.
    expect(game.executeManeuver("player1", { kind: "attack", unitType: "lancero", target }).success).toBe(false);

    // Embestida: avanza al intermedio y ataca.
    const charge = game.executeManeuver("player1", { kind: "ability", unitType: "lancero", params: { ability: "lancer", target } });
    expect(charge.success).toBe(true);
    expect(lancer.position).toBe(middle);
    expect(game.board.unitAt(target)).toBeUndefined();
  });

  test("el Lancero no embiste a un Caballero sin estar reforzado (no mueve ni gasta)", async () => {
    const { game } = await newGame(["lancero"], ["caballero"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const lancer = rawPlace(game, "player1", "lancero", base);

    const line2 = straightLine2(game, base);
    expect(line2.length).toBeGreaterThan(0);
    const { target, middle } = line2[0]!;
    rawPlace(game, "player2", "caballero", target);

    // Sin reforzar → rechazado ANTES de avanzar y sin gastar moneda.
    giveHand(p1, ["lancero"]);
    const blocked = game.executeManeuver("player1", { kind: "ability", unitType: "lancero", params: { ability: "lancer", target } });
    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/sin estar reforzado/);
    expect(lancer.position).toBe(base); // NO avanzó
    expect(p1.hand.countUnit("lancero")).toBe(1); // NO gastó la moneda

    // Reforzado (2+ monedas) → la embestida sí procede.
    lancer.addCoin();
    const charge = game.executeManeuver("player1", { kind: "ability", unitType: "lancero", params: { ability: "lancer", target } });
    expect(charge.success).toBe(true);
    expect(lancer.position).toBe(middle);
  });
});

describe("Mariscal", () => {
  test("ordena atacar a una unidad aliada a 1-2 (no a Arquero/Lancero)", async () => {
    const { game } = await newGame(["mariscal", "caballeria"], ["caballeria-ligera"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "mariscal", base);

    const allySpot = game.board.getNeighbors(base).find((n) => game.board.unitAt(n) === undefined)!;
    rawPlace(game, "player1", "caballeria", allySpot);
    const enemySpot = game.board.getNeighbors(allySpot).find((n) => n !== base && game.board.unitAt(n) === undefined)!;
    rawPlace(game, "player2", "caballeria-ligera", enemySpot);

    giveHand(p1, ["mariscal"]);
    const result = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "mariscal",
      params: { ability: "marshal", ally: allySpot, attackTarget: enemySpot },
    });
    expect(result.success).toBe(true);
    expect(game.board.unitAt(enemySpot)).toBeUndefined();
  });

  test("no puede ordenar atacar a un Arquero (solo ataca con habilidad)", async () => {
    const { game } = await newGame(["mariscal", "arquero"], ["caballeria-ligera"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    rawPlace(game, "player1", "mariscal", base);

    const allySpot = game.board.getNeighbors(base).find((n) => game.board.unitAt(n) === undefined)!;
    rawPlace(game, "player1", "arquero", allySpot);
    const enemySpot = game.board.getNeighbors(allySpot).find((n) => n !== base && game.board.unitAt(n) === undefined)!;
    rawPlace(game, "player2", "caballeria-ligera", enemySpot);

    giveHand(p1, ["mariscal"]);
    const result = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "mariscal",
      params: { ability: "marshal", ally: allySpot, attackTarget: enemySpot },
    });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/no puede hacer un ataque normal/);
  });
});

describe("Guardia Real", () => {
  test("se mueve hasta 2 casillas a una localización dominada descartando la moneda Real", async () => {
    const { game, board } = await newGame(["guardia-real"], ["caballeria"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const guard = rawPlace(game, "player1", "guardia-real", base);

    // Controlar una base neutral a distancia ≤2 de la Guardia Real.
    const destination = board.getLocations().find((n) => n.isNeutral() && distanceInHexes(game.board, base, n.id) <= 2)!;
    if (destination === undefined) throw new Error("Sin localización neutral cercana");
    game.board.placeControlMarker(destination.id, "player1");
    giveHand(p1, [], 1);

    const result = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "guardia-real",
      params: { ability: "royal-guard", to: destination.id },
    });
    expect(result.success).toBe(true);
    expect(guard.position).toBe(destination.id);
    expect(p1.hand.hasRoyal()).toBe(false);
    expect(p1.discard.hasRoyal()).toBe(true);

    // Sin moneda Real ya no puede repetirla.
    giveHand(p1, [], 0);
    expect(
      game.executeManeuver("player1", { kind: "ability", unitType: "guardia-real", params: { ability: "royal-guard", to: base } }).success,
    ).toBe(false);
  });
});

describe("Caballería ligera y Caballería", () => {
  test("la caballería ligera se mueve 2 con su táctica", async () => {
    const { game } = await newGame(["caballeria-ligera"], ["caballeria"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const unit = rawPlace(game, "player1", "caballeria-ligera", base);

    const dest = game.board
      .getAllNodes()
      .find((n) => distanceInHexes(game.board, base, n.id) === 2 && game.board.unitAt(n.id) === undefined)!.id;
    giveHand(p1, ["caballeria-ligera"]);
    const result = game.executeManeuver("player1", { kind: "ability", unitType: "caballeria-ligera", params: { ability: "light-cavalry", to: dest } });
    expect(result.success).toBe(true);
    expect(unit.position).toBe(dest);
  });

  test("la caballería se mueve y ataca con su táctica", async () => {
    const { game } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const cavalry = rawPlace(game, "player1", "caballeria", base);
    cavalry.addCoin(); // reforzada: sobrevive al contraataque del Piquero

    const moveTo = game.board.getNeighbors(base).find((n) => game.board.unitAt(n) === undefined)!;
    const targetPos = game.board.getNeighbors(moveTo).find((n) => n !== base && game.board.unitAt(n) === undefined)!;
    rawPlace(game, "player2", "piquero", targetPos);

    giveHand(p1, ["caballeria"]);
    const result = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "caballeria",
      params: { ability: "cavalry", moveTo, attackTarget: targetPos },
    });
    expect(result.success).toBe(true);
    expect(cavalry.position).toBe(moveTo);
    expect(game.board.unitAt(targetPos)).toBeUndefined(); // piquero destruido
  });

  test("la caballería no puede usar su táctica sin objetivo de ataque", async () => {
    const { game } = await newGame(["caballeria"], ["piquero"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const cavalry = rawPlace(game, "player1", "caballeria", base);

    const moveTo = game.board.getNeighbors(base).find((n) => game.board.unitAt(n) === undefined)!;
    giveHand(p1, ["caballeria"]);
    const result = game.executeManeuver("player1", { kind: "ability", unitType: "caballeria", params: { ability: "cavalry", moveTo } });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/objetivo de ataque/);
    expect(cavalry.position).toBe(base);
    expect(p1.hand.countUnit("caballeria")).toBe(1); // no gastó la moneda
  });

  test("la caballería no rebiste a un Caballero sin estar reforzada (no mueve ni gasta)", async () => {
    const { game } = await newGame(["caballeria"], ["caballero"]);
    const p1 = game.player("player1");
    const base = freeControlledLocation(game, "player1");
    const cavalry = rawPlace(game, "player1", "caballeria", base);

    const moveTo = game.board.getNeighbors(base).find((n) => game.board.unitAt(n) === undefined)!;
    const knightPos = game.board.getNeighbors(moveTo).find((n) => n !== base && game.board.unitAt(n) === undefined)!;
    rawPlace(game, "player2", "caballero", knightPos);

    // Sin reforzar → la táctica se rechaza ANTES de mover y no gasta moneda.
    giveHand(p1, ["caballeria"]);
    const blocked = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "caballeria",
      params: { ability: "cavalry", moveTo, attackTarget: knightPos },
    });
    expect(blocked.success).toBe(false);
    expect(blocked.message).toMatch(/sin estar reforzada/);
    expect(cavalry.position).toBe(base); // NO se movió
    expect(p1.hand.countUnit("caballeria")).toBe(1); // NO gastó la moneda

    // Reforzada (2+ monedas) → la embestida sí es válida.
    cavalry.addCoin();
    const charge = game.executeManeuver("player1", {
      kind: "ability",
      unitType: "caballeria",
      params: { ability: "cavalry", moveTo, attackTarget: knightPos },
    });
    expect(charge.success).toBe(true);
    expect(cavalry.position).toBe(moveTo);
  });
});
