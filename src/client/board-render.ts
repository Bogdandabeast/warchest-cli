import type { GameStateView } from "./engine-view.ts";
import type { Position } from "../domain/types.ts";

export const BOARD_PIXEL_WIDTH = 56;
export const BOARD_PIXEL_HEIGHT = 26;
export const BOARD_CELL_WIDTH = 8;
export const HEX_HEIGHT = 2;
const COLUMNS = ["A", "B", "C", "D", "E", "F", "G"] as const;

export const PIXEL_COLORS = {
  normal: "#8fff91",
  "base-neutral": "#58b96d",
  "base-lobos": "#ffff00",
  "base-cuervos": "#9696ff",
  table: "#161a26",
} as const;

export interface PixelSegment { text: string; color: string; }
export type PixelRow = PixelSegment[];

export function renderPixelRows(view: GameStateView, cursor?: Position, validTargets: readonly Position[] = []): PixelRow[] {
  const targets = new Set(validTargets);
  const rows: PixelRow[] = [];
  for (let row = 0; row <= 12; row++) {
    const indent = row % 2 === 0 ? "" : "    ";
    const segments: PixelSegment[] = indent ? [{ text: indent, color: PIXEL_COLORS.table }] : [];
    for (const column of COLUMNS) {
      const position = `${column}${row}`;
      const cell = view.board[position];
      const color = cell ? PIXEL_COLORS[cell.terrain] : PIXEL_COLORS.table;
      let glyph = " ";
      if (cursor === position) glyph = "◆";
      else if (targets.has(position)) glyph = "◇";
      else if (cell?.unit) glyph = cell.unit.owner === "player1" ? "L" : "C";
      else if (cell?.controlledBy) glyph = cell.controlledBy === "player1" ? "L" : "C";
      segments.push({ text: glyph.repeat(BOARD_CELL_WIDTH), color });
      segments.push({ text: " ", color: PIXEL_COLORS.table });
    }
    rows.push(segments);
    rows.push(segments.map((segment) => ({ ...segment })));
  }
  return rows;
}

export function renderPixelBoard(view: GameStateView, cursor?: Position, validTargets: readonly Position[] = []): string[] {
  return renderPixelRows(view, cursor, validTargets).map((row) => row.map((segment) => segment.text).join(""));
}

export function renderBoardRows(view: GameStateView, cursor?: Position, validTargets: readonly Position[] = []): string[] {
  return renderPixelBoard(view, cursor, validTargets);
}
