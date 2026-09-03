import { describe, expect, test } from "bun:test";
import type { GameStateView } from "./engine-view.ts";
import { targetPositions } from "./targeting.ts";
import { viableActions } from "./menu-viability.ts";

describe("deploy flow", () => {
  test("does not offer deployment for the Royal coin", () => {
    const view = { board: { C1: { terrain: "base-lobos", controlledBy: "player1" } }, hand: [{ royal: true }] } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "deploy", undefined, undefined)).toEqual(["C1"]);
    expect(viableActions(view, 0)).not.toContain("deploy");
  });

  test("offers an empty player starting base", () => {
    const view = { board: { C1: { terrain: "base-lobos" }, D6: { terrain: "normal" } } } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "deploy")).toEqual(["C1"]);
  });

  test("offers an empty cell adjacent to an allied unit for Explorer", () => {
    const view = { board: {
      A0: { terrain: "base-lobos", controlledBy: "player1", unit: { type: "arquero", owner: "player1", coins: 1 } },
      A1: { terrain: "normal", neighbors: ["A0"] },
    }, hand: [{ type: "explorador" }] } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "deploy", undefined, "explorador")).toEqual(["A1"]);
  });

  test("does not offer an occupied starting base", () => {
    const view = { board: { C1: { terrain: "base-lobos", unit: { type: "arquero", owner: "player1", coins: 1 } } } } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "deploy")).toEqual([]);
  });
});
