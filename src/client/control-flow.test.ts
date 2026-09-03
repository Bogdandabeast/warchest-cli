import { describe, expect, test } from "bun:test";
import { targetPositions } from "./targeting.ts";
import type { GameStateView } from "./engine-view.ts";

describe("control targeting", () => {
  test("does not offer normal terrain or already controlled bases", () => {
    const view = { board: {
      A0: { terrain: "normal", controlledBy: undefined, unit: { type: "arquero", owner: "player1", coins: 1 } },
      A1: { terrain: "base-neutral", controlledBy: undefined },
      B0: { terrain: "base-lobos", controlledBy: "player1" },
      B1: { terrain: "base-cuervos", controlledBy: "player2" },
    } } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "control", "A0")).toEqual([]);
  });
});
