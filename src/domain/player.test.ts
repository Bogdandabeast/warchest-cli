import { describe, expect, test } from "bun:test";
import { Player, CONTROL_MARKERS_PER_PLAYER, FACTION_NAMES } from "./player.ts";
import { RoyalCoin, UnitCoin } from "./coins.ts";

function makePlayer(types: UnitType[] = ["arquero", "caballeria"]): Player {
  return new Player("player1", types);
}

import type { UnitType } from "./units.ts";

describe("Player", () => {
  test("datos de facción y control markers", () => {
    const player = makePlayer();
    expect(player.id).toBe("player1");
    expect(player.factionName).toBe("Lobos");
    expect(player.unitCards).toEqual(["arquero", "caballeria"]);
    expect(player.controlMarkers).toBe(CONTROL_MARKERS_PER_PLAYER);
    expect(CONTROL_MARKERS_PER_PLAYER).toBe(6);
    expect(FACTION_NAMES.player2).toBe("Cuervos");
  });

  test("drawCoins roba de la bolsa a la mano", () => {
    const player = makePlayer();
    player.bag.addUnit("arquero", 2);
    player.bag.add(new RoyalCoin());
    const r = () => 0;
    expect(player.drawCoins(2, r)).toBe(2);
    expect(player.hand.total()).toBe(2);
    expect(player.bag.total()).toBe(1);
  });

  test("drawCoins baraja el descarte en la bolsa si se agota", () => {
    const player = makePlayer();
    player.bag.add(new UnitCoin("caballeria"));
    player.discard.addUnit("arquero", 2);
    const r = () => 0;
    expect(player.drawCoins(3, r)).toBe(3);
    expect(player.hand.total()).toBe(3);
    expect(player.discard.isEmpty()).toBe(true);
  });

  test("drawCoins devuelve menos si no hay suficientes monedas", () => {
    const player = makePlayer();
    player.bag.addUnit("arquero", 1);
    expect(player.drawCoins(3, () => 0)).toBe(1);
  });

  test("drawCoins rechaza cantidades negativas o fraccionarias sin tocar colecciones", () => {
    const player = makePlayer();
    player.bag.addUnit("arquero", 2);
    expect(() => player.drawCoins(-1)).toThrow(/entera no negativa/);
    expect(() => player.drawCoins(1.5)).toThrow(/entera no negativa/);
    expect(player.hand.total()).toBe(0);
    expect(player.bag.total()).toBe(2);
  });

  test("discardHand descarta todas las monedas de la mano", () => {
    const player = makePlayer();
    player.hand.addUnit("arquero", 2);
    player.hand.add(new RoyalCoin());
    player.discardHand();
    expect(player.hand.total()).toBe(0);
    expect(player.discard.total()).toBe(3);
    expect(player.discard.hasRoyal()).toBe(true);
  });

  test("canRecruit exige monedas en reserva y en mano", () => {
    const player = makePlayer();
    expect(player.canRecruit()).toBe(false);
    player.reserve.addUnit("piquero");
    expect(player.canRecruit()).toBe(false);
    player.hand.addUnit("arquero");
    expect(player.canRecruit()).toBe(true);
  });
});
