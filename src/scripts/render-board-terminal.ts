/**
 * render-board-terminal.ts
 *
 * Renderiza el tablero 1v1 en la terminal como hexágonos de colores (ANSI
 * truecolor). No depende de rasterizadores externos: reconstruye la geometría
 * flat-sided de cada casilla a partir del playmat (`warchest_playmat_1v1.svg`
 * o el board compuesto `assets/board/board-1v1.svg`) y pinta cada celda de la
 * cuadrícula de terminal con el color del terreno usando medio-bloques Unicode
 * (▀) para el doble de resolución vertical.
 *
 * Es el render que usará el cliente TUI en ciclos posteriores (spec §7 →
 * "renderizado ASCII del tablero"), extraído aquí como script independiente.
 *
 * Uso:
 *   bun run render           # renderiza assets/board/board-1v1.svg (compuesto
 *                             # desde los tiles de terreno, build-board-from-
 *                             # terrain.ts). Ejecuta `bun run board-terrain`
 *                             # primero si el board aún no existe.
 *   bun run render --playmat # renderiza el playmat 1v1 original
 *   COLUMNS=140 bun run render   # ancho personalizado (default: ancho del TTY)
 */

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { classifyBoardLocations, classifyComposedBoardLocations } from "../infrastructure/terrain.ts";
import type { BoardLocation, TerrainName } from "../infrastructure/terrain.ts";

const projectRoot = resolve(import.meta.dir, "..", "..");

const PLAYMAT_1V1 = resolve(projectRoot, "warchest_playmat_1v1.svg");
const BOARD_TERRAIN = resolve(projectRoot, "assets", "board", "board-1v1.svg");
const BOARD_BUILD_SCRIPT = resolve(projectRoot, "src", "scripts", "build-board-from-terrain.ts");

/** Colores del terreno para el render (mismos que el playmat). */
const TERRAIN_COLOR: Record<TerrainName, [number, number, number]> = {
  normal: [0x8f, 0xff, 0x91], // #8fff91 verde
  "base-neutral": [0x8f, 0xff, 0x91], // verde (misma casilla, sin conquistar)
  "base-lobos": [0xff, 0xff, 0x00], // #ffff00 amarillo
  "base-cuervos": [0x96, 0x96, 0xff], // #9696ff morado
};

/** Color de fondo de la mesa. */
const TABLE_BG: [number, number, number] = [0x16, 0x1a, 0x26];

/**
 * Tamaño de una celda terminal en unidades de "píxel lógico": un carácter
 * (▀) cubre 1 columna × 2 filas lógicas, con aspecto ~1:2 (mitad de altura).
 */
const CELL_W = 1;
const CELL_H = 2;

/** Resolución horizontal del render en celdas de terminal. */
function desiredColumns(): number {
  const fromEnv = Number.parseInt(process.env.COLUMNS ?? "", 10);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return process.stdout.columns ?? 100;
}

/** Hexágono flat-sided (puntas a los lados) centrado en (cx, cy). */
function hexagonVertices(cx: number, cy: number, r1: number, r2: number): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  // Los vértices de un flat-sided: ángulos 0°, 60°, 120°, ... en pasos de 60°.
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    // radio en x = r1 (horizontal), radio en y = r2 (apotema).
    points.push([cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r2]);
  }
  return points;
}

/** ¿El punto está dentro del polígono? (ray casting) */
function pointInPolygon(x: number, y: number, polygon: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface RenderContext {
  /** Escala del espacio del playmat (3600×2100) a píxeles lógicos. */
  scaleX: number;
  scaleY: number;
  /** Mapa de píxel lógico (x, y) → terreno, solo donde hay casilla. */
  cells: Map<string, { location: BoardLocation; vertices: Array<[number, number]> }>;
}

/** Convierte un color [r,g,b] a secuencia ANSI truecolor del foreground. */
function fg(color: [number, number, number]): string {
  return `\x1b[38;2;${color[0]};${color[1]};${color[2]}m`;
}

/** Convierte un color [r,g,b] a secuencia ANSI truecolor del background. */
function bg(color: [number, number, number]): string {
  return `\x1b[48;2;${color[0]};${color[1]};${color[2]}m`;
}

const RESET = "\x1b[0m";

function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] * (1 - t) + b[0] * t),
    Math.round(a[1] * (1 - t) + b[1] * t),
    Math.round(a[2] * (1 - t) + b[2] * t),
  ];
}

/** Color de una casilla según terreno; las bases sin conquistar se atenúan para distinguirse del verde normal. */
function terrainColor(terrain: TerrainName): [number, number, number] {
  if (terrain === "base-neutral") {
    // Verde más apagado que las casillas normales.
    return mix(TERRAIN_COLOR.normal, TABLE_BG, 0.45);
  }
  return TERRAIN_COLOR[terrain];
}

function render(sourcePath: string): void {
  const svg = readFileSync(sourcePath, "utf8");
  // El board compuesto desde tiles (`assets/board/board-1v1.svg`) necesita
  // sumar el translate del grupo `cell-*` al centro del path; el playmat usa
  // coordenadas directas.
  const fromTiles = sourcePath === BOARD_TERRAIN;
  const locations = fromTiles ? classifyComposedBoardLocations(svg) : classifyBoardLocations(svg);

  const cols = desiredColumns();
  // Aspecto del playmat: 3600×2100 → alto = ancho × 2100/3600, y cada carácter
  // cubre 2 filas lógicas → filas = altoLógico / 2.
  const logicalWidth = cols * CELL_W;
  const logicalHeight = Math.round((logicalWidth * 2100) / 3600);
  const rows = Math.ceil(logicalHeight / CELL_H);

  const scaleX = 3600 / logicalWidth;
  const scaleY = 2100 / logicalHeight;

  // Precomputar hexágonos en espacio de píxel lógico. Se contraen al ~88 %
  // para que el fondo de la mesa quede visible entre casillas (el trazo de
  // 9 px del SVG se pierde a esta escala) y las casillas se distingan.
  const CELL_SCALE = 0.88;
  const hexes = locations.map((location) => ({
    location,
    vertices: hexagonVertices(
      location.cx / scaleX,
      location.cy / scaleY,
      (136.89194 * CELL_SCALE) / scaleX,
      (118.55189 * CELL_SCALE) / scaleY,
    ),
  }));

  const ctx: RenderContext = { scaleX, scaleY, cells: new Map() };
  for (const hex of hexes) {
    // Marcar qué píxel lógico pertenece a cada casilla.
    const x0 = Math.floor(Math.min(...hex.vertices.map(([x]) => x)));
    const x1 = Math.ceil(Math.max(...hex.vertices.map(([x]) => x)));
    const y0 = Math.floor(Math.min(...hex.vertices.map(([, y]) => y)));
    const y1 = Math.ceil(Math.max(...hex.vertices.map(([, y]) => y)));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (pointInPolygon(x, y, hex.vertices)) {
          ctx.cells.set(`${x},${y}`, hex);
        }
      }
    }
  }

  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const topY = row * CELL_H;
    const bottomY = topY + 1;
    let line = "";
    for (let col = 0; col < cols; col++) {
      const top = ctx.cells.get(`${col},${topY}`);
      const bottom = ctx.cells.get(`${col},${bottomY}`);

      if (top === undefined && bottom === undefined) {
        line += `${bg(TABLE_BG)} ${RESET}`;
        continue;
      }

      const topColor = top === undefined ? TABLE_BG : terrainColor(top.location.terrain);
      const bottomColor = bottom === undefined ? TABLE_BG : terrainColor(bottom.location.terrain);
      // ▀ = mitad superior con color fg, mitad inferior con color bg.
      line += `${fg(topColor)}${bg(bottomColor)}▀`;
    }
    lines.push(line);
  }

  // Leyenda.
  const legendParts = (Object.keys(TERRAIN_COLOR) as TerrainName[]).map((t) => {
    const label = t.replace("base-", "base ").replace("-", " ");
    return `${fg(terrainColor(t))}██${RESET} ${label}`;
  });

  const title = "War Chest 1v1 — tablero";
  console.log(`${fg([0xff, 0xff, 0xff])}${title}${RESET}`);
  console.log(`${fg([0x77, 0x88, 0xaa])}${sourcePath.replace(projectRoot + "/", "")}${RESET}`);
  console.log();
  for (const line of lines) console.log(line);
  console.log();
  console.log(`Leyenda: ${legendParts.join("  ·  ")}`);
  console.log(`${fg([0x77, 0x88, 0xaa])}${locations.length} casillas renderizadas${RESET}`);
}

const usePlaymat = process.argv.includes("--playmat");
const sourcePath = usePlaymat ? PLAYMAT_1V1 : BOARD_TERRAIN;

// El board compuesto desde tiles de terreno se genera con build-board-from-
// terrain.ts; si aún no existe (o la flag force-build), se construye primero.
if (!usePlaymat && (!existsSync(sourcePath) || process.argv.includes("--build"))) {
  execFileSync("bun", ["run", BOARD_BUILD_SCRIPT], { stdio: "inherit" });
}

render(sourcePath);