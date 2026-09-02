/**
 * Unidad en el tablero (spec §3.2.3): una pila de monedas del mismo tipo
 * perteneciente a un jugador.
 *
 * Reglas (tabla del usuario y reglamento físico):
 *  - La pila es la vida: se crea con 1 moneda y cada Refuerzo añade 1.
 *  - Al atacar se retira primero la moneda de arriba; si cae la última, la
 *    unidad desaparece del tablero (la moneda eliminada sale del juego).
 *  - Reforzada = pila con 2+ monedas (relevante para el Caballero).
 */
import type { PlayerId, Position } from "./types.ts";
import type { UnitType } from "./units.ts";

/** Número de monedas con las que nace una unidad al desplegarse. */
export const INITIAL_STACK = 1;

export interface UnitOptions {
  type: UnitType;
  owner: PlayerId;
  position: Position;
}

export class Unit {
  readonly type: UnitType;
  readonly owner: PlayerId;
  position: Position;
  /** Monedas de la pila (vida de la unidad). */
  coins: number;

  constructor(options: UnitOptions, coins: number = INITIAL_STACK) {
    this.type = options.type;
    this.owner = options.owner;
    this.position = options.position;
    this.coins = coins;
  }

  /**
   * Id estable por tipo y dueño: solo puede haber una unidad de cada tipo por
   * jugador en el tablero (salvo la Infantería, que gestiona sus dos unidades
   * con un sufijo propio).
   */
  get id(): string {
    return `${this.owner}:${this.type}`;
  }

  /** Refuerza la pila: añade una moneda encima. */
  addCoin(count = 1): void {
    this.coins += count;
  }

  /**
   * Retira una moneda de la pila (la de arriba, tras un ataque). Devuelve
   * `false` si la pila quedó vacía (la unidad debe eliminarse del tablero);
   * la moneda retirada sale del juego.
   */
  removeCoin(): boolean {
    this.coins -= 1;
    return this.coins > 0;
  }

  /** ¿Está reforzada (2+ monedas en la pila)? */
  isReinforced(): boolean {
    return this.coins > INITIAL_STACK;
  }
}
