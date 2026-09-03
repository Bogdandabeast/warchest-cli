import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { DraftView } from "./views/draft.tsx";
import { loadAllTroopImages } from "./troop-images.ts";
import { UNIT_NAMES } from "../domain/units.ts";

test("draft cards show the troop image (PNG pixels) with name and coins below", async () => {
  const troops = await loadAllTroopImages();
  if (troops === null) { console.warn("skipping: troop PNGs not loaded"); return; }
  const available = ["alferez", "arquero", "caballero", "caballeria", "caballeria-ligera", "clerigo", "espadachin", "explorador"] as const;
  const setup = await testRender(<DraftView available={available} selected={2} player="Lobos" playerId="player1" lot={{ picked: 0, total: 8 }} chosen={{ player1: [], player2: [] }} />, { width: 100, height: 40 });
  try {
    // Espera a que las imágenes decodifiquen y se pinten (píxeles de bloque).
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        await setup.renderOnce();
        await setup.flush({ maxPasses: 60 });
      });
      if ((setup.captureCharFrame().match(/[█▀▄▌▐]/g)?.length ?? 0) > 40) break;
    }
    const frame = setup.captureCharFrame();
    expect(frame).toContain("WAR CHEST · DRAFT");
    // El PNG de la tropa se dibuja (píxeles) y el nombre + monedas siguen.
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(40);
    for (const type of available) {
      expect(frame).toContain(UNIT_NAMES[type]);
      expect(frame).toContain("monedas");
    }
    expect(frame).toContain("Elige una tropa con ← → y confirma con Enter");
  } finally {
    setup.renderer.destroy();
  }
});

test("draft shows in large the troops each player has already picked", async () => {
  const troops = await loadAllTroopImages();
  if (troops === null) { console.warn("skipping: troop PNGs not loaded"); return; }
  const available = ["caballero", "arquero", "clerigo", "piquero"] as const;
  const chosen = { player1: ["guardia-real", "mercenario"] as const, player2: ["explorador"] as const };
  const setup = await testRender(
    <DraftView available={available} selected={0} player="Cuervos" playerId="player2" lot={{ picked: 0, total: 4 }} chosen={chosen} />,
    { width: 100, height: 40 },
  );
  try {
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        await setup.renderOnce();
        await setup.flush({ maxPasses: 60 });
      });
      if ((setup.captureCharFrame().match(/[█▀▄▌▐]/g)?.length ?? 0) > 40) break;
    }
    const frame = setup.captureCharFrame();
    // Panel de elegidas de AMBOS jugadores con los apodos de las tropas.
    expect(frame).toContain("LOBOS · 2 elegidas");
    expect(frame).toContain("CUERVOS · 1 elegida");
    expect(frame).toContain("Guardia");
    expect(frame).toContain("Mercena");
    expect(frame).toContain("Explora");
    expect(frame).toContain("▶"); // el jugador actual (Cuervos) marcado
  } finally {
    setup.renderer.destroy();
  }
});
