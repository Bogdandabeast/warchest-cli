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

/** Valida que una cantidad de monedas sea un entero positivo. */
function assertPositiveInteger(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${what} debe ser un entero positivo; se recibió ${value}.`);
  }
}

export class Unit {
  private static nextInstanceId = 0;

  readonly type: UnitType;
  readonly owner: PlayerId;
  readonly instanceId: number;
  position: Position;
  /** Pila de monedas (vida de la unidad), solo modificable vía métodos. */
  private _coins: number;

  constructor(options: UnitOptions, coins: number = INITIAL_STACK) {
    assertPositiveInteger(coins, "La pila de una unidad");
    this.type = options.type;
    this.owner = options.owner;
    this.instanceId = ++Unit.nextInstanceId;
    this.position = options.position;
    this._coins = coins;
  }

  /**
   * Id estable por instancia (dueño + tipo + instancia): las dos unidades de
   * Infantería del mismo jugador tienen ids distintos. No deriva de la
   * posición porque esta cambia al moverse.
   */
  get id(): string {
    return `${this.owner}:${this.type}#${this.instanceId}`;
  }

  /** Monedas de la pila (lectura). */
  get coins(): number {
    return this._coins;
  }

  /** Refuerza la pila: añade una moneda encima (cantidad entera positiva). */
  addCoin(count = 1): void {
    assertPositiveInteger(count, "El refuerzo");
    this._coins += count;
  }

  /**
   * Retira una moneda de la pila (la de arriba, tras un ataque). Devuelve
   * `false` si la pila quedó vacía (la unidad debe eliminarse del tablero);
   * la moneda retirada sale del juego. Una pila vacía no se decrementa.
   */
  removeCoin(): boolean {
    if (this._coins <= 0) return false;
    this._coins -= 1;
    return this._coins > 0;
  }

  /** ¿Está reforzada (2+ monedas en la pila)? */
  isReinforced(): boolean {
    return this._coins > INITIAL_STACK;
  }
}
