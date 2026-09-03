import { describe, expect, test } from "bun:test";
import type { GameStateView } from "./engine-view.ts";
import { viableActions } from "./menu-viability.ts";

const base: GameStateView = {
  board: { A0: { terrain: "base-lobos", controlledBy: "player1" } },
  players: {
    player1: { id: "player1", faction: "Lobos", unitCards: ["arquero"], markersPlaced: 1, markersTotal: 6, hand: [{ type: "arquero" }], reserve: { arquero: 1 } },
    player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 0, markersTotal: 6, handHidden: { count: 0 }, reserveHidden: { count: 0 } },
  },
  localPlayer: "player1", currentPlayer: "player1", initiative: "player2", round: 1, phase: "playing", hand: [{ type: "arquero" }], reserve: { arquero: 1 }, markers: { player1: 1, player2: 0 }, pendingFreeManeuvers: [], lastEvents: [],
};

describe("menu viability", () => {
  test("offers only actions supported by the snapshot", () => {
    expect(viableActions(base)).toEqual(["deploy"]);
    expect(viableActions(base, 0)).toEqual(["deploy", "initiative", "recruit", "pass"]);
  });

  test("the Royal coin never inherits the unit actions of other coins in hand", () => {
    const hand: GameStateView = {
      ...base,
      hand: [{ royal: true }, { type: "arquero" }],
      reserve: { arquero: 1 },
    };
    // Moneda real seleccionada: solo descartes boca abajo, NUNCA Desplegar/Mover.
    expect(viableActions(hand, 0)).toEqual(["initiative", "recruit", "pass"]);
    // La moneda de tropa de al lado sigue ofreciendo sus acciones.
    expect(viableActions(hand, 1)).toEqual(["deploy", "initiative", "recruit", "pass"]);
  });
});
