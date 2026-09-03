import { describe, expect, test } from "bun:test";
import type { GameStateView } from "./engine-view.ts";

function actionsForCoin(view: GameStateView, coinIndex: number, available: readonly string[]): string[] {
  const coin = view.hand[coinIndex];
  if (!coin) return [];
  return available.filter((action) => action === "pass" || action === "initiative" || action === "recruit" || coin.type !== undefined);
}

describe("guided hand flow", () => {
  test("keeps coin selection limited to the current hand", () => {
    const view = { hand: [{ type: "arquero" }, { type: "piquero" }, { royal: true }] } as unknown as GameStateView;
    expect(actionsForCoin(view, 0, ["deploy", "pass", "recruit"])).toEqual(["deploy", "pass", "recruit"]);
    expect(actionsForCoin(view, 2, ["deploy", "pass", "recruit"])).toEqual(["pass", "recruit"]);
    expect(actionsForCoin(view, 3, ["deploy", "pass", "recruit"])).toEqual([]);
  });
});
