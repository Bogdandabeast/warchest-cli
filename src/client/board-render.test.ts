import { describe, expect, test } from "bun:test";
import type { GameStateView } from "./engine-view.ts";
import { BOARD_PIXEL_HEIGHT, BOARD_PIXEL_WIDTH, renderPixelBoard, renderPixelRows } from "./board-render.ts";

describe("shared board renderer", () => {
  test("returns terrain colors as structured pixel segments", () => {
    const view = { board: { A0: { terrain: "normal" }, B0: { terrain: "base-neutral" }, C0: { terrain: "base-lobos" }, D0: { terrain: "base-cuervos" } } } as unknown as GameStateView;
    const segments = renderPixelRows(view)[0]!;
    const colors = new Set(segments.map((segment) => segment.color));
    expect(colors.has("#8fff91")).toBe(true);
    expect(colors.has("#58b96d")).toBe(true);
    expect(colors.has("#ffff00")).toBe(true);
    expect(colors.has("#9696ff")).toBe(true);
    expect(segments.some((segment) => segment.text.includes(" ") && segment.color === "#8fff91")).toBe(true);
  });

  test("keeps the rendered board free of literal color markup", () => {
    const view = { board: { A0: { terrain: "normal" } } } as unknown as GameStateView;
    const output = renderPixelBoard(view).join("\n");
    expect(output).not.toContain("{fg=");
    expect(output).not.toContain("{/fg}");
  });

  test("keeps troop and target markers visible", () => {
    const view = { board: { A0: { terrain: "normal", unit: { owner: "player1", type: "arquero", coins: 2 } } } } as unknown as GameStateView;
    const output = renderPixelBoard(view, "A0", ["A0"]).join("\n");
    expect(output).toContain("◆");
  });

  test("uses a fixed, viewport-safe pixel footprint", () => {
    expect(BOARD_PIXEL_WIDTH).toBe(56);
    expect(BOARD_PIXEL_HEIGHT).toBe(26);
  });
});
