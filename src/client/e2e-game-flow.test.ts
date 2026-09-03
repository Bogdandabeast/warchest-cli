import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { configureGame } from "../domain/game-setup.ts";
import { Game } from "../domain/game.ts";
import type { Player } from "../domain/player.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import type { UnitType } from "../domain/units.ts";
import { projectGame } from "./engine-view.ts";
import { targetPositions } from "./targeting.ts";
import { viableActions } from "./menu-viability.ts";

async function createGame(p1: UnitType[] = ["guardia-real", "explorador"], p2: UnitType[] = ["piquero"]): Promise<Game> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: p1, player2: p2 });
  return new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
}

function give(player: Player, ...types: UnitType[]): void {
  for (const type of types) player.hand.addUnit(type);
}

function emptyStart(game: Game, player: PlayerId): Position {
  return game.board.getControlledLocations(player).find((node) => game.board.unitAt(node.id) === undefined)!.id;
}

describe("end-to-end game flow", () => {
  test("runs draft setup, alternating turns, deployment, movement and round restart", async () => {
    const game = await createGame();
    expect(game.startRound(() => 0).success).toBe(true);
    expect(game.currentPlayer).toBe("player2");

    give(game.player("player2"), "piquero");
    expect(game.pass("player2", { kind: "unit", unitType: "piquero" }).success).toBe(true);
    expect(game.currentPlayer).toBe("player1");

    const base = emptyStart(game, "player1");
    give(game.player("player1"), "guardia-real");
    expect(game.deploy("player1", "guardia-real", base).success).toBe(true);
    game.nextTurn();
    expect(game.currentPlayer).toBe("player2");

    give(game.player("player2"), "piquero");
    expect(game.pass("player2", { kind: "unit", unitType: "piquero" }).success).toBe(true);
    expect(game.currentPlayer).toBe("player1");
    give(game.player("player1"), "guardia-real");
    const guard = game.board.findUnit("player1", "guardia-real")!;
    const destination = game.board.getNeighbors(guard.position).find((position) => game.board.unitAt(position) === undefined)!;
    expect(game.executeManeuver("player1", { kind: "move", unitType: "guardia-real", to: destination }).success).toBe(true);
    expect(guard.position).toBe(destination);

    game.nextTurn();
    expect(game.currentPlayer).toBe("player2");
    give(game.player("player2"), "piquero");
    expect(game.pass("player2", { kind: "unit", unitType: "piquero" }).success).toBe(true);
    expect(game.currentPlayer).toBe("player1");
    give(game.player("player1"), "guardia-real");
    expect(game.pass("player1", { kind: "unit", unitType: "guardia-real" }).success).toBe(true);
    expect(game.roundOver).toBe(true);
    expect(game.endRound().success).toBe(true);
    expect(game.startRound(() => 0).success).toBe(true);
    expect(game.round).toBe(2);
  });

  test("keeps the TUI projection local and exposes only executable actions and targets", async () => {
    const game = await createGame(["explorador"], ["piquero"]);
    game.startRound(() => 0);
    const local = game.currentPlayer;
    const view = projectGame(game, local);
    expect(view.players[local].hand).toBeDefined();
    expect(view.players[local === "player1" ? "player2" : "player1"].hand).toBeUndefined();

    const selected = view.hand.findIndex((coin) => coin.type !== undefined);
    expect(selected).toBeGreaterThanOrEqual(0);
    const actions = viableActions(view, selected);
    expect(actions).toContain("pass");
    expect(actions).toContain("deploy");
    expect(actions).not.toContain("move");
    expect(targetPositions(view, local, "deploy", undefined, "explorador").every((position) => view.board[position]?.unit === undefined)).toBe(true);
  });

  test("Explorer deploys on ANY empty space adjacent to an ally and rejects occupied/other targets", async () => {
    const game = await createGame(["explorador", "guardia-real"], ["piquero"]);
    const player = game.player("player1");
    const base = emptyStart(game, "player1");
    give(player, "guardia-real");
    expect(game.deploy("player1", "guardia-real", base).success).toBe(true);
    const adjacent = game.board.getNeighbors(base).find((position) => game.board.unitAt(position) === undefined)!;
    give(player, "explorador");
    // Casilla ocupada: rechazada.
    expect(game.deploy("player1", "explorador", base).success).toBe(false);
    // Sin aliado adyacente ni control: rechazada (base neutral lejana).
    const guard = game.board.findUnit("player1", "guardia-real")!;
    const farNeutral = game.board.getLocations().find((node) => node.isNeutral() && game.board.unitAt(node.id) === undefined && !game.board.areAdjacent(node.id, guard.position) && !game.board.areAdjacent(node.id, adjacent))?.id;
    if (farNeutral === undefined) throw new Error("No hay una base neutral lejana libre");
    expect(game.deploy("player1", "explorador", farNeutral).success).toBe(false);
    // Adyacente a un aliado: vale AUNQUE la casilla sea de movimiento (no base).
    expect(game.deploy("player1", "explorador", adjacent).success).toBe(true);
    expect(game.board.unitAt(adjacent)?.type).toBe("explorador");
  });
});
