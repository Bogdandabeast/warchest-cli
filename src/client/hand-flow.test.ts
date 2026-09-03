import { describe, expect, test } from "bun:test";
import { viableActions } from "./menu-viability.ts";
import type { GameStateView } from "./engine-view.ts";

/**
 * Vista de una partida en curso (fase playing, turno del jugador local) con
 * una base propia libre para desplegar. Es la misma función de selección de
 * acciones que usa la TUI (`app.tsx` delega en `viableActions`): aquí se
 * ejercita el camino real de producción, no una copia local.
 */
function playingView(hand: readonly { type?: string; royal?: true }[]): GameStateView {
  return {
    board: { C1: { terrain: "base-lobos", controlledBy: "player1" } },
    players: {
      player1: { id: "player1", faction: "Lobos", unitCards: ["arquero"], markersPlaced: 0, markersTotal: 6 },
      player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 0, markersTotal: 6 },
    },
    localPlayer: "player1",
    currentPlayer: "player1",
    initiative: "player1", // sin opción de reclamarla (ya es suya)
    round: 1,
    phase: "playing",
    hand,
    reserve: { arquero: 1 },
    markers: { player1: 0, player2: 0 },
    pendingFreeManeuvers: [],
    lastEvents: [],
  } as unknown as GameStateView;
}

describe("guided hand flow (producción: viableActions)", () => {
  test("una moneda de tropa ofrece desplegar/reclutar/pasar y la real solo descartes", () => {
    const view = playingView([{ type: "arquero" }, { royal: true }]);
    // Moneda de tropa: además de reclutar/pasar puede desplegar la tropa.
    expect(viableActions(view, 0)).toEqual(["deploy", "recruit", "pass"]);
    // Moneda REAL: no actúa como ninguna unidad → solo descartes boca abajo.
    expect(viableActions(view, 1)).toEqual(["recruit", "pass"]);
  });

  test("un índice fuera de la mano no ofrece ninguna acción", () => {
    const view = playingView([{ type: "arquero" }]);
    expect(viableActions(view, 5)).toEqual([]);
    expect(viableActions(view, 0)).not.toEqual([]);
  });
});
