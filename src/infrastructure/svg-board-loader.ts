import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Board, BoardNode } from "../domain/board.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import type { BoardLoader } from "./board-loader.ts";
import { parseSvgPathElements } from "./svg-parse.ts";
import type { SvgPathElement } from "./svg-parse.ts";

/** Colores de los hexágonos que componen el tablero 1v1 en el playmat. */
const LOCATION_COLORS = new Set(["#8fff91", "#ffff00", "#9696ff"]);

/**
 * Mapa color de base → jugador. Los 2 hexágonos amarillos (arriba en el
 * playmat) son la base de `player1`; los 2 morados (abajo) la de `player2`.
 * Asunción documentada en DECISIONS.md (fácil de cambiar aquí).
 */
const BASE_COLOR_TO_PLAYER: Readonly<Record<string, PlayerId>> = {
  "#ffff00": "player1",
  "#9696ff": "player2",
};

/** El SVG dibuja cada casilla dos veces (grande + decorativo pequeño a <1 px); umbral para deduplicar. */
const DEDUPE_TOLERANCE_PX = 3;

/** Margen para considerar dos casillas adyacentes (distancia mínima entre centros de la rejilla). */
const ADJACENCY_EPSILON = 1.05;

/** Archivo del que se carga el tablero (generado por `bun run board`). */
export const DEFAULT_PLAYMAT_PATH = "warchest_playmat_1v1.svg";

/** Casilla del tablero ya validada (con centro y color de trazo). */
interface Location {
  cx: number;
  cy: number;
  stroke: string;
}

/**
 * Carga el tablero 1v1 desde el playmat SVG limpio
 * (`warchest_playmat_1v1.svg`, ver `src/scripts/build-playmat-1v1.ts`).
 *
 * Solo se tienen en cuenta los hexágonos de la zona 1v1: verdes (#8fff91,
 * casillas normales) y las 4 bases de jugadores (#ffff00 y #9696ff). Las
 * casillas se identifican con ids de rejilla `A0`–`G12` y la adyacencia se
 * calcula por geometría (distancia mínima entre centros).
 */
export class SVGBoardLoader implements BoardLoader {
  private readonly filePath: string;

  constructor(filePath: string = resolve(process.cwd(), DEFAULT_PLAYMAT_PATH)) {
    this.filePath = filePath;
  }

  async load(): Promise<Board> {
    const svg = await readFile(this.filePath, "utf8");
    const locations = dedupeByCenter(
      parseSvgPathElements(svg)
        .filter(isLocationHexagon)
        .map((element) => ({ cx: element.cx!, cy: element.cy!, stroke: element.stroke! })),
    );

    assertExpectedBoard(locations);

    const ids = buildGridIds(locations);
    const adjacency = computeAdjacency(locations, ids);

    const nodes = locations.map((location) => {
      const id = ids.get(location);
      if (id === undefined) {
        throw new Error(`Casilla sin id asignado: (${location.cx}, ${location.cy})`);
      }
      return new BoardNode({
        id,
        x: location.cx,
        y: location.cy,
        neighbors: adjacency.get(location) ?? [],
        startZone: BASE_COLOR_TO_PLAYER[location.stroke],
      });
    });

    return new Board(nodes);
  }
}

function isLocationHexagon(element: SvgPathElement): boolean {
  return (
    element.isHexagon
    && element.stroke !== undefined
    && element.cx !== undefined
    && element.cy !== undefined
    && LOCATION_COLORS.has(element.stroke)
  );
}

/** El SVG dibuja cada casilla dos veces (grande en la capa Board + decorativo pequeño en Symbols); se queda con la primera. */
function dedupeByCenter(locations: Location[]): Location[] {
  const kept: Location[] = [];
  for (const location of locations) {
    const duplicated = kept.some(
      (other) => Math.hypot(other.cx - location.cx, other.cy - location.cy) <= DEDUPE_TOLERANCE_PX,
    );
    if (!duplicated) {
      kept.push(location);
    }
  }
  return kept;
}

/** El tablero 1v1 del playmat tiene exactamente 33 casillas verdes + 4 bases (2 amarillas, 2 moradas). */
function assertExpectedBoard(locations: Location[]): void {
  const greens = locations.filter((l) => l.stroke === "#8fff91").length;
  const yellows = locations.filter((l) => l.stroke === "#ffff00").length;
  const purples = locations.filter((l) => l.stroke === "#9696ff").length;
  if (greens !== 33 || yellows !== 2 || purples !== 2) {
    throw new Error(
      `Se esperaban 33 casillas verdes + 2 amarillas + 2 moradas en el tablero 1v1, `
      + `pero se obtuvieron ${greens} verdes, ${yellows} amarillas y ${purples} moradas. `
      + `¿Es correcto warchest_playmat_1v1.svg?`,
    );
  }
}

/**
 * Asigna ids de rejilla (spec: letra + número): letra = columna A–G según
 * la x ordenada, número = fila 0–12 según la y ordenada. Ej.: el centro del
 * tablero (1800, 1050) es `D6`.
 */
function buildGridIds(locations: Location[]): Map<Location, Position> {
  const columns = [...new Set(locations.map((l) => round1(l.cx)))].sort((a, b) => a - b);
  const rows = [...new Set(locations.map((l) => round1(l.cy)))].sort((a, b) => a - b);

  const ids = new Map<Location, Position>();
  for (const location of locations) {
    const col = columns.indexOf(round1(location.cx));
    const row = rows.indexOf(round1(location.cy));
    if (col < 0 || row < 0 || col > 6) {
      throw new Error(`Casilla fuera de la rejilla A0–G12: (${location.cx}, ${location.cy})`);
    }
    const id = `${String.fromCharCode(65 + col)}${row}`;
    if ([...ids.values()].includes(id)) {
      throw new Error(`Id de casilla duplicado: ${id}`);
    }
    ids.set(location, id);
  }
  return ids;
}

/**
 * Adyacencia por geometría: dos casillas son vecinas si la distancia entre
 * sus centros es la distancia mínima de la rejilla (con margen del 5 %).
 * La rejilla es regular, así que todas las casillas adyacentes comparten la
 * misma distancia (~257.7 px) claramente menor que las no adyacentes.
 */
function computeAdjacency(locations: Location[], ids: Map<Location, Position>): Map<Location, Position[]> {
  let minDistance = Infinity;
  for (let i = 0; i < locations.length; i++) {
    for (let j = i + 1; j < locations.length; j++) {
      const a = locations[i]!;
      const b = locations[j]!;
      minDistance = Math.min(minDistance, Math.hypot(a.cx - b.cx, a.cy - b.cy));
    }
  }

  const adjacency = new Map<Location, Position[]>();
  const threshold = minDistance * ADJACENCY_EPSILON;
  for (const location of locations) {
    const neighbors = locations
      .filter(
        (other) =>
          other !== location && Math.hypot(other.cx - location.cx, other.cy - location.cy) <= threshold,
      )
      .map((other) => ids.get(other)!)
      .sort();
    adjacency.set(location, neighbors);
  }
  return adjacency;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
