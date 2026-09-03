import { describe, expect, test } from "bun:test";
import { Bag, Coin, DiscardPile, Hand, Reserve, RoyalCoin, UnitCoin, shuffle } from "./coins.ts";

describe("Coin hierarchy", () => {
  test("UnitCoin y RoyalCoin heredan de Coin con su etiqueta", () => {
    const unit = new UnitCoin("arquero");
    const royal = new RoyalCoin();
    expect(unit).toBeInstanceOf(Coin);
    expect(unit.label).toBe("Arquero");
    expect(unit.type).toBe("arquero");
    expect(unit.isRoyal()).toBe(false);
    expect(royal).toBeInstanceOf(Coin);
    expect(royal.label).toBe("Moneda real");
    expect(royal.isRoyal()).toBe(true);
  });
});

describe("CoinCollection", () => {
  test("recuento por tipo, real y total", () => {
    const bag = new Bag();
    bag.addUnit("arquero", 2);
    bag.addUnit("caballeria", 1);
    bag.addRoyal();
    expect(bag.total()).toBe(4);
    expect(bag.countUnit("arquero")).toBe(2);
    expect(bag.countUnit("caballeria")).toBe(1);
    expect(bag.hasUnit("arquero")).toBe(true);
    expect(bag.hasUnit("piquero")).toBe(false);
    expect(bag.hasRoyal()).toBe(true);
  });

  test("removeUnit y removeRoyal retiran solo si existen", () => {
    const bag = new Bag();
    bag.addUnit("arquero", 2);
    bag.addRoyal();
    expect(bag.removeUnit("arquero")).toBe(true);
    expect(bag.countUnit("arquero")).toBe(1);
    expect(bag.removeUnit("piquero")).toBe(false);
    expect(bag.removeRoyal()).toBe(true);
    expect(bag.removeRoyal()).toBe(false);
    expect(bag.hasRoyal()).toBe(false);
  });

  test("addRoyal no duplica la moneda real", () => {
    const bag = new Bag();
    bag.addRoyal();
    bag.addRoyal();
    expect(bag.total()).toBe(1);
  });

  test("toArray devuelve copia aislada", () => {
    const bag = new Bag();
    bag.addUnit("arquero");
    const arr = bag.toArray();
    arr.push(new RoyalCoin());
    expect(bag.total()).toBe(1);
    expect(bag.toArray()).toHaveLength(1);
  });
});

describe("Bag", () => {
  test("draw extrae sin reposición hasta agotar", () => {
    const bag = new Bag();
    bag.addUnit("arquero", 2);
    bag.addUnit("caballeria", 1);
    const r = () => 0; // siempre el primero
    const d1 = bag.draw(2, r);
    expect(d1.drawn).toHaveLength(2);
    expect(d1.complete).toBe(true);
    expect(bag.total()).toBe(1);
    const d2 = bag.draw(5, r);
    expect(d2.drawn).toHaveLength(1);
    expect(d2.complete).toBe(false);
    expect(bag.isEmpty()).toBe(true);
  });

  test("draw rechaza fuentes aleatorias fuera de [0, 1)", () => {
    const bag = new Bag();
    bag.addUnit("arquero");
    expect(() => bag.draw(1, () => 1)).toThrow(/\[0, 1\)/);
    expect(bag.total()).toBe(1); // sin robar nada
    expect(() => bag.draw(1, () => -0.1)).toThrow(/\[0, 1\)/);
  });
});

describe("Hand", () => {
  test("play consume una moneda del tipo", () => {
    const hand = new Hand();
    hand.addUnit("arquero", 2);
    expect(hand.play("arquero")).toBe(true);
    expect(hand.countUnit("arquero")).toBe(1);
    expect(hand.play("piquero")).toBe(false);
    expect(hand.playRoyal()).toBe(false);
    hand.addRoyal();
    expect(hand.playRoyal()).toBe(true);
    expect(hand.hasRoyal()).toBe(false);
  });
});

describe("DiscardPile", () => {
  test("shuffleInto vuelca el descarte a la bolsa y resetea el registro", () => {
    const bag = new Bag();
    bag.addUnit("arquero");
    const discard = new DiscardPile();
    discard.addUnit("caballeria", 2);
    discard.addRoyal();
    discard.shuffleInto(bag);
    // Las monedas (tropas + real) se transfieren a la bolsa…
    expect(bag.total()).toBe(4);
    expect(bag.countUnit("caballeria")).toBe(2);
    expect(bag.hasUnit("arquero")).toBe(true);
    expect(bag.hasRoyal()).toBe(true);
    // …el descarte queda vacío y su registro (entradas) también.
    expect(discard.isEmpty()).toBe(true);
    expect(discard.entries()).toEqual([]);
  });

  test("shuffleInto con descarte vacío no altera la bolsa ni el registro", () => {
    const bag = new Bag();
    bag.addUnit("arquero", 2);
    const discard = new DiscardPile();
    discard.shuffleInto(bag);
    expect(bag.total()).toBe(2);
    expect(discard.isEmpty()).toBe(true);
    expect(discard.entries()).toEqual([]);
  });

  test("registra cómo entró cada moneda: boca arriba (maniobra) o boca abajo", () => {
    const discard = new DiscardPile();
    // Maniobra con su tropa → boca arriba; pasar/iniciativa → boca abajo.
    discard.addUnit("caballeria", 1, true);
    discard.addUnit("arquero");
    discard.addUnit("lancero", 2, true);
    discard.addRoyal();
    expect(discard.entries()).toEqual([
      { type: "caballeria", faceUp: true },
      { type: "arquero", faceUp: false },
      { type: "lancero", faceUp: true },
      { type: "lancero", faceUp: true },
      { royal: true, faceUp: false },
    ]);
  });

  test("la moneda Real SIEMPRE se registra boca abajo y sin duplicados", () => {
    const discard = new DiscardPile();
    discard.addRoyal();
    discard.addRoyal();
    expect(discard.total()).toBe(1);
    expect(discard.entries()).toEqual([{ royal: true, faceUp: false }]);
  });

  test("fin de ronda (add de monedas de la mano) entra boca abajo y clear resetea el registro", () => {
    const discard = new DiscardPile();
    discard.add(new UnitCoin("piquero"));
    discard.add(new RoyalCoin());
    expect(discard.entries()).toEqual([
      { type: "piquero", faceUp: false },
      { royal: true, faceUp: false },
    ]);
    discard.clear();
    expect(discard.entries()).toEqual([]);
    expect(discard.isEmpty()).toBe(true);
  });
});

describe("Reserve", () => {
  test("recruit mueve una moneda de la reserva al descarte boca arriba", () => {
    const reserve = new Reserve();
    const discard = new DiscardPile();
    reserve.addUnit("arquero", 3);
    expect(reserve.recruit("arquero", discard)).toBe(true);
    expect(reserve.countUnit("arquero")).toBe(2);
    expect(discard.countUnit("arquero")).toBe(1);
    expect(reserve.recruit("piquero", discard)).toBe(false);
  });

  test("la reserva rechaza la moneda real por cualquier vía de inserción", () => {
    const reserve = new Reserve();
    reserve.addUnit("arquero");
    expect(() => reserve.add(new RoyalCoin())).toThrow(/moneda real/);
    expect(() => reserve.addRoyal()).toThrow(/moneda real/);
    // mergeFrom valida antes de mutar: ni la reserva ni la fuente cambian.
    const discard = new DiscardPile();
    discard.addRoyal();
    expect(() => reserve.mergeFrom(discard)).toThrow(/moneda real/);
    expect(discard.hasRoyal()).toBe(true);
    expect(reserve.total()).toBe(1); // solo la moneda de tropa inicial
  });
});

describe("shuffle", () => {
  test("es estable con un generador determinista", () => {
    const items = ["a", "b", "c", "d"];
    const r = () => 0.5;
    const out = shuffle(items, r);
    expect(out).toHaveLength(items.length);
    expect(new Set(out).size).toBe(items.length);
    // No muta el original.
    expect(items).toEqual(["a", "b", "c", "d"]);
  });

  test("rechaza fuentes aleatorias fuera de [0, 1)", () => {
    expect(() => shuffle(["a", "b"], () => 1)).toThrow(/\[0, 1\)/);
    expect(() => shuffle(["a", "b"], () => 1.5)).toThrow(/\[0, 1\)/);
  });
});
