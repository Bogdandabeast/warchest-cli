import { describe, expect, test } from "bun:test";
import { targetPositions } from "./targeting.ts";
import type { GameStateView } from "./engine-view.ts";

describe("control targeting", () => {
  const ownUnit = { type: "piquero", owner: "player1", coins: 1 };

  test("does not offer normal terrain or already controlled bases", () => {
    const view = { board: {
      A0: { terrain: "normal", controlledBy: undefined, unit: ownUnit },
      A1: { terrain: "base-neutral", controlledBy: undefined },
      B0: { terrain: "base-lobos", controlledBy: "player1" },
      B1: { terrain: "base-cuervos", controlledBy: "player2" },
    } } as unknown as GameStateView;
    expect(targetPositions(view, "player1", "control", "A0")).toEqual([]);
  });

  test("targetPositions cubre cada base con una unidad propia: neutral y rival sí, propia y terreno normal no", () => {
    const view = { board: {
      A0: { terrain: "base-neutral", controlledBy: undefined, unit: ownUnit },
      B0: { terrain: "base-lobos", controlledBy: "player1", unit: ownUnit },
      B1: { terrain: "base-cuervos", controlledBy: "player2", unit: ownUnit },
      C1: { terrain: "normal", controlledBy: undefined, unit: ownUnit },
    } } as unknown as GameStateView;
    // Base neutral sin conquistar con unidad propia → dominable.
    expect(targetPositions(view, "player1", "control", "A0")).toEqual(["A0"]);
    // Base YA controlada por el propio jugador → no es objetivo.
    expect(targetPositions(view, "player1", "control", "B0")).toEqual([]);
    // Base del rival con unidad propia encima → dominable.
    expect(targetPositions(view, "player1", "control", "B1")).toEqual(["B1"]);
    // Terreno normal (no es localización) → nunca dominable.
    expect(targetPositions(view, "player1", "control", "C1")).toEqual([]);
    // La vista sin unidad en la casilla consultada tampoco ofrece el blanco.
    expect(targetPositions(view, "player1", "control", "A1")).toEqual([]);
  });
});
