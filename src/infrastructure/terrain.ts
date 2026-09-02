/**
 * Clasificación de terrenos del tablero 1v1, compartida entre los scripts de
 * assets (`build-terrain-svgs.ts`, `build-board-from-terrain.ts`) y el
 * renderer de terminal (`render-board-terminal.ts`).
 *
 * El playmat distingue las bases con un hexágono pequeño interior (marcador):
 *  - normal: casilla verde SIN marcador (movimiento de tropas).
 *  - base-neutral: casilla verde CON marcador (base sin conquistar).
 *  - base-lobos: casilla amarilla (conquistada por los lobos).
 *  - base-cuervos: casilla morada (conquistada por los cuervos).
 */

import { parseSvgPathElements } from "./svg-parse.ts";

export type TerrainName = "normal" | "base-neutral" | "base-lobos" | "base-cuervos";

export const GREEN = "#8fff91";
export const YELLOW = "#ffff00";
export const PURPLE = "#9696ff";

export const TERRAIN_FILE: Record<TerrainName, string> = {
  normal: "terrain-normal.svg",
  "base-neutral": "terrain-base-neutral.svg",
  "base-lobos": "terrain-base-lobos.svg",
  "base-cuervos": "terrain-base-cuervos.svg",
};

/** Símbolo de cada terreno para el mapa ASCII de la terminal. */
export const TERRAIN_SYMBOL: Record<TerrainName, string> = {
  normal: ".",
  "base-neutral": "o",
  "base-lobos": "L",
  "base-cuervos": "C",
};

/** Las casillas tienen r1 ≈ 136.9; los marcadores interiores r1 ≈ 68. */
const CELL_RADIUS_THRESHOLD = 100;
/** Distancia marcador → casilla que lo contiene (en el SVG, < 6 px). */
const MATCH_PX = 6;

export interface BoardLocation {
  /** Id de rejilla A0–G12 (igual que el dominio). */
  id: string;
  cx: number;
  cy: number;
  /** Color de trazo de la casilla (verde/amarillo/morado en minúsculas). */
  stroke: string;
  terrain: TerrainName;
}

const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/** Terreno según color de trazo de la casilla y presencia de marcador interior. */
export function terrainOf(stroke: string, hasMarker: boolean): TerrainName {
  if (stroke === GREEN) return hasMarker ? "base-neutral" : "normal";
  if (stroke === YELLOW) return "base-lobos";
  if (stroke === PURPLE) return "base-cuervos";
  throw new Error(`Color de casilla inesperado: ${stroke}`);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

interface CellWithCenter {
  cx: number;
  cy: number;
  stroke: string;
  /** Marcador interior (hexágono pequeño) dentro de este radio; undefined si no hay. */
  markerCx?: number;
  markerCy?: number;
}

/** Asigna ids de rejilla A0–G12 por columna (x) y fila (y) ordenadas. */
function withGridIds<T extends CellWithCenter>(cells: T[]): Array<T & { id: string }> {
  const columns = [...new Set(cells.map((c) => round1(c.cx)))].sort((a, b) => a - b);
  const rows = [...new Set(cells.map((c) => round1(c.cy)))].sort((a, b) => a - b);
  return cells.map((cell) => {
    const col = columns.indexOf(round1(cell.cx));
    const row = rows.indexOf(round1(cell.cy));
    if (col < 0 || row < 0 || col > 6) {
      throw new Error(`Casilla fuera de la rejilla A0–G12: (${cell.cx}, ${cell.cy})`);
    }
    return { ...cell, id: `${String.fromCharCode(65 + col)}${row}` };
  });
}

/** Clasifica una casilla (por color + marcador) en su terreno. */
function toLocation(cell: CellWithCenter & { id: string }): BoardLocation {
  return {
    id: cell.id,
    cx: cell.cx,
    cy: cell.cy,
    stroke: cell.stroke,
    terrain: terrainOf(cell.stroke, cell.markerCx !== undefined && cell.markerCy !== undefined),
  };
}

/**
 * Clasifica las 37 casillas del tablero 1v1 de un SVG de playmat en su
 * terreno. Requiere exactamente 37 casillas grandes (r1 > 100); los hexágonos
 * pequeños se toman como marcadores de base.
 */
export function classifyBoardLocations(svg: string): BoardLocation[] {
  const elements = parseSvgPathElements(svg);
  const cells = elements.filter(
    (h) => h.isHexagon && h.r1 !== undefined && h.r1 > CELL_RADIUS_THRESHOLD && h.cx !== undefined && h.cy !== undefined,
  );
  if (cells.length !== 37) {
    throw new Error(`Se esperaban 37 casillas, hay ${cells.length}.`);
  }

  const markers = elements.filter((m) => m.isHexagon && m.r1 !== undefined && m.r1 <= CELL_RADIUS_THRESHOLD);

  const withCenter: CellWithCenter[] = cells.map((cell) => {
    const cx = cell.cx!;
    const cy = cell.cy!;
    const marker = markers.find((m) => distance(m.cx!, m.cy!, cx, cy) <= MATCH_PX);
    return {
      cx,
      cy,
      stroke: cell.stroke!,
      markerCx: marker?.cx,
      markerCy: marker?.cy,
    };
  });

  return withGridIds(withCenter).map(toLocation);
}

/**
 * Clasifica las 37 casillas del board compuesto **desde los tiles de terreno**
 * (`assets/board/board-1v1.svg`): cada casilla vive en un
 * `<g id="cell-*" transform="translate(dx dy)">` y sus paths conservan las
 * coordenadas del TILE (el ancla), no las del playmat. El centro renderizado
 * = centro del path + (dx, dy) del grupo.
 */
export function classifyComposedBoardLocations(svg: string): BoardLocation[] {
  const cellGroupRe = /<g\s+id="cell-([^"]+)"[^>]*transform="translate\(([^ )]+) ([^ )]+)\)[^"]*"[^>]*>([\s\S]*?)<\/g>/g;
  const matches = [...svg.matchAll(cellGroupRe)];
  if (matches.length !== 37) {
    throw new Error(`Se esperaban 37 grupos cell-* en el board compuesto, hay ${matches.length}.`);
  }

  const locations: BoardLocation[] = matches.map((match) => {
    const dx = Number.parseFloat(match[2]!);
    const dy = Number.parseFloat(match[3]!);
    const inner = parseSvgPathElements(match[4]!);
    const big = inner.find(
      (h) => h.isHexagon && h.r1 !== undefined && h.r1 > CELL_RADIUS_THRESHOLD && h.cx !== undefined && h.cy !== undefined,
    );
    if (big === undefined) {
      throw new Error(`El grupo cell-${match[1]} no contiene un hexágono grande.`);
    }

    const cx = big.cx! + dx;
    const cy = big.cy! + dy;
    const marker = inner.find(
      (h) => h.isHexagon && h.r1 !== undefined && h.r1 <= CELL_RADIUS_THRESHOLD && h.cx !== undefined && h.cy !== undefined,
    );
    const markerDist =
      marker === undefined
        ? Infinity
        : distance(marker.cx! + dx, marker.cy! + dy, cx, cy);

    const cell: CellWithCenter & { id: string } = {
      id: match[1]!,
      cx,
      cy,
      stroke: big.stroke!,
      markerCx: markerDist <= MATCH_PX ? (marker?.cx ?? 0) + dx : undefined,
      markerCy: markerDist <= MATCH_PX ? (marker?.cy ?? 0) + dy : undefined,
    };
    return toLocation(cell);
  });

  // El orden de los grupos es el del archivo; devolver en orden de rejilla
  // (como classifyBoardLocations) para que los rótulos sean estables.
  return locations.sort((a, b) => (a.cy === b.cy ? a.cx - b.cx : a.cy - b.cy));
}