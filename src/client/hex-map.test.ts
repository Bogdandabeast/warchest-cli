import { describe, expect, test } from "bun:test";
import { makeMapRows, renderMapText } from "./hex-map.ts";
import type { GameStateView } from "./engine-view.ts";

const view: GameStateView = {
  board: { A0: { terrain: "normal" }, D6: { terrain: "base-neutral", controlledBy: "player1" } },
  players: {
    player1: { id: "player1", faction: "Lobos", unitCards: [], markersPlaced: 1, markersTotal: 6, hand: [], reserve: {} },
    player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 0, markersTotal: 6, handHidden: { count: 0 }, reserveHidden: { count: 0 } },
  },
  localPlayer: "player1", currentPlayer: "player1", initiative: "player2", round: 1, phase: "playing", hand: [], reserve: {},
  markers: { player1: 1, player2: 0 }, pendingFreeManeuvers: [], lastEvents: [],
};

describe("hex-map", () => {
  test("covers the A0-G12 grid and preserves cursor/highlight", () => {
    const rows = makeMapRows(view, "D6", ["A0"]);
    expect(rows).toHaveLength(13);
    expect(rows[0]?.cells).toHaveLength(7);
    expect(rows[0]?.cells[0]?.valid).toBe(true);
    expect(rows[6]?.cells[3]?.cursor).toBe(true);
  });

  test("renders terrain and control art inside board cells", () => {
    expect(renderMapText(view)).toHaveLength(13);
    expect(renderMapText(view)[0]).toContain("·");
    expect(renderMapText(view)[6]).toContain("▓");
    expect(renderMapText(view)[0]).toContain("       ");
  });
});
