import { describe, expect, test } from "bun:test";
import { Board, BoardNode } from "../domain/board.ts";
import { Game } from "../domain/game.ts";
import { Player } from "../domain/player.ts";

function makeGame(): Game {
  const board = new Board([
    new BoardNode({ id: "C1", x: 0, y: 0, terrain: "base-lobos", neighbors: ["D1"] }),
    new BoardNode({ id: "D1", x: 1, y: 0, terrain: "normal", neighbors: ["C1"] }),
    new BoardNode({ id: "B10", x: 0, y: 1, terrain: "base-cuervos", neighbors: [] }),
  ]);
  const player1 = new Player("player1", ["arquero", "piquero"]);
  const player2 = new Player("player2", ["guerrero"]);
  board.placeControlMarker("C1", "player1");
  player1.hand.addUnit("arquero");
  player1.hand.addUnit("piquero");
  return new Game({ board, players: { player1, player2 }, initiative: "player1" });
}

describe("deploy intent", () => {
  test("deploys the troop represented by the selected hand coin", () => {
    const game = makeGame();
    const result = game.deploy("player1", "piquero", "C1");
    expect(result.success).toBe(true);
    expect(game.board.unitAt("C1")?.type).toBe("piquero");
    expect(game.player("player1").hand.hasUnit("arquero")).toBe(true);
  });

  test("rejects a deployment to an uncontrolled non-location (D1)", () => {
    const game = makeGame();
    const result = game.deploy("player1", "piquero", "D1");
    expect(result.success).toBe(false);
    expect(game.board.unitAt("D1")).toBeUndefined();
    // La moneda no se gasta: el piquero sigue en la mano.
    expect(game.player("player1").hand.hasUnit("piquero")).toBe(true);
  });
});
