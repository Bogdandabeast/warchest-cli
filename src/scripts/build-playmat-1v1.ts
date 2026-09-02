/**
 * build-playmat-1v1.ts
 *
 * Genera `warchest_playmat_1v1.svg` a partir de `warchest_playmat_base.svg`.
 *
 * Transformación aplicada:
 *  - Se ELIMINAN los elementos <path> que son hexágonos (sodipodi:sides="6")
 *    cuyo trazo es de un color que queda FUERA de la zona verde del tablero:
 *      #8fffff (cian), #6432ff (azul oscuro), #ff9600 (naranja).
 *  - Se ELIMINAN los grupos <g> de íconos de unidades que quedaron huérfanos
 *    sobre las casillas eliminadas (g944-8-6 y g1009-1-2).
 *  - Se CONSERVAN el resto de hexágonos: los verdes (#8fff91) y las 4 bases
 *    de los jugadores (#ffff00 x2 arriba, #9696ff x2 abajo) que están dentro
 *    de la zona verde, y los íconos de unidades sobre las bases conservadas
 *    (g1009-1, g1009-1-3, g944-8, g944-8-9), además de todo lo demás del
 *    archivo (fondos, florituras, octágonos, etc.) sin modificar ni un byte.
 *
 * La clasificación por color coincide exactamente con la geometría:
 * cian/naranja/azul oscuro solo existen fuera de la zona verde; amarillo y
 * morado solo existen dentro (bases).
 *
 * Uso:
 *   bun run src/scripts/build-playmat-1v1.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PATH_ELEMENT_RE, parseSvgPath, parseSvgPathElements } from "../infrastructure/svg-parse.ts";
import type { SvgPathElement } from "../infrastructure/svg-parse.ts";

const projectRoot = resolve(import.meta.dir, "..", "..");
const inputPath = resolve(projectRoot, "warchest_playmat_base.svg");
const outputPath = resolve(projectRoot, "warchest_playmat_1v1.svg");

/** Colores de hexágonos que se extienden fuera de la zona verde (se eliminan). */
const REMOVE_STROKES = new Set(["#8fffff", "#6432ff", "#ff9600"]);

/** Grupos de íconos de unidades que quedaron huérfanos sobre casillas eliminadas. */
const ORPHAN_ICON_GROUPS = ["g944-8-6", "g1009-1-2"];

function hexagonPaths(svg: string): SvgPathElement[] {
  return parseSvgPathElements(svg).filter((p) => p.isHexagon);
}

function filterSvg(svg: string): { output: string; removed: SvgPathElement[] } {
  let output = "";
  let cursor = 0;
  const removed: SvgPathElement[] = [];

  for (const match of svg.matchAll(PATH_ELEMENT_RE)) {
    output += svg.slice(cursor, match.index);
    cursor = match.index! + match[0].length;

    const path = parseSvgPath(match[0]);
    const shouldRemove =
      path.isHexagon && path.stroke !== undefined && REMOVE_STROKES.has(path.stroke);

    if (shouldRemove) {
      removed.push(path);
    } else {
      output += match[0];
    }
  }

  output += svg.slice(cursor);
  return { output, removed };
}

/** Elimina un grupo <g id="..."> completo (solo los huérfanos declarados). */
function removeOrphanIconGroups(svg: string): { output: string; removed: string[] } {
  let output = svg;
  const removed: string[] = [];

  for (const id of ORPHAN_ICON_GROUPS) {
    const re = new RegExp(`<g\\b[^>]*?\\bid="${id}"[^>]*>[\\s\\S]*?<\\/g>`, "g");
    const matches = [...output.matchAll(re)];
    if (matches.length !== 1) {
      throw new Error(
        `Se esperaba exactamente 1 grupo <g id="${id}"> huérfano, se encontraron ${matches.length}.`,
      );
    }
    const match = matches[0]!;
    output = output.slice(0, match.index) + output.slice(match.index! + match[0].length);
    removed.push(id);
  }

  return { output, removed };
}

/** ¿Existe un elemento con el id exacto (id="...")? */
function hasElementId(svg: string, id: string): boolean {
  return new RegExp(`id="${id}"`).test(svg);
}

const source = readFileSync(inputPath, "utf8");

const sourceHexagons = hexagonPaths(source);
console.log(`Hexágonos (sides="6") en origen: ${sourceHexagons.length}`);

const { output: sinHexagones, removed } = filterSvg(source);
console.log(`Eliminados (fuera de la zona verde): ${removed.length}`);
for (const path of removed) {
  console.log(`  - ${path.id ?? "<sin id>"} (${path.stroke})`);
}

const { output, removed: gruposEliminados } = removeOrphanIconGroups(sinHexagones);
console.log(`Grupos de íconos huérfanos eliminados: ${gruposEliminados.length}`);
for (const id of gruposEliminados) {
  console.log(`  - ${id}`);
}

// Verificaciones estructurales: si el SVG fuente cambia de forma inesperada,
// el script falla en lugar de generar un archivo incorrecto.
const expectedRemoved = 14; // 10 casillas grandes + 4 decorativas pequeñas
if (removed.length !== expectedRemoved) {
  throw new Error(
    `Se esperaban ${expectedRemoved} hexágonos a eliminar, pero se encontraron ${removed.length}. ` +
      "Revisa warchest_playmat_base.svg antes de regenerar.",
  );
}

const outputHexagons = hexagonPaths(output);
if (outputHexagons.length !== 47) {
  throw new Error(
    `Se esperaban 47 hexágonos conservados (33 verdes + 6 decorativos verdes + 4 amarillos + 4 morados), ` +
      `pero hay ${outputHexagons.length}.`,
  );
}

const keptBases = outputHexagons.filter(
  (p) => p.stroke === "#ffff00" || p.stroke === "#9696ff",
);
if (keptBases.length !== 8) {
  throw new Error(`Se esperaban 8 hexágonos de base (2 amarillos + 2 morados, grande y pequeño cada uno), pero hay ${keptBases.length}.`);
}

const leftoversOutside = outputHexagons.filter(
  (p) => p.stroke !== undefined && REMOVE_STROKES.has(p.stroke),
);
if (leftoversOutside.length > 0) {
  throw new Error(`Quedaron ${leftoversOutside.length} hexágonos de colores exteriores en la salida.`);
}

// Los íconos de las bases conservadas deben seguir presentes
// (amarillos g1009-1/g1009-1-3 y morados g944-8/g944-8-9).
for (const id of ["g1009-1", "g1009-1-3", "g944-8", "g944-8-9"]) {
  if (!hasElementId(output, id)) {
    throw new Error(`Falta el ícono de base esperado <g id="${id}"> en la salida.`);
  }
}
for (const id of ORPHAN_ICON_GROUPS) {
  if (hasElementId(output, id)) {
    throw new Error(`El grupo huérfano <g id="${id}"> no fue eliminado de la salida.`);
  }
}

writeFileSync(outputPath, output);
console.log(`\nOK: ${outputPath} generado (${outputHexagons.length} hexágonos: ` +
  `${outputHexagons.filter((p) => p.stroke === "#8fff91").length} verdes, ` +
  `${outputHexagons.filter((p) => p.stroke === "#ffff00").length} amarillos, ` +
  `${outputHexagons.filter((p) => p.stroke === "#9696ff").length} morados).`);