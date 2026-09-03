import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { TurnView } from "./views/turn.tsx";

async function renderTurn(player: "player1" | "player2", round: number, initiative: boolean) {
  const setup = await testRender(<TurnView player={player} round={round} initiative={initiative} />, { width: 80, height: 24 });
  // Espera a que la ficha de control (PNG) decodifique y se pinte (píxeles).
  for (let i = 0; i < 15; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      await setup.renderOnce();
      await setup.flush({ maxPasses: 40 });
    });
    if ((setup.captureCharFrame().match(/[█▀▄▌▐]/g)?.length ?? 0) > 10) break;
  }
  return setup;
}

test("turn reveal for player2 shows the Cuervos faction with the black token", async () => {
  const setup = await renderTurn("player2", 3, true);
  try {
    const frame = setup.captureCharFrame();
    expect(frame).toContain("CAMBIO DE TURNO");
    expect(frame).toContain("RONDA 3 · CON INICIATIVA");
    expect(frame).toContain("TURNO DE CUERVOS");
    expect(frame).toContain("Pulsa Enter para empezar tu turno");
    // La ficha negra se pinta como imagen (píxeles) una vez cargada.
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(10);
  } finally {
    setup.renderer.destroy();
  }
});

test("turn reveal for player1 shows Lobos without initiative", async () => {
  const setup = await renderTurn("player1", 2, false);
  try {
    const frame = setup.captureCharFrame();
    expect(frame).toContain("RONDA 2");
    expect(frame).toContain("TURNO DE LOBOS");
    expect(frame).not.toContain("CON INICIATIVA");
    // La ficha blanca se pinta como imagen (píxeles) una vez cargada.
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(10);
  } finally {
    setup.renderer.destroy();
  }
});