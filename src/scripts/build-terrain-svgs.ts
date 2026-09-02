/**
 * build-terrain-svgs.ts
 *
 * Extrae cada tipo de terreno del tablero 1v1 a un SVG independiente en
 * `assets/terrain/`. CADA SVG contiene UN SOLO hexágono representativo del
 * tipo (con viewBox recortado y centrado): si hay varios del mismo tipo, se
 * elige la casilla canónica de cada uno.
 *
 * Tipos de terreno (marcados en el playmat por color y por el hexágono
 * pequeño interior que identifica las bases):
 *  - `terrain-normal.svg`: hexágono verde normal por donde se mueven las
 *    tropas (casilla D6, sin marcador).
 *  - `terrain-base-neutral.svg`: base sin conquistar — hexágono verde con
 *    marcador interior (casilla A7).
 *  - `terrain-base-lobos.svg`: base conquistada de los lobos — hexágono
 *    amarillo con el dibujo del lobo dentro (casilla C1).
 *  - `terrain-base-cuervos.svg`: base conquistada de los cuervos — hexágono
 *    morado con el dibujo del cuervo dentro (casilla E11).
 *
 * Los dibujos de lobo/cuervo son los grupos de íconos que el playmat ya
 * tiene sobre las bases (amarillo → g1009-*, morado → g944-*).
 *
 * Uso:
 *   bun run terrain
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SvgPathElement } from "../infrastructure/svg-parse.ts";
import { parseSvgPathElements } from "../infrastructure/svg-parse.ts";

const projectRoot = resolve(import.meta.dir, "..", "..");
const sourcePath = resolve(projectRoot, "warchest_playmat_1v1.svg");
const outputDir = resolve(projectRoot, "assets", "terrain");

const GREEN = "#8fff91";
const YELLOW = "#ffff00";
const PURPLE = "#9696ff";

/** Las casillas tienen r1 ≈ 136.9; los marcadores interiores r1 ≈ 68. */
const CELL_RADIUS_THRESHOLD = 100;
/** Distancia marcador/ícono → casilla que lo contiene (en el SVG, < 1 px). */
const MATCH_PX = 6;
/** Margen extra del viewBox para no recortar trazos ni íconos (px). */
const PAD_PX = 60;

type TerrainName = "normal" | "base-neutral" | "base-lobos" | "base-cuervos";

interface Cell {
  element: SvgPathElement;
  cx: number;
  cy: number;
  r1: number;
  r2: number;
  stroke: string;
  markerBlock?: string;
  iconBlock?: string;
}

interface IconGroup {
  id: string;
  block: string;
  cx: number;
  cy: number;
}

/** Centros del contenido de cada ícono en su espacio local (para traducir el transform a pantalla). */
const ICON_CONTENT_CENTER: Record<string, [number, number]> = {
  g1009: [440, 440],
  g944: [3142, 1877],
};

/** Casilla canónica elegida por tipo de terreno (un hexágono por SVG). */
const SELECTED_CELL: Record<TerrainName, { cx: number; cy: number }> = {
  normal: { cx: 1800, cy: 1050 }, // D6 — centro del tablero
  "base-neutral": { cx: 1130.4199, cy: 1178.8608 }, // A7
  "base-lobos": { cx: 1576.8066, cy: 405.69623 }, // C1
  "base-cuervos": { cx: 2023.1934, cy: 1694.3037 }, // E11
};

const TERRAIN_FILE: Record<TerrainName, string> = {
  normal: "terrain-normal.svg",
  "base-neutral": "terrain-base-neutral.svg",
  "base-lobos": "terrain-base-lobos.svg",
  "base-cuervos": "terrain-base-cuervos.svg",
};

/** Terrenos de base conquistada (necesitan el dibujo del animal dentro). */
const CONQUERED: Record<TerrainName, { color: string; iconPrefix: string } | undefined> = {
  normal: undefined,
  "base-neutral": undefined,
  "base-lobos": { color: YELLOW, iconPrefix: "g1009" },
  "base-cuervos": { color: PURPLE, iconPrefix: "g944" },
};

const distance = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

/**
 * Un grupo de ícono es un `<g id="g...">` con transform de matriz que contiene
 * solo `<path>` (sin `<g>` anidados). El regex ancla el match en el tag de
 * apertura que lleva el `id="g..."` y captura hasta su primer `</g>` — así los
 * contenedores externos (como el layer `layer5` que envuelve a los lobos) nunca
 * entran en el bloque extraído y el XML resultante queda balanceado.
 */
function parseIconGroups(svg: string): IconGroup[] {
  const groups: IconGroup[] = [];
  for (const match of svg.matchAll(/<g\b[^>]*\bid="(g[0-9][^"]*)"[^>]*>[\s\S]*?<\/g>/g)) {
    const block = match[0];
    const id = match[1]!;
    const openingTag = block.slice(0, block.indexOf(">") + 1);
    const matrixMatch = openingTag.match(/matrix\(([-0-9.,eE ]+)\)/);
    if (matrixMatch === null) continue;

    const center = ICON_CONTENT_CENTER[id.startsWith("g1009") ? "g1009" : "g944"];
    if (center === undefined) continue;
    const [a, , , d, e, f] = matrixMatch[1]!.split(",").map(Number);
    groups.push({
      id,
      block,
      cx: e! + a! * center[0],
      cy: f! + d! * center[1],
    });
  }
  return groups;
}

const source = readFileSync(sourcePath, "utf8");
const elements = parseSvgPathElements(source).filter(
  (h) => h.isHexagon && h.cx !== undefined && h.cy !== undefined && h.stroke !== undefined,
);

const cells: Cell[] = [];
let markersCount = 0;
for (const element of elements) {
  if (element.r1 !== undefined && element.r1 > CELL_RADIUS_THRESHOLD) {
    cells.push({
      element,
      cx: element.cx!,
      cy: element.cy!,
      r1: element.r1,
      r2: element.r2 ?? element.r1,
      stroke: element.stroke!,
    });
  } else {
    markersCount++;
  }
}

if (cells.length !== 37 || markersCount !== 10) {
  throw new Error(
    `Se esperaban 37 casillas y 10 marcadores en el tablero 1v1, `
    + `pero hay ${cells.length} casillas y ${markersCount} marcadores.`,
  );
}

// Marcador interior → casilla que lo contiene.
for (const element of elements) {
  if (element.r1 !== undefined && element.r1 <= CELL_RADIUS_THRESHOLD) {
    const parent = cells.filter((c) => distance(c.cx, c.cy, element.cx!, element.cy!) <= MATCH_PX)[0];
    if (parent === undefined) {
      throw new Error(`Marcador interior sin casilla contenedora: (${element.cx}, ${element.cy})`);
    }
    parent.markerBlock = element.block;
  }
}

// Íconos de animales (lobo/cuervo) → base conquistada más cercana.
const iconGroups = parseIconGroups(source);
for (const cell of cells) {
  const conquered = CONQUERED[terrainOf(cell)];
  if (conquered === undefined) continue;
  const candidates = iconGroups.filter((g) => g.id.startsWith(conquered.iconPrefix));
  const nearest = candidates
    .map((g) => ({ group: g, d: distance(g.cx, g.cy, cell.cx, cell.cy) }))
    .sort((a, b) => a.d - b.d)[0];
  if (nearest === undefined || nearest.d > 100) {
    throw new Error(`Base ${cell.element.id} sin dibujo de su animal (ícono ${conquered.iconPrefix}-*).`);
  }
  cell.iconBlock = nearest.group.block;
}

function terrainOf(cell: Cell): Exclude<TerrainName, never> {
  if (cell.stroke === GREEN) {
    return cell.markerBlock === undefined ? "normal" : "base-neutral";
  }
  return cell.stroke === YELLOW ? "base-lobos" : "base-cuervos";
}

const svgHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg
   xmlns:dc="http://purl.org/dc/elements/1.1/"
   xmlns:cc="http://creativecommons.org/ns#"
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:svg="http://www.w3.org/2000/svg"
   xmlns="http://www.w3.org/2000/svg"
   xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
   xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
   width="{W}"
   height="{H}"
   viewBox="0 0 {W} {H}">`;

mkdirSync(outputDir, { recursive: true });

for (const terrain of Object.keys(SELECTED_CELL) as TerrainName[]) {
  const selected = SELECTED_CELL[terrain];
  const cell = cells.filter((c) => distance(c.cx, c.cy, selected.cx, selected.cy) <= MATCH_PX)[0];
  if (cell === undefined) {
    throw new Error(`No se encontró la casilla canónica de ${terrain}.`);
  }
  if (terrainOf(cell) !== terrain) {
    throw new Error(`La casilla canónica de ${terrain} resultó del tipo ${terrainOf(cell)}.`);
  }

  const blocks = [cell.element.block];
  if (cell.markerBlock !== undefined) blocks.push(cell.markerBlock);
  if (cell.iconBlock !== undefined) blocks.push(cell.iconBlock);

  const width = 2 * cell.r1 + 2 * PAD_PX;
  const height = 2 * cell.r2 + 2 * PAD_PX;
  const offsetX = cell.cx - cell.r1 - PAD_PX;
  const offsetY = cell.cy - cell.r2 - PAD_PX;

  const header = svgHeader
    .replaceAll("{W}", String(Math.round(width)))
    .replaceAll("{H}", String(Math.round(height)));
  const content = `${header}
  <g
     id="terrain-${terrain}"
     style="display:inline"
     transform="translate(${-offsetX} ${-offsetY})">
${blocks.join("\n")}
  </g>
</svg>
`;
  const file = resolve(outputDir, TERRAIN_FILE[terrain]);
  writeFileSync(file, content);
  console.log(`OK: ${TERRAIN_FILE[terrain]} (1 hexágono, ${blocks.length} elementos, viewBox ${Math.round(width)}x${Math.round(height)})`);
}
