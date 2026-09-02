/**
 * build-board-from-terrain.ts
 *
 * Construye el tablero 1v1 **programáticamente** a partir de los tiles de
 * terreno de `assets/terrain/`, de modo que el resultado sea igual al playmat
 * limpio `warchest_playmat_1v1.svg` (mismas 37 casillas, mismas posiciones y
 * mismos colores), y lo imprime en la terminal como mapa ASCII.
 *
 * Cómo funciona:
 *  - Los tiles contienen el contenido del playmat en **coordenadas absolutas**
 *    del documento (cada uno está centrado en su casilla canónica y usa el
 *    mismo viewBox 3600x2100 que el playmat al componerse).
 *  - Para cada casilla del tablero se elige el tile de su terreno y se coloca
 *    como un `<g transform="translate(dx dy)">` con `(dx,dy) = centro de la
 *    casilla − centro del tile`. Así “el mismo hexágono” viaja de la casilla
 *    canónica del tile a la que le toca en el tablero.
 *  - Los ids internos (paths e íconos) se renombran por casilla para evitar
 *    duplicados en el SVG compuesto.
 *
 * Tipos de terreno (extraídos del playmat, ver build-terrain-svgs.ts):
 *  - normal: casilla verde sin marcador interior.
 *  - base-neutral: casilla verde con marcador interior (sin conquistar).
 *  - base-lobos: casilla amarilla (conquistada por los lobos).
 *  - base-cuervos: casilla morada (conquistada por los cuervos).
 *
 * Uso:
 *   bun run board-terrain
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseSvgPathElements } from "../infrastructure/svg-parse.ts";
import {
  classifyBoardLocations,
  TERRAIN_FILE,
  TERRAIN_SYMBOL,
} from "../infrastructure/terrain.ts";
import type { TerrainName } from "../infrastructure/terrain.ts";

const projectRoot = resolve(import.meta.dir, "..", "..");
const playmatPath = resolve(projectRoot, "warchest_playmat_1v1.svg");
const terrainDir = resolve(projectRoot, "assets", "terrain");
const outputDir = resolve(projectRoot, "assets", "board");
const outputPath = resolve(outputDir, "board-1v1.svg");

/** Tolerancia para comparar centros contra el playmat. */
const CENTER_EPSILON = 0.5;
/** Las casillas tienen r1 ≈ 136.9; los marcadores interiores r1 ≈ 68. */
const CELL_RADIUS_THRESHOLD = 100;

const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

interface Tile {
  /** Contenido interno del `<g id="terrain-*">` (paths + íconos, en coords absolutas). */
  inner: string;
  /** Centro del hexágono grande del tile (su casilla canónica). */
  cx: number;
  cy: number;
}

/** Lee el contenido interno del grupo raíz de un tile (coordenadas absolutas). */
function loadTile(name: TerrainName): Tile {
  const svg = readFileSync(resolve(terrainDir, TERRAIN_FILE[name]), "utf8");
  const rootOpen = svg.match(/<g\b[^>]*id="terrain-[^"]*"[^>]*>/);
  if (rootOpen?.index === undefined) {
    throw new Error(`Tile ${TERRAIN_FILE[name]} sin grupo raíz id="terrain-*".`);
  }
  const openEnd = rootOpen.index + rootOpen[0].length;
  const closeStart = svg.lastIndexOf("</g>");
  if (openEnd >= closeStart) {
    throw new Error(`Tile ${TERRAIN_FILE[name]} con estructura inesperada.`);
  }
  const hexagon = parseSvgPathElements(svg).find((h) => h.isHexagon && h.r1! > CELL_RADIUS_THRESHOLD);
  if (hexagon?.cx === undefined || hexagon.cy === undefined) {
    throw new Error(`Tile ${TERRAIN_FILE[name]} sin hexágono grande.`);
  }
  return { inner: svg.slice(openEnd, closeStart).trim(), cx: hexagon.cx, cy: hexagon.cy };
}

/** Renombra los ids internos de un bloque con el sufijo de la casilla (evita duplicados). */
function uniquifyIds(inner: string, cellId: string): string {
  return inner.replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${id}-${cellId}"`);
}

function fmt(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

/** Cabecera SVG con el viewBox del playmat (3600x2100). */
const svgHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   width="3600"
   height="2100"
   viewBox="0 0 3600 2100">`;

// ── 1. Clasificar casillas del playmat ────────────────────────────────────────
const playmat = readFileSync(playmatPath, "utf8");
const cells = classifyBoardLocations(playmat).sort((a, b) => (a.cy === b.cy ? a.cx - b.cx : a.cy - b.cy));

// Conteos esperados por terreno (ver DECISIONS.md: 27 normales, 6 bases sin
// conquistar, 2 de lobos y 2 de cuervos).
const EXPECTED_TERRAIN_COUNTS: Readonly<Record<TerrainName, number>> = {
  normal: 27,
  "base-neutral": 6,
  "base-lobos": 2,
  "base-cuervos": 2,
};

const counts = new Map<TerrainName, number>();
for (const terrain of Object.keys(EXPECTED_TERRAIN_COUNTS) as TerrainName[]) counts.set(terrain, 0);
for (const cell of cells) counts.set(cell.terrain, (counts.get(cell.terrain) ?? 0) + 1);

// Validar ANTES de escribir el SVG: si algún conteo no coincide, el board
// compuesto no refleja el tablero real y no debe generarse el archivo.
for (const [terrain, expected] of Object.entries(EXPECTED_TERRAIN_COUNTS) as [TerrainName, number][]) {
  const actual = counts.get(terrain);
  if (actual !== expected) {
    throw new Error(
      `Conteo de terreno inválido: ${terrain} = ${actual}, se esperaban ${expected} (el SVG no se escribió).`,
    );
  }
}

// ── 2. Cargar tiles y componer el tablero ────────────────────────────────────
const tiles = new Map<TerrainName, Tile>(
  Object.keys(TERRAIN_FILE).map((name) => [name as TerrainName, loadTile(name as TerrainName)]),
);

const groups: string[] = [];
for (const cell of cells) {
  const tile = tiles.get(cell.terrain)!;
  const dx = cell.cx - tile.cx;
  const dy = cell.cy - tile.cy;
  const inner = uniquifyIds(tile.inner, cell.id);
  groups.push(
    [
      `  <g`,
      `     id="cell-${cell.id}"`,
      `     transform="translate(${fmt(dx)} ${fmt(dy)})">`,
      inner
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n"),
      `  </g>`,
    ].join("\n"),
  );
}

const boardSvg = `${svgHeader}\n  <g id="board-from-terrain">\n${groups.join("\n")}\n  </g>\n</svg>\n`;

// ── 3. Verificar que es IGUAL al playmat 1v1 ─────────────────────────────────
// El parseo de paths lee las coordenadas ORIGINALES del tile (el ancla), así
// que el centro RENDERIZADO de cada casilla = centro del path + translate del
// grupo `cell-*` que la envuelve.
const cellGroupRe = /<g\s+id="cell-([^"]+)"[^>]*transform="translate\(([^ )]+) ([^ )]+)\)[^"]*"[^>]*>([\s\S]*?)<\/g>/g;
const renderedCenters = new Map<string, { cx: number; cy: number }>();
for (const match of boardSvg.matchAll(cellGroupRe)) {
  const cellId = match[1]!;
  const dx = Number.parseFloat(match[2]!);
  const dy = Number.parseFloat(match[3]!);
  const innerHexagon = parseSvgPathElements(match[4]!).find(
    (h) => h.isHexagon && h.r1! > CELL_RADIUS_THRESHOLD && h.cx !== undefined && h.cy !== undefined,
  );
  if (innerHexagon === undefined) {
    throw new Error(`El grupo cell-${cellId} no contiene un hexágono grande.`);
  }
  renderedCenters.set(cellId, { cx: innerHexagon.cx! + dx, cy: innerHexagon.cy! + dy });
}

if (renderedCenters.size !== cells.length) {
  throw new Error(`El board compuesto tiene ${renderedCenters.size} grupos cell-*, se esperaban ${cells.length}.`);
}
for (const cell of cells) {
  const rendered = renderedCenters.get(cell.id);
  if (rendered === undefined) {
    throw new Error(`Falta la casilla ${cell.id} en el board compuesto.`);
  }
  if (distance(cell.cx, cell.cy, rendered.cx, rendered.cy) > CENTER_EPSILON) {
    throw new Error(
      `Casilla ${cell.id} desalineada: playmat (${fmt(cell.cx)}, ${fmt(cell.cy)}) `
      + `vs compuesta (${fmt(rendered.cx)}, ${fmt(rendered.cy)}).`,
    );
  }
}

mkdirSync(outputDir, { recursive: true });
writeFileSync(outputPath, boardSvg);

// ── 4. Imprimir el tablero en la terminal ────────────────────────────────────
console.log("Tablero 1v1 compuesto desde assets/terrain/ →", outputPath.replace(projectRoot + "/", ""));
console.log(
  `Casillas: ${cells.length} (${counts.get("normal")} normales · ${counts.get("base-neutral")} `
  + `bases sin conquistar · ${counts.get("base-lobos")} bases de lobos · ${counts.get("base-cuervos")} de cuervos)`,
);
console.log();

const columns = [...new Set(cells.map((c) => round1(c.cx)))].sort((a, b) => a - b);
const rows = [...new Set(cells.map((c) => round1(c.cy)))].sort((a, b) => a - b);

let header = "      ";
for (let c = 0; c < columns.length; c++) header += ` ${String.fromCharCode(65 + c)} `;
console.log(header);
console.log("   " + "-".repeat(columns.length * 3 + 1));

for (let r = 0; r < rows.length; r++) {
  const rowCells = cells.filter((c) => round1(c.cy) === rows[r]);
  const byCol = new Map(rowCells.map((c) => [columns.indexOf(round1(c.cx)), c]));
  // Las filas impares se desplazan media casilla (rejilla hexagonal).
  let line = `${String(r).padStart(2)} ${r % 2 === 1 ? " " : ""}|`;
  for (let c = 0; c < columns.length; c++) {
    const cell = byCol.get(c);
    line += ` ${cell === undefined ? " " : TERRAIN_SYMBOL[cell.terrain]} `;
  }
  console.log(line);
}
console.log();

const legend = (Object.keys(TERRAIN_SYMBOL) as TerrainName[])
  .map((t) => `${TERRAIN_SYMBOL[t]} = ${t}`)
  .join("  ·  ");
console.log("Leyenda: " + legend);

// Consistencia con el dominio de BoardLoader (ids de rejilla).
for (const cell of cells) {
  if (!/^[A-G](?:1[0-2]|[0-9])$/.test(cell.id)) {
    throw new Error(`Id de casilla fuera de A0–G12: ${cell.id}`);
  }
}
console.log();
console.log("Validado: el board compuesto es igual al playmat warchest_playmat_1v1.svg (37 casillas, mismas posiciones y colores).");
