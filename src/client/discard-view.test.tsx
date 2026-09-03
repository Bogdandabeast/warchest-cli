import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import type { GameStateView } from "./engine-view.ts";
import { DiscardView } from "./views/discard.tsx";

function view(): GameStateView {
  return {
    round: 2,
    currentPlayer: "player1",
    phase: "playing",
    board: {},
    players: {
      // Un Arquero jugado BOCA ARRIBA (maniobra) y una moneda Real BOCA ABAJO
      // (siempre): la Real se muestra con el dorso (ficha de control).
      player1: { id: "player1", faction: "Lobos", unitCards: [], markersPlaced: 0, markersTotal: 6, discard: [{ type: "arquero", faceUp: true }, { royal: true, faceUp: false }] },
      player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 0, markersTotal: 6, discard: [{ type: "piquero", faceUp: false }, { type: "piquero", faceUp: true }] },
    },
    localPlayer: "player1",
    initiative: "player2",
    hand: [],
    reserve: {},
    markers: { player1: 0, player2: 0 },
    pendingFreeManeuvers: [],
    lastEvents: [],
  };
}

test("discard zone shows each player's played coins with counts", async () => {
  const setup = await testRender(<DiscardView view={view()} />, { width: 100, height: 10 });
  try {
    // Espera a que los PNG de las tropas decodifiquen y se pinten (píxeles).
    for (let i = 0; i < 12; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        await setup.renderOnce();
        await setup.flush({ maxPasses: 40 });
      });
      if ((setup.captureCharFrame().match(/[█▀▄▌▐]/g)?.length ?? 0) > 10) break;
    }
    const frame = setup.captureCharFrame();
    expect(frame).toContain("LOBOS · 2 jugadas");
    expect(frame).toContain("CUERVOS · 2 jugadas");
    // Imágenes dibujadas: el Arquero boca arriba (PNG de la tropa) y los
    // dorsos boca abajo (fichas de control blanca/negra) son píxeles.
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(0);
    expect(frame).toContain("REGISTRO");
  } finally {
    setup.renderer.destroy();
  }
});

test("discard zone shows an empty message when nothing has been played", async () => {
  const empty = { ...view(), players: { player1: { ...view().players.player1, discard: [] }, player2: { ...view().players.player2, discard: [] } } };
  const setup = await testRender(<DiscardView view={empty} />, { width: 100, height: 10 });
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("LOBOS · 0 jugadas");
    expect(frame).toContain("sin monedas jugadas");
  } finally {
    setup.renderer.destroy();
  }
});