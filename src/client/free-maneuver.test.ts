import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { configureGame } from "../domain/game-setup.ts";
import { Game } from "../domain/game.ts";
import type { Player } from "../domain/player.ts";
import type { PlayerId } from "../domain/types.ts";
import type { UnitType } from "../domain/units.ts";
import { Unit } from "../domain/unit.ts";
import { projectGame } from "./engine-view.ts";
import { freeKindLabel, freeRequest, grantLabel, grantsForPlayer, kindsForFreeGrant } from "./free-maneuver.ts";

async function newGame(p1: UnitType[], p2: UnitType[]): Promise<{ game: Game }> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: p1, player2: p2 });
  return { game: new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative }) };
}

function give(player: Player, ...types: UnitType[]): void {
  for (const type of types) player.hand.addUnit(type);
}

function freeControlled(game: Game, playerId: PlayerId): string {
  return game.board.getControlledLocations(playerId).find((node) => game.board.unitAt(node.id) === undefined)!.id;
}

function deploy(game: Game, playerId: PlayerId, type: UnitType): string {
  give(game.player(playerId), type);
  const position = freeControlled(game, playerId);
  const result = game.deploy(playerId, type, position);
  if (!result.success) throw new Error(result.message);
  return position;
}

function freeAdjacent(game: Game, from: string): string {
  return game.board.getNeighbors(from).find((position) => game.board.unitAt(position) === undefined)!;
}

describe("free maneuver helpers", () => {
  test("grantsForPlayer: solo concesiones del jugador actual con unidad en el tablero", async () => {
    const { game } = await newGame(["mercenario", "arquero"], ["piquero"]);
    const p1 = game.player("player1");
    // Reclutar la moneda de Mercenario SIN unidad en el tablero → nada pendiente.
    give(p1, "arquero");
    game.startRound(() => 0);
    expect(game.recruit("player1", { kind: "unit", unitType: "arquero" }, "mercenario").success).toBe(true);
    expect(grantsForPlayer(game, "player1")).toHaveLength(0);
  });

  test("reclutar Mercenario con la unidad en el tablero concede una maniobra gratis", async () => {
    const { game } = await newGame(["mercenario", "arquero"], ["piquero"]);
    const p1 = game.player("player1");
    deploy(game, "player1", "mercenario");
    const mercenario = game.board.findUnit("player1", "mercenario")!;

    give(p1, "arquero");
    game.startRound(() => 0);
    const result = game.recruit("player1", { kind: "unit", unitType: "arquero" }, "mercenario");
    expect(result.success).toBe(true);

    const grants = grantsForPlayer(game, "player1");
    expect(grants).toHaveLength(1);
    expect(grants[0]?.unit).toBe(mercenario);
    expect(grants[0]?.kind).toBe("maneuver");

    // La proyección de la TUI ofrece Mover/Atacar/Dominar según el tablero.
    const view = projectGame(game, "player1", result.events);
    const kinds = kindsForFreeGrant(view, "player1", grants[0]!);
    expect(kinds).toContain("move");
    expect(freeKindLabel("move")).toBe("Mover");

    // Ejecutar la maniobra gratis mueve la unidad sin gastar moneda.
    const dest = freeAdjacent(game, mercenario.position);
    const request = freeRequest(grants[0]!, "move", dest);
    expect(request).toEqual({ kind: "move", unitType: "mercenario", to: dest, unitPos: mercenario.position });
    const executed = game.executeFreeManeuver("player1", request!);
    expect(executed.success).toBe(true);
    expect(mercenario.position).toBe(dest);
    expect(grantsForPlayer(game, "player1")).toHaveLength(0);
  });

  test("concesión de solo movimiento (Espadachín) limita las maniobras a Mover", async () => {
    const { game } = await newGame(["espadachin"], ["piquero"]);
    const p1 = game.player("player1");
    const p1Base = deploy(game, "player1", "espadachin");
    deploy(game, "player2", "piquero");

    const espadachin = game.board.findUnit("player1", "espadachin")!;
    espadachin.addCoin(); // reforzado: sobrevive al contraataque del Piquero
    const piquero = game.board.findUnit("player2", "piquero")!;
    const adjacent = freeAdjacent(game, p1Base);
    game.board.moveUnit(piquero, adjacent);

    game.startRound(() => 0);
    // El Espadachín ataca → movimiento gratis.
    give(p1, "espadachin");
    const attack = game.executeManeuver("player1", { kind: "attack", unitType: "espadachin", target: piquero.position });
    expect(attack.success).toBe(true);

    const grants = grantsForPlayer(game, "player1");
    expect(grants).toHaveLength(1);
    expect(grants[0]?.kind).toBe("move");
    const view = projectGame(game, "player1", attack.events);
    const kinds = kindsForFreeGrant(view, "player1", grants[0]!);
    // Solo Mover: la concesión "move" no permite Atacar ni Dominar.
    expect(kinds).toEqual(["move"]);
  });

  test("etiquetas mostrables", () => {
    const unit = new Unit({ type: "mercenario", owner: "player1", position: "D6" });
    const grant = { id: "fm-1", player: "player1" as PlayerId, unit, kind: "maneuver" as const, source: "test" };
    expect(grantLabel(grant)).toBe("Mercenario en D6 · maniobra gratis");
  });
});
