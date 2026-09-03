import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { GameStateView } from "./engine-view.ts";
import { hexBoardCanvas, hexBoardLayout } from "./hex-board.ts";
import { TargetingView } from "./views/targeting.tsx";

function view(): GameStateView {
  return {
    round: 3,
    currentPlayer: "player1",
    phase: "playing",
    board: {
      "C1": { terrain: "base-lobos", controlledBy: "player1", unit: { type: "caballeria", owner: "player1", coins: 2 } },
      "F2": { terrain: "base-lobos", controlledBy: "player1" },
      "B10": { terrain: "base-cuervos", controlledBy: "player2", unit: { type: "piquero", owner: "player2", coins: 1 } },
      "D6": { terrain: "normal" },
    },
    players: { player1: { id: "player1", faction: "Lobos", unitCards: [], markersPlaced: 2, markersTotal: 6 }, player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 1, markersTotal: 6 } },
    localPlayer: "player1",
    initiative: "player2",
    hand: [],
    reserve: {},
    markers: { player1: 2, player2: 1 },
    pendingFreeManeuvers: [],
    lastEvents: [],
  };
}

test("ability targeting renders the step title and selects the hex on the dimmed board", async () => {
  const canvas = hexBoardCanvas({ width: 90, height: 44 });
  // Los destinos de la Caballería ligera se eligen sobre el tablero: F2 es el
  // blanco válido y el resto de casillas se oscurece.
  const setup = await testRender(
    <TargetingView view={view()} action="habilidad" title="Caballería ligera: destino a ≤2 casillas" targets={["F2"]} selected={0} />,
    { width: 90, height: 44 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Caballería ligera: destino a ≤2 casillas");
    expect(frame).toContain("◆"); // cursor sobre el destino
    expect(frame).toContain("▶ F2");
    // La unidad de C1 (no es blanco) queda oculta en modo señalamiento.
    expect(frame).not.toContain("L♞×2");
  } finally {
    setup.renderer.destroy();
  }
});

test("ability targeting without a title keeps the default ELIGE OBJETIVO line", async () => {
  const setup = await testRender(
    <TargetingView view={view()} action="deploy" targets={["F2"]} selected={0} />,
    { width: 90, height: 44 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("ELIGE OBJETIVO · DEPLOY");
  } finally {
    setup.renderer.destroy();
  }
});

test("attack targeting names the unit under the cursor (decidir a quién atacar)", async () => {
  // B10 tiene al Piquero enemigo; el pie muestra a QUIÉN apuntas.
  const setup = await testRender(
    <TargetingView view={view()} action="attack" targets={["B10", "D6"]} selected={0} />,
    { width: 90, height: 44 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("▶ B10 · Piquero");
    // Al mover el cursor a una casilla sin unidad (D6) no se inventa nombre.
    const setup2 = await testRender(
      <TargetingView view={view()} action="move" targets={["D6"]} selected={0} />,
      { width: 90, height: 44 },
    );
    try {
      await setup2.renderOnce();
      await setup2.flush({ maxPasses: 10 });
      expect(setup2.captureCharFrame()).toContain("▶ D6");
    } finally {
      setup2.renderer.destroy();
    }
  } finally {
    setup.renderer.destroy();
  }
});