import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Board } from "../domain/board.ts";
import { SVGBoardLoader, DEFAULT_BOARD_PATH } from "./svg-board-loader.ts";

const svgComposed = resolve(import.meta.dir, "../../", DEFAULT_BOARD_PATH);

/** Casilla mínima dentro de un grupo cell-* del board compuesto. */
function cellGroup(id: string, cx: number, cy: number, stroke: string, marker = false): string {
  const hexagon = [
    "  <path",
    '     sodipodi:type="star"',
    `     style="opacity:1;stroke:${stroke};stroke-width:9"`,
    `     id="path-${id}"`,
    '     sodipodi:sides="6"',
    `     sodipodi:cx="${cx}"`,
    `     sodipodi:cy="${cy}"`,
    '     sodipodi:r1="136.9"',
    '     sodipodi:r2="118.5"',
    '     d="m 0,0 z" />',
  ].join("\n");
  const markerHex = marker
    ? [
        "  <path",
        '     sodipodi:type="star"',
        `     style="opacity:1;stroke:#ffffff;stroke-width:3"`,
        `     id="marker-${id}"`,
        '     sodipodi:sides="6"',
        `     sodipodi:cx="${cx}"`,
        `     sodipodi:cy="${cy}"`,
        '     sodipodi:r1="68"',
        '     sodipodi:r2="54"',
        '     d="m 0,0 z" />',
      ].join("\n")
    : "";
  return `<g id="cell-${id}" transform="translate(0 0)">\n${hexagon}\n${markerHex}\n  </g>`;
}

/**
 * Tablero sintético: 27 normales (verdes) + 6 bases neutrales + 2 lobos + 2
 * cuervos. Cada base neutral lleva marcador interior. El número de bases de
 * lobos es configurable para probar aserciones de conteo.
 */
function syntheticBoardSvg(lobos = 2): string {
  const groups: string[] = [];
  const normals = Array.from({ length: 27 }, (_, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const cx = 200 + col * 400;
    const cy = 200 + row * 300;
    return cellGroup(`${String.fromCharCode(65 + col)}${row}`, cx, cy, "#8fff91");
  });
  const neutral = Array.from({ length: 6 }, (_, i) => {
    const cx = 2200 + i * 400;
    const cy = 200 + i * 250;
    return cellGroup(`N${i}`, cx, cy, "#8fff91", true);
  });
  groups.push(...normals, ...neutral);
  for (let i = 0; i < lobos; i++) {
    groups.push(cellGroup(`L${i}`, 500 + i * 400, 1400, "#ffff00"));
  }
  groups.push(
    cellGroup("C1b", 1300, 1400, "#9696ff"),
    cellGroup("C2b", 1700, 1400, "#9696ff"),
  );
  // Con menos bases de lobos, los grupos sobrantes se rellenan como neutras
  // para mantener exactamente 37 grupos.
  for (let i = lobos; i < 2; i++) {
    const cx = 500 + i * 400;
    groups.push(cellGroup(`X${i}`, cx, 1700, "#8fff91", true));
  }
  return `<svg>\n${groups.join("\n")}\n</svg>`;
}

async function load(path: string): Promise<Board> {
  return new SVGBoardLoader(path).load();
}

async function loadComposed(): Promise<Board> {
  return load(svgComposed);
}

describe("SVGBoardLoader (board compuesto assets/board/board-1v1.svg)", () => {
  test("carga las 37 casillas del tablero 1v1", async () => {
    const board = await loadComposed();
    expect(board.size).toBe(37);
    expect(board.getLocations()).toHaveLength(10);
  });

  test("clasifica los terrenos: 27 normales, 6 bases neutrales, 2 de cada jugador", async () => {
    const board = await loadComposed();
    const count = (terrain: string) =>
      board.getAllNodes().filter((n) => n.terrain === terrain).length;
    expect(count("normal")).toBe(27);
    expect(count("base-neutral")).toBe(6);
    expect(count("base-lobos")).toBe(2);
    expect(count("base-cuervos")).toBe(2);
  });

  test("ids únicos con formato de rejilla A0–G12", async () => {
    const board = await loadComposed();
    const ids = board.getAllNodes().map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[A-G](?:1[0-2]|[0-9])$/);
    }
  });

  test("bases de inicio: lobos arriba = player1, cuervos abajo = player2", async () => {
    const board = await loadComposed();
    expect(board.getStartLocations("player1")).toEqual(["C1", "F2"]);
    expect(board.getStartLocations("player2")).toEqual(["B10", "E11"]);
  });

  test("el centro del tablero es D6 con sus 6 vecinos", async () => {
    const board = await loadComposed();
    const center = board.getNode("D6")!;
    expect([center.x, center.y]).toEqual([1800, 1050]);
    expect(center.neighbors).toEqual(["C5", "C7", "D4", "D8", "E5", "E7"]);
  });

  test("adyacencia simétrica, sin auto-vecinos y con casillas existentes", async () => {
    const board = await loadComposed();
    for (const n of board.getAllNodes()) {
      expect(n.neighbors.length).toBeGreaterThanOrEqual(2);
      expect(n.neighbors.length).toBeLessThanOrEqual(6);
      expect(n.neighbors).not.toContain(n.id);
      for (const neighbor of n.neighbors) {
        const neighborNode = board.getNode(neighbor)!;
        expect(neighborNode).toBeDefined();
        expect(neighborNode.neighbors).toContain(n.id);
      }
    }
  });

  test("load() rechaza un SVG con conteos de terreno inválidos", async () => {
    const dir = await mkdtemp(join(tmpdir(), "warchest-loader-"));
    const file = join(dir, "bad.svg");
    try {
      // Solo una base de lobos (se esperan 2).
      await writeFile(file, syntheticBoardSvg(1));
      await expect(new SVGBoardLoader(file).load()).rejects.toThrow(/Conteo de terreno inválido/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("load() rechaza un SVG con un número de grupos distinto de 37", async () => {
    const dir = await mkdtemp(join(tmpdir(), "warchest-loader-"));
    const file = join(dir, "few.svg");
    try {
      await writeFile(file, "<svg>\n</svg>");
      await expect(new SVGBoardLoader(file).load()).rejects.toThrow(/37 grupos/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
