/**
 * Terreno de una casilla (movido del script de assets al dominio en el
 * ciclo 2, ver DECISIONS.md).
 *
 * El color del hexágono del playmat y la presencia de un marcador interior
 * definen el tipo (la clasificación vive en la infraestructura, que conoce
 * el arte del SVG; el *tipo* es dominio).
 */
import type { PlayerId } from "./types.ts";

export type Terrain = "normal" | "base-neutral" | "base-lobos" | "base-cuervos";

/** ¿El terreno es una localización (una base que puede recibir fichas)? */
export function isLocationTerrain(terrain: Terrain): boolean {
  return terrain !== "normal";
}

/**
 * Jugador cuya base de inicio es este terreno (si lo es). El amarillo
 * (lobos, arriba en el playmat) pertenece a player1 y el morado (cuervos,
 * abajo) a player2.
 */
export function startZoneOf(terrain: Terrain): PlayerId | undefined {
  switch (terrain) {
    case "base-lobos":
      return "player1";
    case "base-cuervos":
      return "player2";
    default:
      return undefined;
  }
}
