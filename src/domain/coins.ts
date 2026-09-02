/**
 * Monedas y colecciones (spec §3.2.5).
 *
 * Modelo de monedas aprobado por el usuario: una clase base `Coin` y dos
 * subclases — `UnitCoin` (moneda de tropa, con su tipo) y `RoyalCoin`
 * (moneda real). La moneda real SÍ vive dentro de las colecciones (entra en
 * la bolsa inicial, se roba y se descarta como una moneda más); nunca está
 * en la Reserva.
 */

import { UNIT_NAMES } from "./units.ts";
import type { UnitType } from "./units.ts";

/** Generador de aleatoriedad inyectable (para pruebas deterministas). */
export type RandomSource = () => number;

/** Moneda genérica (spec §3.2.5: la moneda real NO es un tipo de unidad). */
export abstract class Coin {
  /** Etiqueta mostrable. */
  abstract readonly label: string;

  /** ¿Es la moneda real? */
  isRoyal(): boolean {
    return this instanceof RoyalCoin;
  }
}

/** Moneda de un tipo de tropa. */
export class UnitCoin extends Coin {
  readonly type: UnitType;

  constructor(type: UnitType) {
    super();
    this.type = type;
  }

  get label(): string {
    return UNIT_NAMES[this.type];
  }

  override isRoyal(): false {
    return false;
  }
}

/** La moneda real: una por jugador, entra en su bolsa. */
export class RoyalCoin extends Coin {
  get label(): string {
    return "Moneda real";
  }

  override isRoyal(): true {
    return true;
  }
}

/** Valida el valor de una fuente aleatoria: debe estar en [0, 1). */
function assertRandomValue(value: number): void {
  if (!(value >= 0 && value < 1)) {
    throw new Error("RandomSource debe devolver valores en [0, 1).");
  }
}

/** Fisher-Yates sobre un array (utilidad compartida). */
export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    assertRandomValue(value);
    const j = Math.floor(value * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Colección de monedas. Almacena objetos `Coin` (monedas de tropa y, en
 * bolsa/mano/descarte, la moneda real). Operaciones comunes de recuento.
 */
export abstract class CoinCollection {
  protected coins: Coin[] = [];

  /** Añade una moneda. */
  add(coin: Coin, count = 1): void {
    for (let i = 0; i < count; i++) this.coins.push(coin);
  }

  /** Añade `count` monedas de un tipo de tropa. */
  addUnit(type: UnitType, count = 1): void {
    this.add(new UnitCoin(type), count);
  }

  /** Añade la moneda real (una sola; añadir más no tiene efecto de juego). */
  addRoyal(): void {
    if (!this.hasRoyal()) this.coins.push(new RoyalCoin());
  }

  /**
   * Retira una moneda del tipo indicado. Devuelve `false` si no hay ninguna
   * (sin cambios). Retira una moneda de tropa, nunca la real.
   */
  removeUnit(type: UnitType): boolean {
    const index = this.coins.findIndex((coin) => coin instanceof UnitCoin && coin.type === type);
    if (index < 0) return false;
    this.coins.splice(index, 1);
    return true;
  }

  /** Retira la moneda real si está. Devuelve `false` si no la hay. */
  removeRoyal(): boolean {
    const index = this.coins.findIndex((coin) => coin instanceof RoyalCoin);
    if (index < 0) return false;
    this.coins.splice(index, 1);
    return true;
  }

  /** Número de monedas de un tipo de tropa. */
  countUnit(type: UnitType): number {
    return this.coins.filter((coin) => coin instanceof UnitCoin && coin.type === type).length;
  }

  /** ¿Tiene monedas de un tipo de tropa? */
  hasUnit(type: UnitType): boolean {
    return this.countUnit(type) > 0;
  }

  /** ¿Tiene la moneda real? */
  hasRoyal(): boolean {
    return this.coins.some((coin) => coin instanceof RoyalCoin);
  }

  /** Total de monedas (tropas + real). */
  total(): number {
    return this.coins.length;
  }

  /** Copia de las monedas (sin poder mutar la colección). */
  toArray(): Coin[] {
    return this.coins.slice();
  }

  /** ¿Está vacía? */
  isEmpty(): boolean {
    return this.coins.length === 0;
  }

  /** Vacía la colección. */
  clear(): void {
    this.coins = [];
  }
}

/** Resultado de un robo de la bolsa. */
export interface DrawResult {
  /** Monedas extraídas. */
  drawn: Coin[];
  /** ¿Se pudo completar la cantidad pedida? */
  complete: boolean;
}

/**
 * Bolsa de robo: las monedas se roban al azar sin reposición. Contiene la
 * moneda real desde el inicio (se puede robar).
 */
export class Bag extends CoinCollection {
  /** Roba hasta `count` monedas al azar. */
  draw(count: number, random: RandomSource = Math.random): DrawResult {
    const drawn: Coin[] = [];
    const remaining = this.coins;
    for (let i = 0; i < count && remaining.length > 0; i++) {
      const value = random();
      assertRandomValue(value);
      const index = Math.floor(value * remaining.length);
      const coin = remaining.splice(index, 1)[0];
      if (coin === undefined) {
        throw new Error("No se pudo robar una moneda de la bolsa (índice fuera de rango).");
      }
      drawn.push(coin);
    }
    return { drawn, complete: drawn.length === count };
  }

  /** Mezcla el orden interno (no afecta al robo, que ya es aleatorio). */
  shuffle(random: RandomSource = Math.random): void {
    this.coins = shuffle(this.coins, random);
  }

  /** Vuelca aquí todas las monedas de otra colección. */
  mergeFrom(collection: CoinCollection): void {
    for (const coin of collection.toArray()) this.coins.push(coin);
    collection.clear();
  }
}

/**
 * Mano del jugador: las monedas robadas disponibles para actuar en el turno.
 */
export class Hand extends CoinCollection {
  /**
   * Consume (retira) una moneda del tipo. Devuelve `false` si no hay ninguna.
   * El destino (tablero, descarte…) lo decide la acción concreta.
   */
  play(type: UnitType): boolean {
    return this.removeUnit(type);
  }

  /** Consume la moneda real de la mano. */
  playRoyal(): boolean {
    return this.removeRoyal();
  }
}

/**
 * Pila de descarte: las monedas descartadas (boca abajo o boca arriba) que
 * volverán a la bolsa al barajar. La moneda real descartada vive aquí como
 * objeto `RoyalCoin`.
 */
export class DiscardPile extends CoinCollection {
  /** Baraja todo el descarte en la bolsa (spec §3.2.5). */
  shuffleInto(bag: Bag): void {
    bag.mergeFrom(this);
  }
}

/**
 * Reserva (supply): monedas de tropa fuera de la bolsa que solo entran en
 * juego mediante el reclutamiento. La moneda real nunca está aquí: todas las
 * vías de inserción la rechazan antes de mutar la colección.
 */
export class Reserve extends CoinCollection {
  override add(coin: Coin, count = 1): void {
    if (coin.isRoyal()) {
      throw new Error("La moneda real no puede estar en la reserva.");
    }
    super.add(coin, count);
  }

  override addRoyal(): void {
    throw new Error("La moneda real no puede estar en la reserva.");
  }

  mergeFrom(collection: CoinCollection): void {
    const coins = collection.toArray();
    if (coins.some((coin) => coin.isRoyal())) {
      throw new Error("La moneda real no puede estar en la reserva.");
    }
    for (const coin of coins) super.add(coin);
    collection.clear();
  }

  /**
   * Recluta una moneda del tipo indicado: la saca de la reserva y la coloca
   * boca arriba en la pila de descarte. Devuelve `false` si no hay monedas
   * de ese tipo en la reserva.
   */
  recruit(type: UnitType, discard: DiscardPile): boolean {
    if (!this.removeUnit(type)) return false;
    discard.addUnit(type);
    return true;
  }
}
