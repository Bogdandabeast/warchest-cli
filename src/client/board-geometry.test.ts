import { describe, expect, test } from "bun:test";
import { BOARD_CANVAS, BOARD_CROP, hexCenter, idToGrid } from "./board-geometry.ts";

describe("board geometry", () => {
  test("parses grid ids A0–G12", () => {
    expect(idToGrid("A3")).toEqual({ col: 0, row: 3 });
    expect(idToGrid("D0")).toEqual({ col: 3, row: 0 });
    expect(idToGrid("G12")).toEqual({ col: 6, row: 12 });
  });

  test("rejects out-of-grid or malformed ids", () => {
    expect(idToGrid("H0")).toBeNull();
    expect(idToGrid("A13")).toBeNull();
    expect(idToGrid("")).toBeNull();
    expect(idToGrid("foo")).toBeNull();
  });

  test("maps hex centers linearly from SVG pixels to canvas cells", () => {
    // D6 → centro del SVG (1800, 1050) → centro del lienzo.
    const d6 = hexCenter("D6")!;
    expect(d6.left).toBeCloseTo(BOARD_CANVAS.width / 2, 5);
    expect(d6.top).toBeCloseTo(BOARD_CANVAS.height / 2, 5);
    // C1 → columna C (col 2), fila 1.
    const c1 = hexCenter("C1")!;
    expect(c1.left).toBeCloseTo(((1130.4199 + 2 * 223.1934 - BOARD_CROP.x) / BOARD_CROP.width) * BOARD_CANVAS.width, 5);
    expect(c1.top).toBeCloseTo(((276.8352 + 128.8608 - BOARD_CROP.y) / BOARD_CROP.height) * BOARD_CANVAS.height, 5);
  });

  test("unknown ids return null", () => {
    expect(hexCenter("H0")).toBeNull();
    expect(hexCenter("")).toBeNull();
  });
});