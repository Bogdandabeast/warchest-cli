/**
 * Tipos base del dominio (spec §3.1).
 */

/** Identificador de jugador en una partida 1v1. */
export type PlayerId = "player1" | "player2";

/**
 * Identificador de una celda del tablero (spec §3.1).
 *
 * Es un string opaco generado por el `SVGBoardLoader` con la convención
 * `letra + fila` (p. ej. `"D6"`, `"C1"`): letra = columna de la rejilla
 * hexagonal (A–G, de izquierda a derecha) y fila = índice de la fila
 * (0–12, de arriba hacia abajo). La igualdad es la nativa de string.
 */
export type Position = string;
