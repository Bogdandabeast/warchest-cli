import type { Board } from "../domain/board.ts";

/**
 * Carga un tablero desde una fuente (spec §8).
 * La implementación concreta (`SVGBoardLoader`) vive en la capa de
 * infraestructura y se inyecta al `Game`/servidor.
 */
export interface BoardLoader {
  load(): Promise<Board>;
}