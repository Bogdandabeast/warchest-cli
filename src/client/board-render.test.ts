import { describe, expect, test } from "bun:test";
import type { GameStateView } from "./engine-view.ts";
import { BOARD_CELL_WIDTH, BOARD_PIXEL_HEIGHT, BOARD_PIXEL_WIDTH, renderPixelBoard, renderPixelRows } from "./board-render.ts";

/** Construye una vista mínima con las casillas indicadas. */
function viewWith(board: Record<string, unknown>): GameStateView {
  return { board } as unknown as GameStateView;
}

function textOf(rows: ReturnType<typeof renderPixelRows>): string[] {
  return rows.map((row) => row.map((segment) => segment.text).join(""));
}

/** Fila lógica del tablero (0..12) → índice de la fila de terminal (cada lógica se duplica). */
function rowIndex(logical: number, copy: 0 | 1): number {
  return logical * 2 + copy;
}

describe("shared board renderer", () => {
  test("returns terrain colors as structured pixel segments", () => {
    const view = viewWith({ A0: { terrain: "normal" }, B0: { terrain: "base-neutral" }, C0: { terrain: "base-lobos" }, D0: { terrain: "base-cuervos" } });
    const segments = renderPixelRows(view)[0]!;
    const colors = new Set(segments.map((segment) => segment.color));
    expect(colors.has("#8fff91")).toBe(true);
    expect(colors.has("#58b96d")).toBe(true);
    expect(colors.has("#ffff00")).toBe(true);
    expect(colors.has("#9696ff")).toBe(true);
    expect(segments.some((segment) => segment.text.includes(" ") && segment.color === "#8fff91")).toBe(true);
  });

  test("keeps the rendered board free of literal color markup", () => {
    const view = viewWith({ A0: { terrain: "normal" } });
    const output = renderPixelBoard(view).join("\n");
    expect(output).not.toContain("{fg=");
    expect(output).not.toContain("{/fg}");
  });

  test("pinta ◆ solo en la casilla del cursor (escenarios separados de cursor/objetivo/unidad)", () => {
    const unit = { type: "arquero", owner: "player1", coins: 2 };
    const view = viewWith({ A0: { terrain: "normal", unit } });
    // Cursor y unidad en A0: el cursor gana (◆) y no se ve la letra de la unidad.
    const cursorLines = renderPixelBoard(view, "A0", []).join("\n");
    expect(cursorLines).toContain("◆");
    expect(cursorLines).not.toContain("◇");
    // El bloque del cursor ocupa TODA la celda A0 (no deja hueco de letra L).
    const segments = renderPixelRows(view, "A0")[0]!;
    const a0 = segments.slice(0, 2).map((segment) => segment.text).join("");
    expect(a0).toBe("◆".repeat(8) + " ");
    // Cursor fuera del reticulado (H0 no existe): no se pinta nada raro.
    const invalid = renderPixelBoard(view, "H0", []).join("\n");
    expect(invalid).not.toContain("◆");
  });

  test("pinta ◇ en las casillas objetivo aunque tengan unidad", () => {
    const view = viewWith({ A0: { terrain: "normal", unit: { type: "piquero", owner: "player2", coins: 1 } } });
    const output = renderPixelBoard(view, undefined, ["A0"]).join("\n");
    expect(output).toContain("◇");
    expect(output).not.toContain("◆");
    // El ◇ cubre la celda entera: la letra de la unidad queda detrás.
    expect(output.slice(0, 8)).toBe("◇".repeat(8));
  });

  test("muestra L/C según el dueño de la unidad y de la ficha de control", () => {
    const view = viewWith({
      A0: { terrain: "normal", unit: { type: "arquero", owner: "player1", coins: 1 } },
      B0: { terrain: "normal", unit: { type: "piquero", owner: "player2", coins: 1 } },
      C0: { terrain: "base-lobos", controlledBy: "player1" },
      D0: { terrain: "base-cuervos", controlledBy: "player2" },
    });
    const lines = textOf(renderPixelRows(view));
    const row = lines[rowIndex(0, 0)]!;
    const cellText = (col: number): string => row.slice(col * (BOARD_CELL_WIDTH + 1), col * (BOARD_CELL_WIDTH + 1) + BOARD_CELL_WIDTH);
    expect(cellText(0)).toBe("L".repeat(8)); // unidad de player1
    expect(cellText(1)).toBe("C".repeat(8)); // unidad de player2
    expect(cellText(2)).toBe("L".repeat(8)); // ficha de control de player1
    expect(cellText(3)).toBe("C".repeat(8)); // ficha de control de player2
    // Una base dominada por el propio jugador SIN unidad no pinta marcador de
    // unidad en las casillas sin datos (mesa): celda vacía = espacios.
    const emptyView = viewWith({});
    const emptyLine = textOf(renderPixelRows(emptyView))[0]!;
    expect(emptyLine).toContain(" ");
    expect(emptyLine).not.toContain("◆");
    expect(emptyLine).not.toContain("◇");
    expect(emptyLine).not.toContain("L");
    expect(emptyLine).not.toContain("C");
  });

  test("cada fila generada mide lo que declara el lienzo (63 pares, 67 con sangría)", () => {
    const lines = renderPixelBoard(viewWith({}));
    expect(lines).toHaveLength(BOARD_PIXEL_HEIGHT);
    const lengths = new Set(lines.map((line) => line.length));
    // Pares: 7 columnas × 9 (8 de glifo + separador) = 63; impares: +4 de sangría.
    expect(lengths).toEqual(new Set([63, 67]));
    expect(BOARD_PIXEL_WIDTH).toBe(67); // el máximo generado (fila con sangría)
    expect(BOARD_PIXEL_HEIGHT).toBe(26);
    // La fila impar con sangría empieza con 4 espacios y la par no.
    expect(lines[rowIndex(0, 0)]!.length).toBe(63);
    expect(lines[rowIndex(1, 0)]!.startsWith("    ")).toBe(true);
    expect(lines[rowIndex(1, 0)]!.length).toBe(67);
  });
});
