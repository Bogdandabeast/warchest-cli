/**
 * Imágenes de las tropas (`assets/troops/<tropa>.png`), una por unidad, SIN
 * transformaciones: se usan tal cual las ha añadido el usuario. Se comparten
 * en el draft (cartas y panel de elegidas), en la mano (monedas de tropa),
 * en la pantalla de cambio de turno y sobre el tablero (la moneda de cada
 * unidad, del tamaño del hexágono 1:1).
 *
 * Las 16 unidades tienen su PNG propio (incl. `ballestero.png` y
 * `explorador.png`), así que ninguna tropa usa placeholder. La moneda Real no
 * es una tropa y NO tiene imagen: se muestra solo con su símbolo ⟡.
 */
import { NativeImage } from "@opentui/core";
import type { UnitType } from "../domain/units.ts";
import { UNIT_TYPES } from "../domain/units.ts";

/** Archivo PNG por tipo de unidad. */
export const TROOP_ART_FILE: Readonly<Record<UnitType, string>> = {
  alferez: "alferez.png",
  arquero: "arquero.png",
  ballestero: "ballestero.png",
  caballeria: "caballeria.png",
  "caballeria-ligera": "caballeria-ligera.png",
  caballero: "caballero.png",
  clerigo: "clerigo.png",
  espadachin: "espadachin.png",
  explorador: "explorador.png",
  "guardia-real": "guardia-real.png",
  guerrero: "guerrero.png",
  infanteria: "infanteria.png",
  lancero: "lancero.png",
  mariscal: "mariscal.png",
  mercenario: "mercenario.png",
  piquero: "piquero.png",
};

const imageCache = new Map<string, Promise<NativeImage>>();

/** Carga un PNG una sola vez (single-flight por archivo). */
export function loadCachedTroopFile(file: string): Promise<NativeImage> {
  let promise = imageCache.get(file);
  if (promise === undefined) {
    const url = new URL(`../../assets/troops/${file}`, import.meta.url).toString();
    promise = NativeImage.load(url);
    imageCache.set(file, promise);
  }
  return promise;
}

/** Imagen de la moneda de una tropa concreta. */
export function loadTroopImage(type: UnitType): Promise<NativeImage> {
  return loadCachedTroopFile(TROOP_ART_FILE[type]);
}

/**
 * Carga la imagen de cada tipo de unidad. Resuelve el mapa completo (cada
 * unidad tiene SU PNG en `assets/troops/`), o `null` si ninguna imagen pudo
 * cargarse (la vista cae a marcadores de texto).
 */
export async function loadAllTroopImages(): Promise<Map<UnitType, NativeImage> | null> {
  const settled = await Promise.allSettled(UNIT_TYPES.map(async (type) => [type, await loadTroopImage(type)] as const));
  const fulfilled = settled.filter((result): result is PromiseFulfilledResult<readonly [UnitType, NativeImage]> => result.status === "fulfilled");
  if (fulfilled.length === 0) return null;
  return new Map(fulfilled.map((result) => result.value));
}
