import { describe, expect, test } from "bun:test";
import { cursorStep, targetPositions } from "./targeting.ts";
import type { GameStateView } from "./engine-view.ts";

describe("targeting", () => {
  test("wraps target selection horizontally", () => {
    expect(cursorStep(["A0", "B0"], 0, -1)).toBe(1);
    expect(cursorStep(["A0", "B0"], 1, 1)).toBe(0);
  });

  test("shows controlled empty bases for deploy", () => {
    const view = { board: { C1: { terrain: "base-lobos" }, D6: { terrain: "normal" } } } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "deploy")).toEqual(["C1"]);
  });

  test("filters movement to adjacent empty cells", () => {
    const view = { board: {
      A0: { terrain: "normal", neighbors: ["A1", "B0", "B1"], unit: { type: "piquero", owner: "player1", coins: 1 } },
      A1: { terrain: "normal" }, B0: { terrain: "normal", unit: { type: "arquero", owner: "player1", coins: 1 } },
      B1: { terrain: "normal" }, C0: { terrain: "normal" },
    } } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "move", "A0")).toEqual(["A1", "B1"]);
  });
});
