import { describe, expect, test } from "bun:test";
import { Board, BoardNode } from "../domain/board.ts";
import { Game } from "../domain/game.ts";
import { Player } from "../domain/player.ts";
import { projectGame } from "./engine-view.ts";

function game(): Game {
  const board = new Board([
    new BoardNode({ id: "A0", x: 0, y: 0, terrain: "base-lobos", neighbors: ["B0"] }),
    new BoardNode({ id: "B0", x: 1, y: 0, terrain: "base-cuervos", neighbors: ["A0"] }),
  ]);
  return new Game({ board, players: { player1: new Player("player1", ["arquero"]), player2: new Player("player2", ["piquero"]) }, initiative: "player1" });
}

describe("engine-view", () => {
  test("projects state and hides the opponent hand", () => {
    const source = game();
    source.player("player1").hand.addUnit("arquero");
    source.player("player2").hand.addUnit("piquero");
    const view = projectGame(source, "player1");
    expect(view.hand).toHaveLength(1);
    expect(view.players.player2.hand).toBeUndefined();
    expect(view.players.player2.handHidden?.count).toBe(1);
  });

  test("projects the discard pile with its orientation (face-up vs face-down)", () => {
    const source = game();
    // Fin de ronda (discardHand): monedas BOCA ABAJO (incluida la Real).
    source.player("player1").hand.addUnit("arquero");
    source.player("player1").hand.addRoyal();
    source.player("player1").discardHand();
    source.player("player2").hand.addUnit("piquero");
    source.player("player2").discardHand();
    let view = projectGame(source, "player1");
    expect(view.players.player1.discard).toEqual([{ type: "arquero", faceUp: false }, { royal: true, faceUp: false }]);
    expect(view.players.player2.discard).toEqual([{ type: "piquero", faceUp: false }]);
    // Una moneda jugada BOCA ARRIBA (maniobra con su tropa) sí se proyecta cara.
    source.player("player1").discard.addUnit("caballeria", 1, true);
    view = projectGame(source, "player1");
    expect(view.players.player1.discard?.[view.players.player1.discard.length - 1]).toEqual({ type: "caballeria", faceUp: true });
  });
});
