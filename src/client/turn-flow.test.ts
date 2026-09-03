import { describe, expect, test } from "bun:test";
import { Game } from "../domain/game.ts";
import { configureGame } from "../domain/game-setup.ts";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";

async function makeGame(): Promise<Game> {
  const board = await new SVGBoardLoader().load();
  const config = configureGame(board, { player1: ["arquero"], player2: ["piquero"] });
  return new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
}

describe("turn flow", () => {
  test("alternates after each completed action", async () => {
    const game = await makeGame();
    game.startRound(() => 0);
    expect(game.currentPlayer).toBe("player2");
    game.player("player2").hand.addUnit("piquero");
    expect(game.pass("player2", { kind: "unit", unitType: "piquero" }).success).toBe(true);
    expect(game.currentPlayer).toBe("player1");
    game.player("player1").hand.addUnit("arquero");
    expect(game.pass("player1", { kind: "unit", unitType: "arquero" }).success).toBe(true);
    expect(game.currentPlayer).toBe("player2");
  });
});
