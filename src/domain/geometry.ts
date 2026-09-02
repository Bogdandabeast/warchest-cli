/**
 * Geometría del tablero hexagonal para las reglas de distancia y línea recta
 * (Arquero, Ballestero, Lancero, Mariscal, Alférez…).
 *
 * El tablero conoce las coordenadas (x, y) de cada casilla y su adyacencia;
 * la "distancia" aquí es la distancia en casillas por la rejilla (BFS), y la
 * "línea recta" se detecta comparando vectores entre centros: dos casillas
 * están en línea recta si su vector es un múltiplo entero del vector que une
 * una casilla con uno de sus vecinos.
 */
import type { Board } from "./board.ts";
import type { Position } from "./types.ts";

/** Tolerancia (px) al comparar vectores entre centros de casillas. */
const VECTOR_EPSILON = 2;

/** Número de casillas en línea recta que se pueden comprobar (rangos del juego). */
const MAX_LINE_RANGE = 3;

interface Vector {
  dx: number;
  dy: number;
}

function vector(a: Position, b: Position, board: Board): Vector {
  const na = board.getNode(a);
  const nb = board.getNode(b);
  if (na === undefined || nb === undefined) {
    throw new Error(`Posición desconocida en geometría: ${a} → ${b}`);
  }
  return { dx: nb.x - na.x, dy: nb.y - na.y };
}

function almostEqual(v: Vector, w: Vector): boolean {
  return Math.abs(v.dx - w.dx) <= VECTOR_EPSILON && Math.abs(v.dy - w.dy) <= VECTOR_EPSILON;
}

function isMultiple(v: Vector, step: Vector, k: number): boolean {
  return almostEqual(v, { dx: step.dx * k, dy: step.dy * k });
}

/** Distancia en casillas (BFS) entre dos posiciones; -1 si no hay camino. */
export function distanceInHexes(board: Board, from: Position, to: Position): number {
  if (from === to) return 0;
  const frontier = [from];
  const seen = new Set<Position>([from]);
  let depth = 0;
  while (frontier.length > 0) {
    depth++;
    const next: Position[] = [];
    for (const current of frontier) {
      for (const neighbor of board.getNeighbors(current)) {
        if (neighbor === to) return depth;
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          next.push(neighbor);
        }
      }
    }
    frontier.length = 0;
    frontier.push(...next);
  }
  return -1;
}

/** Casillas en línea recta entre `from` y `to` (excluyendo ambas). Vacío si no están alineadas. */
export function hexesInStraightLine(board: Board, from: Position, to: Position): Position[] {
  const v = vector(from, to, board);
  const fromNode = board.getNode(from);
  if (fromNode === undefined) return [];

  // Cada vecino define una dirección; si `to` es un múltiplo entero del paso,
  // están alineados y devolvemos las casillas intermedias (la inmediatamente
  // anterior a `to` la puede necesitar el Lancero para saber dónde embiste).
  for (const neighbor of fromNode.neighbors) {
    const step = vector(from, neighbor, board);
    for (let k = 1; k <= MAX_LINE_RANGE; k++) {
      if (isMultiple(v, step, k)) {
        const result: Position[] = [];
        for (let j = 1; j < k; j++) {
          const node = board
            .getAllNodes()
            .find((n) => almostEqual(vector(from, n.id, board), { dx: step.dx * j, dy: step.dy * j }));
          if (node !== undefined) result.push(node.id);
        }
        return result;
      }
    }
  }
  return [];
}

/** ¿`to` está en línea recta desde `from` a una distancia de 1 a 3 casillas? */
export function isStraightLine(board: Board, from: Position, to: Position): boolean {
  return hexesInStraightLine(board, from, to).length > 0 || board.areAdjacent(from, to);
}

/**
 * Casillas a distancia exacta `range` de `origin` (para Arquero/Ballestero).
 * Devuelve solo posiciones existentes.
 */
export function hexesAtRange(board: Board, origin: Position, range: number): Position[] {
  return board
    .getAllNodes()
    .map((n) => n.id)
    .filter((pos) => pos !== origin && distanceInHexes(board, origin, pos) === range);
}

/**
 * Posiciones alcanzables moviéndose hasta `maxSteps` casillas por hexágonos
 * vacíos (Caballería ligera). Cada paso cae en una casilla sin unidades.
 */
export function reachableWithin(board: Board, origin: Position, maxSteps: number, occupied: (pos: Position) => boolean): Position[] {
  const reachable = new Set<Position>();
  const queue: { pos: Position; steps: number }[] = [{ pos: origin, steps: 0 }];
  const seen = new Set<Position>([origin]);
  while (queue.length > 0) {
    const { pos, steps } = queue.shift()!;
    if (steps > 0) reachable.add(pos);
    if (steps >= maxSteps) continue;
    for (const neighbor of board.getNeighbors(pos)) {
      if (seen.has(neighbor) || occupied(neighbor)) continue;
      seen.add(neighbor);
      queue.push({ pos: neighbor, steps: steps + 1 });
    }
  }
  return [...reachable];
}
