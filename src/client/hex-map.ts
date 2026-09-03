import type { GameStateView } from "./engine-view.ts";
import { GRID_COLUMNS, GRID_ROWS } from "./theme.ts";
import { UNIT_CODE, UNIT_GLYPH, factionMark } from "./art.ts";
import type { Position } from "../domain/types.ts";

export interface MapCell { position: Position; text: string; exists: boolean; cursor: boolean; valid: boolean; controlledBy?: "player1" | "player2"; }
export interface MapRow { label: number; cells: MapCell[]; }

const TERRAIN_ART: Readonly<Record<string, string>> = {
  normal: "·",
  "base-neutral": "▣",
  "base-lobos": "L▣",
  "base-cuervos": "C▣",
};
const CELL_WIDTH = 10;

function positionAt(column: string, row: number): Position { return `${column}${row}`; }

function cellText(view: GameStateView, position: Position): string {
  const cell = view.board[position];
  if (!cell) return " ".repeat(CELL_WIDTH);
  if (cell.unit) {
    const prefix = factionMark(cell.unit.owner);
    const art = UNIT_GLYPH[cell.unit.type];
    return `${prefix}${art} ${UNIT_CODE[cell.unit.type]} ×${cell.unit.coins}`.slice(0, CELL_WIDTH).padEnd(CELL_WIDTH, " ");
  }
  if (cell.controlledBy) return `${factionMark(cell.controlledBy)}  ▓ control`.slice(0, CELL_WIDTH).padEnd(CELL_WIDTH, " ");
  return `  ${TERRAIN_ART[cell.terrain] ?? "·"}       `.slice(0, CELL_WIDTH).padEnd(CELL_WIDTH, " ");
}

export function makeMapRows(view: GameStateView, cursor?: Position, validTargets: readonly Position[] = []): MapRow[] {
  const valid = new Set(validTargets);
  return Array.from({ length: GRID_ROWS }, (_, row) => ({ label: row, cells: GRID_COLUMNS.map((column) => {
    const position = positionAt(column, row);
    const cell = view.board[position];
    return { position, text: cellText(view, position), exists: cell !== undefined, cursor: position === cursor, valid: valid.has(position), ...(cell?.controlledBy === undefined ? {} : { controlledBy: cell.controlledBy }) };
  }) }));
}

export function renderMapText(view: GameStateView, cursor?: Position, validTargets: readonly Position[] = []): string[] {
  return makeMapRows(view, cursor, validTargets).map((row) => `${String(row.label).padStart(2, " ")} ${row.cells.map((cell) => {
    if (!cell.exists) return " ".repeat(CELL_WIDTH + 1);
    const marker = cell.cursor ? "▶" : cell.valid ? "·" : " ";
    return `${marker}${cell.text}`;
  }).join(" ")}`);
}
