/**
 * Rasteriza el board compuesto (SVG con los hexágonos y el arte de las
 * bases) a PNG en VARIAS resoluciones para que el cliente TUI pueda usar la
 * imagen del playmat real. El archivo canónico que usa el juego es
 * `assets/board/board-1v1.png` (2× por defecto); las variantes
 * `board-1v1-<escala>x.png` permiten comparar qué resolución queda mejor en
 * el render de bloques del terminal (baja resolución suele alisar los
 * trazos, alta suele dar más nitidez).
 *
 * Uso:
 *   bun run board-png                 # genera todas las variantes por defecto
 *   bun run board-png 2 1 0.5         # genera solo esas escalas
 *
 * El SVG original mide 3600×2100 con mucho margen vacío; el tablero 1v1 (37
 * casillas) vive en la región x∈[984, 2616], y∈[149, 1951] (aprox.), así
 * que se recorta el viewBox a esa zona y se renderiza a `escala ×` del
 * tamaño natural (1× = 1632×1802 px).
 *
 * Los hexágonos del board compuesto no tienen relleno (solo trazo y los
 * iconos de lobos/cuervos en las bases), igual que el playmat real: sobre
 * el fondo del terminal se ven las líneas verdes/amarillas/moradas y el
 * arte de las bases.
 */
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
import { BOARD_CROP, BOARD_OUTPUT_SCALE, BOARD_SVG_PATH } from "../client/board-geometry.ts";

const DEFAULT_SCALES = [5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 0.4, 0.3];

function main(): void {
  const args = process.argv.slice(2).map(Number).filter((n) => Number.isFinite(n) && n > 0);
  const scales = args.length > 0 ? args : DEFAULT_SCALES;

  const raw = readFileSync(BOARD_SVG_PATH, "utf8");
  const crop = BOARD_CROP;
  const viewBox = `${crop.x} ${crop.y} ${crop.width} ${crop.height}`;

  for (const scale of scales) {
    const outW = Math.round(crop.width * scale);
    const outH = Math.round(crop.height * scale);

    const cropped = raw
      .replace('width="3600"', `width="${outW}"`)
      .replace('height="2100"', `height="${outH}"`)
      .replace('viewBox="0 0 3600 2100"', `viewBox="${viewBox}"`);

    const resvg = new Resvg(cropped);
    const rendered = resvg.render();
    const png = rendered.asPng();

    const canonical = Math.abs(scale - BOARD_OUTPUT_SCALE) < 1e-9;
    const name = canonical ? "board-1v1.png" : boardVariantName(scale);
    writeFileSync(`assets/board/${name}`, png); // cwd = raíz del repo (npm script)
    console.log(`${name}: ${rendered.width}x${rendered.height} (escala ${scale}, ${png.length} bytes)`);
  }
}

/** board-1v1-1.5x.png, board-1v1-0.5x.png, … (la escala canónica no lleva sufijo). */
export function boardVariantName(scale: number): string {
  return `board-1v1-${scale}x.png`;
}

main();