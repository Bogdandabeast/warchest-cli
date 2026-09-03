/**
 * Geometría del tablero 1v1 para el render con la imagen PNG del playmat.
 *
 * `assets/board/board-1v1.png` se genera con `bun run board-png` a partir
 * del board compuesto `assets/board/board-1v1.svg` (el SVG es 3600×2100 con
 * mucho margen; el tablero vive en la región `BOARD_CROP`, que se recorta en
 * el viewBox y se rasteriza a `BOARD_OUTPUT_SCALE`×). La imagen se dibuja
 * con `fit="fill"` en una caja de `BOARD_CANVAS` celdas — 80×33, el doble de
 * ancho y 1.5× de alto que el lienzo original (pedido del usuario) — en el
 * cliente, así que la posición en celdas de un hexágono es una proyección
 * lineal de sus coordenadas SVG:
 *
 *   left = (svgX - BOARD_CROP.x) / BOARD_CROP.width * BOARD_CANVAS.width
 *   top  = (svgY - BOARD_CROP.y) / BOARD_CROP.height * BOARD_CANVAS.height
 *
 * El reticulado del board compuesto es regular: la columna A está en x=1130.4
 * con paso 223.19, y la fila 0 en y=276.84 con paso 128.86 (verificado con
 * los `transform="translate(...)"` de cada celda `cell-*` y el centro de
 * D6 = (1800, 1050)).
 */

export const BOARD_SVG_PATH = "assets/board/board-1v1.svg";
export const BOARD_PNG_PATH = "assets/board/board-1v1.png";
/** Resolución de salida de la rasterización (2× para trazos nítidos). */
export const BOARD_OUTPUT_SCALE = 2;

/** Región del SVG que contiene el tablero 1v1 (todas las casillas + trazo). */
export const BOARD_CROP = { x: 984, y: 149, width: 1632, height: 1802 };

/** Tamaño en celdas de la caja donde el cliente dibuja el PNG del tablero.
 * 100% más ancho y 50% más alto que el original (user request). */
export const BOARD_CANVAS = { width: 80, height: 33 };

/** Origen del reticulado del board compuesto en coordenadas SVG. */
export const COL_X0 = 1130.4199;
export const COL_STEP_SVG = 223.1934;
export const ROW_Y0 = 276.8352;
export const ROW_STEP_SVG = 128.8608;

/** Extrae (columna, fila) del id A0–G12; null si no es un id de rejilla. */
export function idToGrid(id: string): { col: number; row: number } | null {
  const match = /^([A-G])(1[0-2]|[0-9])$/.exec(id);
  if (match === null) return null;
  return { col: match[1]!.charCodeAt(0) - 65, row: Number(match[2]!) };
}

/** Centro del hexágono (en celdas del lienzo) a partir de su id de rejilla. */
export function hexCenter(id: string): { left: number; top: number } | null {
  const grid = idToGrid(id);
  if (grid === null) return null;
  const svgX = COL_X0 + grid.col * COL_STEP_SVG;
  const svgY = ROW_Y0 + grid.row * ROW_STEP_SVG;
  return {
    left: ((svgX - BOARD_CROP.x) / BOARD_CROP.width) * BOARD_CANVAS.width,
    top: ((svgY - BOARD_CROP.y) / BOARD_CROP.height) * BOARD_CANVAS.height,
  };
}

/** Tamaño en celdas del hexágono (utilizado para dimensionar las monedas 1:1). */
export function hexSize(): { width: number; height: number } {
  // hexágono del board compuesto: ancho = 2·r1 (273.78px), alto = 2·r2 (237.1px)
  return {
    width: ((2 * 136.89194) / BOARD_CROP.width) * BOARD_CANVAS.width,
    height: ((2 * 118.55189) / BOARD_CROP.height) * BOARD_CANVAS.height,
  };
}

export const HEX_WIDTH = hexSize().width;
export const HEX_HEIGHT = hexSize().height;

/** Tamaño en celdas del lienzo del tablero (constante: BOARD_CANVAS). */
export function boardSize(_ids?: Iterable<string>): { width: number; height: number } {
  return { width: BOARD_CANVAS.width, height: BOARD_CANVAS.height };
}