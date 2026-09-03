/**
 * hex-board.ts — tablero nativo de hexágonos coloreados para la TUI.
 *
 * Reproduce el MISMO render que `bun run render` (src/scripts/
 * render-board-terminal.ts) pero con primitivas de OpenTUI: cada carácter de
 * terminal se pinta con medio-bloque `▀` (fg = muestra superior, bg = muestra
 * inferior), de modo que cada fila lógica dobla la resolución vertical.
 *
 * La geometría sale de las mismas casillas del board compuesto
 * (`assets/board/board-1v1.svg`, clasificadas con
 * `classifyComposedBoardLocations`), mapeadas con escala UNIFORME desde la
 * región recortada `BOARD_CROP` hasta el lienzo de celdas elegido. Así las
 * casillas conservan su proporción real (igual que en el playmat físico y en
 * `bun run render`), a diferencia del PNG que se estiraba con fit=fill.
 *
 * El lienzo se calcula para llenar el área disponible (casillas grandes,
 * márgenes de mesa mínimos); la escala rellena la dimensión limitante y la
 * otra se centra con margen de mesa.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { classifyComposedBoardLocations } from "../infrastructure/terrain.ts";
import type { BoardLocation, TerrainName } from "../infrastructure/terrain.ts";
import { BOARD_CROP } from "./board-geometry.ts";

const BOARD_SVG_PATH = resolve(import.meta.dir, "..", "..", "assets", "board", "board-1v1.svg");
/** Color de fondo de la mesa (mismo que el fondo de la app). */
export const HEX_TABLE = "#0d1526";
/** Color de las casillas verdes normales (igual que el playmat). */
export const HEX_NORMAL = "#8fff91";
export const HEX_LOBOS = "#ffff00";
export const HEX_CUERVOS = "#9696ff";

/** Mezcla lineal como hace render-board-terminal para las bases sin conquistar. */
function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const rgb = [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ];
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** RGB de un color #rrggbb. */
function parseHex(color: string): [number, number, number] {
  const hex = color.replace("#", "");
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

/** Mezcla un color #rrggbb hacia la MESA (para oscurecer lo no jugable). */
export function dimHex(color: string): string {
  return mix(parseHex(color), [0x0d, 0x15, 0x26], 0.6);
}

/** Mezcla un color #rrggbb hacia el BLANCO (resplandor de la casilla objetivo). */
export function glowHex(color: string, amount = 0.3): string {
  return mix(parseHex(color), [0xff, 0xff, 0xff], amount);
}

/** Color de una casilla según su terreno (idéntico a bun run render). */
export function hexTerrainColor(terrain: TerrainName): string {
  if (terrain === "base-neutral") return mix([0x8f, 0xff, 0x91], [0x0d, 0x15, 0x26], 0.45);
  if (terrain === "base-lobos") return HEX_LOBOS;
  if (terrain === "base-cuervos") return HEX_CUERVOS;
  return HEX_NORMAL;
}

/** Contracción de las casillas para que se vea la mesa entre hexágonos. */
const CELL_SCALE = 0.88;
/** Grosor del anillo de selección (distancia Chebyshev en píxeles lógicos). */
const RING_DISTANCE = 2;
/** Origen del reticulado en px SVG (constante real, sin redondear). */
const r1 = 136.89194;
const r2 = 118.55189;

/** Hexágono flat-sided (puntas a los lados) centrado en (cx, cy). */
function hexagonVertices(cx: number, cy: number, rx: number, ry: number): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    points.push([cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]);
  }
  return points;
}

/** ¿El punto está dentro del polígono? (ray casting) */
function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Una secuencia continua de celdas con el mismo estilo (para menos spans). */
export interface HexRun { text: string; fg: string; bg: string; }
export type HexLine = readonly HexRun[];

/** Ancla (en celdas de terminal) del centro de una casilla. */
export interface HexAnchor { col: number; row: number; }

export interface HexBoardLayout {
  /** Lienzo en celdas de terminal. */
  cols: number;
  rows: number;
  /** Líneas de color del tablero (una por fila de terminal). */
  lines: readonly HexLine[];
  /** Centro de cada casilla A0–G12 en celdas del lienzo. */
  centers: ReadonlyMap<string, HexAnchor>;
  /** Tamaño en celdas de la MONEDA (círculo inscrito en el hexágono). */
  coin: { width: number; height: number };
  /** Casillas en el orden de los índices de `samples` (37, una por polígono). */
  locations: readonly BoardLocation[];
  /** Índice de casilla por píxel lógico (x + y·cols), -1 = mesa. */
  samples: Int16Array;
  /** Índice de casilla cuyo "halo" (borde exterior) pisa ese píxel, -1 = sin halo. */
  ring: Int16Array;
}

const locationsCache: readonly BoardLocation[] = await readFile(BOARD_SVG_PATH, "utf8")
  .then((svg) => classifyComposedBoardLocations(svg));

/** Las 37 casillas del board compuesto (leídas del SVG una sola vez). */
export function boardLocations(): readonly BoardLocation[] {
  return locationsCache;
}

const layoutCache = new Map<string, HexBoardLayout>();

/**
 * Construye el render del tablero para un lienzo de `cols`×`rows` celdas.
 * Con `flip` (por defecto: rival arriba cuando juega player1) el tablero se
 * invierte verticalmente: las bases del jugador actual quedan ABAJO y las
 * del rival ARRIBA, para jugar siempre desde tu propia perspectiva. El
 * resultado depende solo del tamaño y del flip, así que se cachea.
 */
export function hexBoardLayout(cols: number, rows: number, flip = false): HexBoardLayout {
  const key = `${cols}x${rows}${flip ? "f" : ""}`;
  const cached = layoutCache.get(key);
  if (cached !== undefined) return cached;

  const locs = boardLocations();
  const logicalCols = Math.max(1, cols);
  const logicalRows = Math.max(1, rows * 2);
  /** Espeja una fila lógica: con flip la fila 0 del SVG pasa abajo. */
  const flipY = (y: number): number => (flip ? logicalRows - 1 - y : y);

  // Escala uniforme que hace caber la región recortada (sin deformar).
  const scale = Math.max(BOARD_CROP.width / logicalCols, BOARD_CROP.height / logicalRows);
  const bw = BOARD_CROP.width / scale;
  const bh = BOARD_CROP.height / scale;
  const ox = (logicalCols - bw) / 2;
  const oy = (logicalRows - bh) / 2;

  // Hexágonos en el espacio de píxel lógico del lienzo (0..cols × 0..rows*2).
  const rx = (r1 * CELL_SCALE) / scale;
  const ry = (r2 * CELL_SCALE) / scale;
  const polygons = locs.map((loc) => ({
    loc,
    vertices: hexagonVertices(ox + (loc.cx - BOARD_CROP.x) / scale, oy + (loc.cy - BOARD_CROP.y) / scale, rx, ry),
  }));

  // Marcar qué píxel lógico pertenece a cada casilla.
  const width = logicalCols;
  const height = logicalRows;
  const fill = new Int16Array(width * height).fill(-1);
  for (let p = 0; p < polygons.length; p++) {
    const { vertices } = polygons[p]!;
    const x0 = Math.max(0, Math.floor(Math.min(...vertices.map(([x]) => x))));
    const x1 = Math.min(width - 1, Math.ceil(Math.max(...vertices.map(([x]) => x))));
    const y0 = Math.max(0, Math.floor(Math.min(...vertices.map(([, y]) => y))));
    const y1 = Math.min(height - 1, Math.ceil(Math.max(...vertices.map(([, y]) => y))));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (pointInPolygon(x, y, vertices)) fill[flipY(y) * width + x] = p;
      }
    }
  }

  // Índices por píxel lógico (los usa `hexLineRuns` para recolorear).
  const samples = fill;

  // Halo: cada píxel de MESA a distancia Chebyshev ≤ 2 del borde de una
  // casilla se marca con el índice de la casilla más cercana. Sirve para
  // pintar un anillo exterior visible alrededor del hexágono seleccionado
  // sin tocar el interior de las vecinas (solo ocupa mesa).
  const ring = new Int16Array(width * height).fill(-1);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (samples[y * width + x] !== -1) continue;
      let owner = -1;
      let bestDistance = RING_DISTANCE + 1;
      for (let dy = -RING_DISTANCE; dy <= RING_DISTANCE; dy++) {
        for (let dx = -RING_DISTANCE; dx <= RING_DISTANCE; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbour = samples[ny * width + nx] ?? -1;
          if (neighbour === -1) continue;
          const distance = Math.max(Math.abs(dx), Math.abs(dy));
          if (distance < bestDistance) {
            bestDistance = distance;
            owner = neighbour;
            if (distance === 1) break;
          }
        }
        if (bestDistance === 1) break;
      }
      if (owner !== -1) ring[y * width + x] = owner;
    }
  }

  // Líneas por defecto (colores reales del playmat).
  const lines = hexLineRunsFromSamples(samples, ring, width, rows, (index) =>
    index === -1 ? HEX_TABLE : hexTerrainColor(polygons[index]!.loc.terrain));

  // Centros de casilla (celdas de terminal) para colocar los overlays.
  // Con flip se espejan también (las bases de arriba pasan abajo).
  const centers = new Map<string, HexAnchor>();
  for (const loc of locs) {
    centers.set(loc.id, {
      col: Math.round(ox + (loc.cx - BOARD_CROP.x) / scale),
      row: Math.round(flipY(oy + (loc.cy - BOARD_CROP.y) / scale) / 2),
    });
  }

  // Moneda = círculo inscrito en el hexágono (diámetro = distancia entre
  // caras planas √3·r2 ≈ 205.3 px SVG). Se dibuja redonda con ancho PAR
  // (para que media altura de caja = ancho/2 deje la moneda 1:1).
  const coinDiameter = Math.sqrt(3) * r2;
  const coinWidth = 2 * Math.max(2, Math.round((coinDiameter / scale) / 2));
  const layout: HexBoardLayout = {
    cols: logicalCols,
    rows,
    lines,
    centers,
    coin: { width: coinWidth, height: coinWidth / 2 },
    locations: locs,
    samples,
    ring,
  };
  layoutCache.set(key, layout);
  return layout;
}

/** Convierte los samples de un layout a líneas de celdas (▀ = mitades). */
function hexLineRunsFromSamples(samples: Int16Array, ring: Int16Array, width: number, rows: number, colorOf: (index: number, ringOwner?: number, sampleIndex?: number) => string): HexLine[] {
  const lines: HexLine[] = [];
  for (let row = 0; row < rows; row++) {
    const runs: HexRun[] = [];
    let run: { text: string; fg: string; bg: string } | undefined;
    for (let col = 0; col < width; col++) {
      const topSample = (row * 2) * width + col;
      const bottomSample = (row * 2 + 1) * width + col;
      const topIdx = samples[topSample] ?? -1;
      const bottomIdx = samples[bottomSample] ?? -1;
      const topRing = ring[topSample] ?? -1;
      const bottomRing = ring[bottomSample] ?? -1;
      const topColor = colorOf(topIdx, topRing >= 0 ? topRing : undefined, topSample);
      const bottomColor = colorOf(bottomIdx, bottomRing >= 0 ? bottomRing : undefined, bottomSample);
      const glyph = topIdx === -1 && bottomIdx === -1 ? " " : "▀";
      const fg = topIdx === -1 && bottomIdx === -1 ? HEX_TABLE : topColor;
      const bg = topIdx === -1 && bottomIdx === -1 ? HEX_TABLE : bottomColor;
      if (run === undefined || run.fg !== fg || run.bg !== bg) {
        run = { text: glyph, fg, bg };
        runs.push(run);
      } else {
        run.text += glyph;
      }
    }
    lines.push(runs);
  }
  return lines;
}

/**
 * Recolorea el tablero de un layout ya calculado: `colorOf(index, ringOwner?, sampleIndex?)`
 * recibe el índice de casilla del sample (−1 = mesa), el dueño del halo de
 * ese píxel (si es el borde exterior de una casilla) y el índice del propio
 * píxel lógico. Se usa para oscurecer lo no jugable, hacer brillar los
 * objetivos y pintar el anillo de selección alrededor del hexágono elegido.
 */
export function hexLineRuns(layout: HexBoardLayout, colorOf: (index: number, ringOwner?: number, sampleIndex?: number) => string): HexLine[] {
  return hexLineRunsFromSamples(layout.samples, layout.ring, layout.cols, layout.rows, colorOf);
}

/**
 * Máscara del anillo de selección de una casilla: 1 en los píxeles de MESA a
 * distancia Chebyshev ≤ `RING_DISTANCE` de SU borde (sin depender de quién
 * sea el vecino más cercano), para que el halo rodee el hexágono completo.
 */
export function hexRingMask(layout: HexBoardLayout, locIndex: number): Uint8Array {
  const { samples, cols, rows } = layout;
  const height = rows * 2;
  const mask = new Uint8Array(samples.length);
  const mark = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= cols || y >= height) return;
    const idx = y * cols + x;
    if (samples[idx] === -1) mask[idx] = 1;
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < cols; x++) {
      const idx = y * cols + x;
      if (samples[idx] !== locIndex) continue;
      for (let dy = -RING_DISTANCE; dy <= RING_DISTANCE; dy++) {
        for (let dx = -RING_DISTANCE; dx <= RING_DISTANCE; dx++) {
          if (dx === 0 && dy === 0) continue;
          mark(x + dx, y + dy);
        }
      }
    }
  }
  return mask;
}

/** Filas de terminal reservadas debajo/encima del tablero (zona de descarte, mano/menú, mensajes y ayudas). */
const RESERVED_ROWS = 18;

/** Máximo alto del lienzo en filas de terminal. */
const MAX_ROWS = 32;

/**
 * Lienzo del tablero (celdas de terminal) para un terminal dado: llena el
 * área disponible sin deformar las casillas (ancho derivado de la proporción
 * real 1632:1802 de la región del tablero, media altura de celda).
 */
export function hexBoardCanvas(size: { width: number; height: number }): { cols: number; rows: number } {
  const rows = Math.max(14, Math.min(MAX_ROWS, size.height - RESERVED_ROWS));
  const cols = Math.max(24, Math.min(size.width, Math.round((rows * 2 * BOARD_CROP.width) / BOARD_CROP.height)));
  return { cols, rows };
}
