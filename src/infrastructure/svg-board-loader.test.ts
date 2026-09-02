import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Board } from "../domain/board.ts";
import { SVGBoardLoader } from "./svg-board-loader.ts";
import { parseSvgPathElements } from "./svg-parse.ts";

const svg1v1 = resolve(import.meta.dir, "../../warchest_playmat_1v1.svg");
const svgBase = resolve(import.meta.dir, "../../warchest_playmat_base.svg");

/** Hexágono mínimo que el parser reconoce (mismos atributos que el playmat). */
function hexagon(id: string, cx: number, cy: number, stroke: string): string {
  return [
    "  <path",
    '     sodipodi:type="star"',
    `     style="opacity:1;stroke:${stroke};stroke-width:9"`,
    `     id="${id}"`,
    '     sodipodi:sides="6"',
    `     sodipodi:cx="${cx}"`,
    `     sodipodi:cy="${cy}"`,
    '     d="m 0,0 z" />',
  ].join("\n");
}

/** Escribe un SVG inválido en un archivo temporal y lo limpia al terminar. */
async function assertLoadRejects(svg: string, message: RegExp): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "warchest-loader-"));
  const file = join(dir, "invalid.svg");
  try {
    await writeFile(file, svg);
    await expect(new SVGBoardLoader(file).load()).rejects.toThrow(message);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const ID_RE = /^[A-G](?:1[0-2]|[0-9])$/;

async function loadPlaymat(path: string): Promise<Board> {
  return new SVGBoardLoader(path).load();
}

describe("SVGBoardLoader", () => {
  test("carga las 37 casillas del tablero 1v1 (33 verdes + 4 bases)", async () => {
    const board = await loadPlaymat(svg1v1);
    expect(board.size).toBe(37);

    const greens = board.getAllNodes().filter((n) => n.startZone === undefined);
    const bases = board.getAllNodes().filter((n) => n.startZone !== undefined);
    expect(greens).toHaveLength(33);
    expect(bases).toHaveLength(4);
  });

  test("el playmat base produce el mismo tablero (los colores ajenos se ignoran)", async () => {
    const fromCleaned = await loadPlaymat(svg1v1);
    const fromBase = await loadPlaymat(svgBase);
    expect(fromBase.size).toBe(fromCleaned.size);

    for (const node of fromCleaned.getAllNodes()) {
      const baseNode = fromBase.getNode(node.id);
      expect(baseNode, `casilla ${node.id} debe existir en el playmat base`).toBeDefined();
      expect(baseNode!.startZone).toBe(node.startZone);
      expect(baseNode!.neighbors).toEqual(node.neighbors);
    }
  });

  test("ids únicos con formato de rejilla A0–G12", async () => {
    const board = await loadPlaymat(svg1v1);
    const ids = board.getAllNodes().map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(ID_RE);
    }
  });

  test("bases: amarillas arriba = player1, moradas abajo = player2", async () => {
    const board = await loadPlaymat(svg1v1);
    expect(board.getStartLocations("player1")).toEqual(["C1", "F2"]);
    expect(board.getStartLocations("player2")).toEqual(["B10", "E11"]);

    const c1 = board.getNode("C1")!;
    const b10 = board.getNode("B10")!;
    expect([c1.x, c1.y]).toEqual([1576.8066, 405.69623]);
    expect([b10.x, b10.y]).toEqual([1353.6133, 1565.443]);
  });

  test("el centro del tablero es D6 con sus 6 vecinos", async () => {
    const board = await loadPlaymat(svg1v1);
    const center = board.getNode("D6")!;
    expect([center.x, center.y]).toEqual([1800, 1050]);
    expect(center.neighbors).toEqual(["C5", "C7", "D4", "D8", "E5", "E7"]);
  });

  test("adyacencia correcta en los bordes", async () => {
    const board = await loadPlaymat(svg1v1);
    // Esquina superior central (adyacente a la base amarilla C1) y su pareja inferior.
    expect(board.getNeighbors("D0")).toEqual(["C1", "D2", "E1"]);
    expect(board.getNeighbors("D12")).toEqual(["C11", "D10", "E11"]);
    // Una esquina del ala izquierda (A3) tiene 3 vecinos.
    expect(board.getNeighbors("A3")).toEqual(["A5", "B2", "B4"]);
  });

  test("adyacencia simétrica, sin auto-vecinos y con casillas existentes", async () => {
    const board = await loadPlaymat(svg1v1);
    for (const node of board.getAllNodes()) {
      expect(node.neighbors.length).toBeGreaterThanOrEqual(2);
      expect(node.neighbors.length).toBeLessThanOrEqual(6);
      expect(node.neighbors).not.toContain(node.id);
      for (const neighbor of node.neighbors) {
        expect(neighbor).toMatch(ID_RE);
        const neighborNode = board.getNode(neighbor)!;
        expect(neighborNode.neighbors).toContain(node.id);
      }
    }
  });

  test("load() rechaza un playmat con cantidad inválida de casillas", async () => {
    const svg = [
      hexagon("g1", 100, 100, "#8fff91"),
      hexagon("g2", 300, 100, "#8fff91"),
      hexagon("y1", 500, 100, "#ffff00"),
      hexagon("y2", 700, 100, "#ffff00"),
      hexagon("p1", 900, 100, "#9696ff"),
      hexagon("p2", 1100, 100, "#9696ff"),
    ].join("\n");
    await assertLoadRejects(
      `<svg>\n${svg}\n</svg>`,
      /Se esperaban 33 casillas verdes \+ 2 amarillas \+ 2 moradas/,
    );
  });

  test("load() rechaza un playmat con cantidad inválida de bases", async () => {
    const greens = Array.from(
      { length: 33 },
      (_, i) => hexagon(`g${i}`, 100 + i * 80, 100, "#8fff91"),
    );
    const svg = [
      ...greens,
      hexagon("y1", 100, 900, "#ffff00"),
      hexagon("p1", 300, 900, "#9696ff"),
    ].join("\n");
    await assertLoadRejects(
      `<svg>\n${svg}\n</svg>`,
      /Se esperaban 33 casillas verdes \+ 2 amarillas \+ 2 moradas/,
    );
  });
});

describe("parseSvgPathElements", () => {
  test("extrae hexágonos con atributos en varias líneas y en cualquier orden", () => {
    const svg = [
      "<svg>",
      "  <path",
      "     sodipodi:type=\"star\"",
      "     style=\"opacity:1;stroke:#8fff91;stroke-width:9\"",
      "     id=\"p1\"",
      "     sodipodi:sides=\"6\"",
      "     sodipodi:cx=\"1130.4199\"",
      "     sodipodi:cy=\"663.41779\"",
      "     d=\"m 0,0 z\" />",
      "  <path id=\"p2\" style=\"stroke:#8fffff\" d=\"m 1,1 z\" />",
      "</svg>",
    ].join("\n");

    const elements = parseSvgPathElements(svg);
    expect(elements).toHaveLength(2);

    expect(elements[0]).toMatchObject({
      id: "p1",
      isHexagon: true,
      stroke: "#8fff91",
      cx: 1130.4199,
      cy: 663.41779,
    });
    expect(elements[1]).toMatchObject({ id: "p2", isHexagon: false, stroke: "#8fffff" });
  });
});
