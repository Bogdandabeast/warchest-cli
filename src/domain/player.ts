/**
 * Jugador (spec §3.2.4).
 *
 * Colecciones del sistema bag-building: la moneda real vive DENTRO de la
 * bolsa como objeto `RoyalCoin` (decisión del usuario: entra en la bolsa y
 * al robarse solo sirve para acciones de descarte boca abajo o la táctica de
 * la Guardia Real). La reserva solo contiene monedas de tropa.
 */
import { Bag } from "./coins.ts";
import { DiscardPile } from "./coins.ts";
import { Hand } from "./coins.ts";
import { Reserve } from "./coins.ts";
import { RoyalCoin } from "./coins.ts";
import type { RandomSource } from "./coins.ts";
import type { PlayerId } from "./types.ts";
import type { UnitType } from "./units.ts";

/** Fichas de dominio totales de cada jugador (spec §4.1 y regla real). */
export const CONTROL_MARKERS_PER_PLAYER = 6;

/** Nombre de la facción de cada jugador (Lobos = amarillo, Cuervos = morado). */
export const FACTION_NAMES: Readonly<Record<PlayerId, string>> = {
  player1: "Lobos",
  player2: "Cuervos",
};

export class Player {
  readonly id: PlayerId;
  readonly factionName: string;
  /** Tipos de unidad elegidos en el draft (4 por jugador). */
  readonly unitCards: UnitType[];
  readonly bag: Bag;
  readonly hand: Hand;
  readonly discard: DiscardPile;
  readonly reserve: Reserve;

  constructor(id: PlayerId, unitCards: UnitType[]) {
    this.id = id;
    this.factionName = FACTION_NAMES[id];
    this.unitCards = unitCards.slice();
    this.bag = new Bag();
    this.hand = new Hand();
    this.discard = new DiscardPile();
    this.reserve = new Reserve();
  }

  /** Número total de fichas de dominio del jugador. */
  get controlMarkers(): number {
    return CONTROL_MARKERS_PER_PLAYER;
  }

  /**
   * Roba `count` monedas de la bolsa a la mano. Si la bolsa se agota, baraja
   * el descarte en la bolsa (spec §3.2.4 / §4.4). Devuelve las monedas
   * realmente robadas (pueden ser menos si no hay suficientes).
   */
  drawCoins(count: number, random: RandomSource = Math.random): number {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`drawCoins exige una cantidad entera no negativa; se recibió ${count}.`);
    }
    let drawn = 0;
    while (drawn < count) {
      const result = this.bag.draw(count - drawn, random);
      for (const coin of result.drawn) this.hand.add(coin);
      drawn += result.drawn.length;
      if (this.bag.isEmpty()) {
        if (this.discard.isEmpty()) break;
        this.discard.shuffleInto(this.bag);
        this.bag.shuffle(random);
      }
    }
    return drawn;
  }

  /** Descarta todas las monedas de la mano al final de la ronda. */
  discardHand(): void {
    for (const coin of this.hand.toArray()) {
      this.discard.add(coin);
    }
    this.hand.clear();
  }

  /** ¿Puede reclutar (monedas en la reserva y alguna moneda en la mano)? */
  canRecruit(): boolean {
    return this.reserve.total() > 0 && !this.hand.isEmpty();
  }
}

/** Moneda real del jugador (una única instancia que entra en la bolsa). */
export function createRoyalCoin(): RoyalCoin {
  return new RoyalCoin();
}
