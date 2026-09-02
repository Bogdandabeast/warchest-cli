/**
 * Configuración de la partida (spec §4.1, ciclo 2).
 *
 * Flujo acordado con el usuario:
 *  1. Se reparten 8 cartas de unidad aleatorias de las 16.
 *  2. Draft en el patrón 1-2-2-2-1 (empieza player1; el segundo en elegir,
 *     player2, recibe la iniciativa de la primera ronda). Cada jugador
 *     termina con 4 unidades.
 *  3. SOLO después del draft se montan las bolsas: 1 moneda real + 2 monedas
 *     de cada tipo elegido a la bolsa; el resto (total − 2) a la reserva.
 *  4. Cada jugador coloca 2 de sus 6 fichas de dominio sobre sus bases de
 *     inicio (C1/F2 para player1, B10/E11 para player2); las bases empiezan
 *     VACÍAS de tropas.
 *
 * El robo de las 3 monedas iniciales NO entra en este ciclo (será el ciclo
 * de rondas, spec §4.2).
 */
import { Board } from "./board.ts";
import { RoyalCoin } from "./coins.ts";
import { UnitCoin } from "./coins.ts";
import { Player } from "./player.ts";
import type { PlayerId } from "./types.ts";
import { UNIT_TYPES, UNIT_TOTAL_COINS, UNITS_PER_PLAYER } from "./units.ts";
import type { UnitType } from "./units.ts";
import { shuffle } from "./coins.ts";
import type { RandomSource } from "./coins.ts";

/** Cartas que se reparten para el draft (spec §4.1: 8). */
export const DRAFT_CARDS = 8;

/**
 * Patrón de elección del draft: el tamaño del lote que elige cada jugador en
 * cada turno, alternando. 1-2-2-2-1 reparte 4 cartas a cada uno y deja la
 * última para quien empezó (spec §4.1 y regla avanzada del juego físico).
 */
export const DRAFT_PATTERN: readonly { player: PlayerId; count: number }[] = [
  { player: "player1", count: 1 },
  { player: "player2", count: 2 },
  { player: "player1", count: 2 },
  { player: "player2", count: 2 },
  { player: "player1", count: 1 },
];

/**
 * Secuencia de elecciones del draft, expandida a una elección por carta:
 * p1 (1), p2 (2), p1 (2), p2 (2), p1 (1) → 8 elecciones y 4 cartas por
 * jugador.
 */
export const DRAFT_PICK_SEQUENCE: readonly PlayerId[] = DRAFT_PATTERN.flatMap(({ player, count }) =>
  Array.from({ length: count }, () => player as PlayerId),
);

/** Sorteo de las 8 cartas del draft: 8 tipos únicos al azar de las 16. */
export function dealDraftCards(random: RandomSource = Math.random): UnitType[] {
  return shuffle(UNIT_TYPES, random).slice(0, DRAFT_CARDS);
}

/**
 * Sesión de draft interactiva: lleva la cuenta de qué jugador elige cuántas
 * cartas en cada turno (patrón 1-2-2-2-1) y valida cada elección.
 */
export class DraftSession {
  /** Cartas disponibles para elegir. */
  private pool: UnitType[];
  /** Cartas ya elegidas por cada jugador. */
  private readonly chosen: Record<PlayerId, UnitType[]>;
  private step = 0;

  constructor(pool: UnitType[] = dealDraftCards()) {
    if (pool.length !== DRAFT_CARDS) {
      throw new Error(`El draft necesita ${DRAFT_CARDS} cartas, se recibieron ${pool.length}.`);
    }
    if (new Set(pool).size !== pool.length) {
      throw new Error("El draft no puede tener cartas repetidas.");
    }
    this.pool = pool.slice();
    this.chosen = { player1: [], player2: [] };
  }

  /** Cartas que quedan por elegir (legibles por la UI). */
  get available(): readonly UnitType[] {
    return this.pool.slice();
  }

  /** ¿A quién le toca elegir ahora (undefined si el draft terminó)? */
  get currentPlayer(): PlayerId | undefined {
    return this.step < DRAFT_PICK_SEQUENCE.length ? DRAFT_PICK_SEQUENCE[this.step] : undefined;
  }

  /** Cuántas cartas debe coger el jugador actual en este turno (lote del patrón). */
  get currentCount(): number {
    if (this.currentPlayer === undefined) return 0;
    let count = 0;
    for (let i = this.step; i < DRAFT_PICK_SEQUENCE.length && DRAFT_PICK_SEQUENCE[i] === this.currentPlayer; i++) {
      count++;
    }
    return count;
  }

  /**
   * Progreso dentro del lote actual (p. ej. carta 1 de 2): la UI muestra qué
   * elección va dentro del turno del jugador, no solo el total.
   */
  get currentLot(): { total: number; picked: number } {
    if (this.currentPlayer === undefined) return { total: 0, picked: 0 };
    const player = this.currentPlayer;
    let start = this.step;
    while (start > 0 && DRAFT_PICK_SEQUENCE[start - 1] === player) start--;
    let end = start;
    while (end < DRAFT_PICK_SEQUENCE.length && DRAFT_PICK_SEQUENCE[end] === player) end++;
    return { total: end - start, picked: this.step - start };
  }

  /** ¿Terminó el draft (4 unidades por jugador)? */
  get isComplete(): boolean {
    return this.step >= DRAFT_PICK_SEQUENCE.length;
  }

  /** Cartas elegidas por cada jugador (al terminar, 4 por jugador). */
  get results(): Readonly<Record<PlayerId, readonly UnitType[]>> {
    return {
      player1: [...this.chosen.player1],
      player2: [...this.chosen.player2],
    };
  }

  /**
   * Elige una carta para el jugador al que le toca. Lanza un error si no le
   * toca a ese jugador, si la carta no está disponible o si ya tiene sus 4.
   */
  pick(player: PlayerId, type: UnitType): void {
    if (this.isComplete) throw new Error("El draft ya terminó.");
    if (this.currentPlayer !== player) {
      throw new Error(`Le toca elegir a ${this.currentPlayer}, no a ${player}.`);
    }
    if (this.chosen[player].length >= UNITS_PER_PLAYER) {
      throw new Error(`El jugador ${player} ya tiene sus ${UNITS_PER_PLAYER} unidades.`);
    }
    const index = this.pool.indexOf(type);
    if (index < 0) {
      throw new Error(`La unidad ${type} ya no está disponible en el draft.`);
    }
    this.pool.splice(index, 1);
    this.chosen[player].push(type);
    this.step += 1;
  }
}

/**
 * Configuración final de la partida tras el draft: jugadores con sus
 * colecciones montadas, fichas de dominio iniciales colocadas e iniciativa.
 */
export interface GameConfiguration {
  player1: Player;
  player2: Player;
  /** Jugador con la iniciativa en la primera ronda (el segundo en elegir). */
  initiative: PlayerId;
}

/**
 * Monta la partida sobre un tablero dado: crea los jugadores a partir de las
 * cartas elegidas, llena bolsa (moneda real + 2 por tipo) y reserva
 * (total − 2 por tipo), y coloca las 2 fichas de dominio iniciales de cada
 * jugador sobre sus bases (vacías de tropas).
 */
export function configureGame(board: Board, chosen: Readonly<Record<PlayerId, readonly UnitType[]>>): GameConfiguration {
  const player1 = new Player("player1", chosen.player1 as UnitType[]);
  const player2 = new Player("player2", chosen.player2 as UnitType[]);

  // Validar TODOS los requisitos del tablero ANTES de mutar nada: si un
  // jugador no tiene sus 2 bases, se lanza sin haber colocado fichas.
  for (const player of [player1, player2]) {
    const starts = board.getStartLocations(player.id);
    if (starts.length !== 2) {
      throw new Error(`El jugador ${player.id} debe tener 2 bases de inicio; tiene ${starts.length}.`);
    }
  }

  for (const player of [player1, player2]) {
    fillInitialCollections(player);
    placeInitialControlMarkers(board, player);
  }

  // El segundo en elegir (player2) toma la iniciativa (spec §4.1.4).
  return { player1, player2, initiative: "player2" };
}

/** Llena las colecciones iniciales del jugador (bolsa + reserva) tras el draft. */
function fillInitialCollections(player: Player): void {
  for (const type of player.unitCards) {
    const total = UNIT_TOTAL_COINS[type];
    if (total < 2) {
      throw new Error(`La unidad ${type} tiene menos de 2 monedas (${total}); no puede llenar la bolsa inicial.`);
    }
    // 2 monedas del tipo → bolsa; el resto → reserva.
    for (let i = 0; i < 2; i++) player.bag.add(new UnitCoin(type));
    for (let i = 2; i < total; i++) player.reserve.add(new UnitCoin(type));
  }
  // La moneda real entra en la bolsa (decisión del usuario).
  player.bag.add(new RoyalCoin());
}

/** Coloca una ficha de dominio en cada base de inicio del jugador (ya validadas). */
function placeInitialControlMarkers(board: Board, player: Player): void {
  for (const position of board.getStartLocations(player.id)) {
    board.placeControlMarker(position, player.id);
  }
}
