/**
 * Carga el tablero 1v1 desde el board compuesto programáticamente
 * (`assets/board/board-1v1.svg`, generado por `build-board-from-terrain.ts`
 * a partir de los tiles de `assets/terrain/`).
 *
 * El board compuesto es la fuente de verdad del tablero (decisión del ciclo
 * 2, ver DECISIONS.md): cada casilla vive en un `<g id="cell-*">` con su
 * id de rejilla A0–G12 ya asignado y los paths en coordenadas absolutas del
 * tile (centro renderizado = centro del path + translate del grupo). La
 * clasificación de terrenos (color + marcador interior) la hace
 * `classifyComposedBoardLocations`, que devuelve 37 casillas con su terreno.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Board, BoardNode } from "../domain/board.ts";
import type { BoardLoader } from "./board-loader.ts";
import { classifyComposedBoardLocations } from "./terrain.ts";
import type { BoardLocation } from "./terrain.ts";

/** Margen para considerar dos casillas adyacentes (distancia mínima entre centros de la rejilla). */
const ADJACENCY_EPSILON = 1.05;

/** Archivo del que se carga el tablero (generado por `bun run board-terrain`). */
export const DEFAULT_BOARD_PATH = "assets/board/board-1v1.svg";

/** Conteos esperados de terreno en el tablero 1v1 (ver DECISIONS.md). */
const EXPECTED_TERRAIN_COUNTS: Readonly<Partial<Record<BoardLocation["terrain"], number>>> = {
  normal: 27,
  "base-neutral": 6,
  "base-lobos": 2,
  "base-cuervos": 2,
};

/**
 * Carga el tablero 1v1 desde el board SVG compuesto
 * (`assets/board/board-1v1.svg`). Solo se cargan las 37 casillas de la zona
 * 1v1, con su terreno ya clasificado; la adyacencia se calcula por geometría
 * (distancia mínima entre centros).
 */
export class SVGBoardLoader implements BoardLoader {
  private readonly filePath: string;

  constructor(filePath: string = resolve(import.meta.dir, "..", "..", DEFAULT_BOARD_PATH)) {
    this.filePath = filePath;
  }

  async load(): Promise<Board> {
    const svg = await readFile(this.filePath, "utf8");
    const locations = classifyComposedBoardLocations(svg);

    assertExpectedTerrain(locations);
    const adjacency = computeAdjacency(locations);

    const nodes = locations.map((location) => {
      return new BoardNode({
        id: location.id,
        x: location.cx,
        y: location.cy,
        neighbors: adjacency.get(location) ?? [],
        terrain: location.terrain,
      });
    });

    return new Board(nodes);
  }
}

/** El board compuesto debe tener exactamente los terrenos esperados del 1v1. */
function assertExpectedTerrain(locations: BoardLocation[]): void {
  const actual = new Map<BoardLocation["terrain"], number>();
  for (const location of locations) {
    actual.set(location.terrain, (actual.get(location.terrain) ?? 0) + 1);
  }
  for (const [terrain, expected] of Object.entries(EXPECTED_TERRAIN_COUNTS) as [
    BoardLocation["terrain"],
    number,
  ][]) {
    const count = actual.get(terrain) ?? 0;
    if (count !== expected) {
      throw new Error(
        `Conteo de terreno inválido en el board compuesto: ${terrain} = ${count}, se esperaban ${expected}. `
        + `¿Es correcto assets/board/board-1v1.svg?`,
      );
    }
  }
}

/**
 * Adyacencia por geometría: dos casillas son vecinas si la distancia entre
 * sus centros es la distancia mínima de la rejilla (con margen del 5 %).
 * La rejilla es regular, así que todas las casillas adyacentes comparten la
 * misma distancia (~257.7 px) claramente menor que las no adyacentes.
 */
function computeAdjacency(locations: BoardLocation[]): Map<BoardLocation, BoardLocation["id"][]> {
  let minDistance = Infinity;
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const a = locations[i]!;
      const b = locations[j]!;
      minDistance = Math.min(minDistance, Math.hypot(a.cx - b.cx, a.cy - b.cy));
    }
  }

  const adjacency = new Map<BoardLocation, BoardLocation["id"][]>();
  const threshold = minDistance * ADJACENCY_EPSILON;
  for (const location of locations) {
    const neighbors = locations
      .filter(
        (other) =>
          other !== location && Math.hypot(other.cx - location.cx, other.cy - location.cy) <= threshold,
      )
      .map((other) => other.id)
      .sort();
    adjacency.set(location, neighbors);
  }
  return adjacency;
}
