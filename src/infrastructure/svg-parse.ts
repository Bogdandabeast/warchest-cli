/**
 * Parseo mínimo de elementos `<path>` de los playmats SVG (generados con
 * Inkscape). Los atributos pueden aparecer en cualquier orden y en varias
 * líneas, así que cada elemento se extrae como un bloque y luego se leen
 * sus atributos con regex.
 */

export interface SvgPathElement {
  /** Texto completo del elemento (desde `<path` hasta `/>`). */
  block: string;
  id?: string;
  /** Color de trazo en minúsculas, p. ej. `#8fff91`. */
  stroke?: string;
  /** ¿Es un hexágono del tablero (`sodipodi:sides="6"`)? */
  isHexagon: boolean;
  /** Centro X del hexágono (`sodipodi:cx`). */
  cx?: number;
  /** Centro Y del hexágono (`sodipodi:cy`). */
  cy?: number;
  /** Radio exterior del hexágono (`sodipodi:r1`): ~136.9 casilla, ~68 decorativo. */
  r1?: number;
  /** Apotema del hexágono (`sodipodi:r2`): ~118.6 casilla, ~54 decorativo. */
  r2?: number;
}

export const PATH_ELEMENT_RE = /<path\b[\s\S]*?\/>/g;

const STROKE_RE = /stroke:#([0-9a-fA-F]{6})/;
const HEXAGON_RE = /sodipodi:sides="6"/;

export function parseSvgPath(svgPathBlock: string): SvgPathElement {
  const strokeMatch = svgPathBlock.match(STROKE_RE);
  const idMatch = svgPathBlock.match(/id="([^"]+)"/);
  const cxMatch = svgPathBlock.match(/sodipodi:cx="([-0-9.]+)"/);
  const cyMatch = svgPathBlock.match(/sodipodi:cy="([-0-9.]+)"/);
  const r1Match = svgPathBlock.match(/sodipodi:r1="([-0-9.]+)"/);
  const r2Match = svgPathBlock.match(/sodipodi:r2="([-0-9.]+)"/);
  return {
    block: svgPathBlock,
    id: idMatch?.[1],
    stroke: strokeMatch ? `#${strokeMatch[1]!.toLowerCase()}` : undefined,
    isHexagon: HEXAGON_RE.test(svgPathBlock),
    cx: cxMatch ? Number.parseFloat(cxMatch[1]!) : undefined,
    cy: cyMatch ? Number.parseFloat(cyMatch[1]!) : undefined,
    r1: r1Match ? Number.parseFloat(r1Match[1]!) : undefined,
    r2: r2Match ? Number.parseFloat(r2Match[1]!) : undefined,
  };
}

/** Devuelve todos los elementos `<path>` del SVG, en orden de aparición. */
export function parseSvgPathElements(svg: string): SvgPathElement[] {
  return [...svg.matchAll(PATH_ELEMENT_RE)].map((match) => parseSvgPath(match[0]));
}