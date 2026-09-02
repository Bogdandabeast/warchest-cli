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
  test("shuffleInto vuelca el descarte a la bolsa", () => {
    const bag = new Bag();
    bag.addUnit("arquero");
    const discard = new DiscardPile();
    discard.addUnit("caballeria", 2);
    discard.addRoyal();
    discard.shuffleInto(bag);
    expect(bag.total()).toBe(4);
    expect(discard.isEmpty()).toBe(true);
    expect(bag.hasRoyal()).toBe(true);
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
});
