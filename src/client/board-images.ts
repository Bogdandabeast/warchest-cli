/**
 * Carga y comparte las imágenes del tablero:
 *
 * - `loadOverlayImages()` → la moneda de CADA tropa (`assets/troops/*.png`,
 *   usadas tal cual, sin transformaciones) y las fichas de base blanca/negra.
 *   Es lo que usa el tablero de la partida (hexágonos nativos + overlays).
 * - `loadBoardImages()` → además del overlay, el PNG del playmat completo
 *   (`assets/board/board-1v1.png`), que usa la vista previa de resoluciones.
 *
 * Todas se cargan una sola vez y se comparten; si todo falla, `null` y la
 * vista cae a los marcadores de texto.
 *
 * Variantes de resolución: `board-png` genera 12 escalas (5×…0.3×), pero el
 * decodificador nativo de OpenTUI tiene un límite de dimensiones (~4096 px
 * por lado), así que las escalas 3×, 3.5×, 4× y 5× NO se pueden cargar en el
 * cliente: sus PNG existen como archivo (para otras herramientas) y aquí se
 * marcan con `image: null` para que la UI muestre el aviso correspondiente.
 */
import { NativeImage } from "@opentui/core";
import type { UnitType } from "../domain/units.ts";
import { BOARD_PNG_PATH, BOARD_OUTPUT_SCALE } from "./board-geometry.ts";
import { loadCachedTroopFile } from "./troop-images.ts";
import { loadAllTroopImages } from "./troop-images.ts";

/** Imágenes que el tablero de la partida superpone a los hexágonos. */
export interface OverlayImages {
  /** Imagen de la moneda de cada tipo de unidad (su PNG propio en assets/troops). */
  troops: ReadonlyMap<UnitType, NativeImage>;
  whiteToken: NativeImage;
  blackToken: NativeImage;
}

/** El tablero PNG del playmat completo (solo para la vista previa). */
export interface BoardImages extends OverlayImages {
  board: NativeImage;
}

/** Imagen de la moneda de una unidad (o undefined si su PNG no está en el overlay). */
export function troopImage(images: OverlayImages, type: UnitType): NativeImage | undefined {
  return images.troops.get(type);
}

const WHITE = new URL("../../assets/troops/controltokenwhite.png", import.meta.url).toString();
const BLACK = new URL("../../assets/troops/controltokenblack.png", import.meta.url).toString();
const BOARD = new URL(`../../${BOARD_PNG_PATH}`, import.meta.url).toString();

/** Carga una imagen una sola vez (single-flight por recurso). */
const imageCache = new Map<string, Promise<NativeImage>>();
function loadCached(source: string): Promise<NativeImage> {
  let promise = imageCache.get(source);
  if (promise === undefined) {
    promise = NativeImage.load(source);
    imageCache.set(source, promise);
  }
  return promise;
}

let overlayCache: Promise<OverlayImages | null> | undefined;
let boardImagesCache: Promise<BoardImages | null> | undefined;

/** Carga (una sola vez) las monedas de tropa y las fichas de base para la partida. */
export function loadOverlayImages(): Promise<OverlayImages | null> {
  overlayCache ??= (async () => {
    try {
      const [troops, whiteToken, blackToken] = await Promise.all([loadAllTroopImages(), loadCached(WHITE), loadCached(BLACK)]);
      if (troops === null) return null;
      return { troops, whiteToken, blackToken };
    } catch {
      return null;
    }
  })();
  return overlayCache;
}

/** Carga (una sola vez) overlay + el PNG del playmat para la vista previa. */
export function loadBoardImages(): Promise<BoardImages | null> {
  boardImagesCache ??= (async () => {
    try {
      const [overlay, board] = await Promise.all([loadOverlayImages(), loadCached(BOARD)]);
      if (overlay === null) return null;
      return { ...overlay, board };
    } catch {
      return null;
    }
  })();
  return boardImagesCache;
}

/**
 * Resoluciones del board que genera `bun run board-png`, de mayor a menor.
 * La escala canónica (2×, la que usa la vista previa) se llama `board-1v1.png`
 * sin sufijo; el resto lleva `-<escala>x`. Las que superan el límite del
 * decodificador (3× y superiores) se marcan como no cargables en el cliente.
 */
export const BOARD_VARIANT_SCALES = [5, 4, 3.5, 3, 2.5, 2, 1.5, 1, 0.75, 0.5, 0.4, 0.3] as const;

/** Mayor escala que el decodificador nativo puede cargar (~4096 px por lado). */
export const BOARD_MAX_CLIENT_SCALE = 2.5;

/** Índice inicial de la vista previa: la mayor resolución VISIBLE del cliente. */
export const PREVIEW_START_INDEX = BOARD_VARIANT_SCALES.findIndex((scale) => scale <= BOARD_MAX_CLIENT_SCALE);

/** Nombre de archivo de una escala (la canónica no lleva sufijo). */
export function boardVariantFile(scale: number): string {
  return Math.abs(scale - BOARD_OUTPUT_SCALE) < 1e-9 ? "board-1v1.png" : `board-1v1-${scale}x.png`;
}

export interface BoardVariantImage {
  scale: number;
  file: string;
  /** null = el PNG existe pero excede el límite de dimensiones del cliente. */
  image: NativeImage | null;
}

/**
 * Carga una sola variante (cacheada por escala); `null` si el PNG falla
 * (no existe o excede los límites del cliente). Se comparte entre la vista
 * previa y la galería para no re-decodificar los PNG grandes.
 */
export function loadBoardVariant(scale: number): Promise<NativeImage | null> {
  const file = boardVariantFile(scale);
  const url = new URL(`../../assets/board/${file}`, import.meta.url).toString();
  return loadCached(url).then((image) => image).catch(() => null);
}

let boardVariantsCache: Promise<readonly BoardVariantImage[] | null> | undefined;

/** Carga todas las variantes (una sola vez, compartidas), marcando fallos. */
export function loadBoardVariants(): Promise<readonly BoardVariantImage[] | null> {
  boardVariantsCache ??= (async () => {
    try {
      return await Promise.all(BOARD_VARIANT_SCALES.map(async (scale) => {
        const image = await loadBoardVariant(scale);
        return { scale, file: boardVariantFile(scale), image };
      }));
    } catch {
      return null;
    }
  })();
  return boardVariantsCache;
}
