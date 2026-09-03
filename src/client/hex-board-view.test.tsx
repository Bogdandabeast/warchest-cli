import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { GameStateView } from "./engine-view.ts";
import { HexBoardView } from "./views/board.tsx";
import { hexBoardCanvas, hexBoardLayout } from "./hex-board.ts";

function view(): GameStateView {
  return {
    round: 3,
    currentPlayer: "player1",
    phase: "playing",
    board: {
      "C1": { terrain: "base-lobos", controlledBy: "player1", unit: { type: "caballero", owner: "player1", coins: 2 } },
      "F2": { terrain: "base-lobos", controlledBy: "player1" },
      "B10": { terrain: "base-cuervos", controlledBy: "player2", unit: { type: "piquero", owner: "player2", coins: 1 } },
      "A7": { terrain: "base-neutral" },
      "E5": { terrain: "base-neutral", unit: { type: "caballero", owner: "player1", coins: 3 } },
      "D6": { terrain: "normal", unit: { type: "infanteria", owner: "player2", coins: 1 } },
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

test("hex board renders terrain hexagons plus unit/token/label overlays", async () => {
  const canvas = hexBoardCanvas({ width: 90, height: 44 });
  const layout = hexBoardLayout(canvas.cols, canvas.rows);
  const setup = await testRender(
    <HexBoardView layout={layout} images={null} view={view()} cursor="A7" validTargets={["C7", "G5"]} hint="elige objetivo" />,
    { width: 90, height: 44 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("WAR CHEST · RONDA 3");
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(50); // hexágonos de color
    // Overlays: id de base neutral, unidades como marcadores de texto cuando
    // no hay imágenes, cursor y objetivos en la leyenda.
    expect(frame).toContain("A7");
    expect(frame).toContain("L♘×2"); // caballero de lobos en C1
    expect(frame).toContain("L♘×3"); // caballero de lobos apilado en E5
    // Apodos de las unidades DEBAJO de cada moneda (siempre legibles).
    expect(frame).toContain("Caballero");
    expect(frame).toContain("Piquero");
    expect(frame).toContain("◆"); // cursor A7
    expect(frame).toContain("elige objetivo");
  } finally {
    setup.renderer.destroy();
  }
});

test("playableTypes: the current player's usable troops get the ✦ chip", async () => {
  const canvas = hexBoardCanvas({ width: 90, height: 44 });
  const layout = hexBoardLayout(canvas.cols, canvas.rows);
  const state = view();
  // Mano con caballero: C1 (caballero de lobos) es jugable; el infante de
  // cuervos (D6) y el caballero apilado (E5) también son del jugador actual,
  // así que todos los caballeros propios brillan; el piquero enemigo no.
  const setup = await testRender(
    <HexBoardView layout={layout} images={null} view={state} playableTypes={["caballero"]} />,
    { width: 90, height: 44 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    // Chip de acento de las tropas jugables (con ✦) sobre el apodo.
    expect(frame).toContain("✦ Caballero");
    // El enemigo no es jugable: apodo normal, sin ✦.
    expect(frame).toContain("Piquero");
    expect(frame).not.toContain("✦ Piquero");
  } finally {
    setup.renderer.destroy();
  }
});

test("targeting dim mode: hides non-target overlays and keeps the cursor", async () => {
  const canvas = hexBoardCanvas({ width: 90, height: 44 });
  const layout = hexBoardLayout(canvas.cols, canvas.rows);
  const state = view();
  // Desplegar en la base lobos vacía F2; C1 (con caballero) no es objetivo.
  const setup = await testRender(
    <HexBoardView layout={layout} images={null} view={state} cursor="F2" validTargets={["F2"]} hint="elige dónde desplegar" dim />,
    { width: 90, height: 44 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(50); // hexágonos (oscuras + objetivo brillante)
    expect(frame).toContain("◆"); // cursor sobre el objetivo
    expect(frame).not.toContain("L♘×2"); // la unidad de C1 (no objetivo) queda oscura/sin overlay
    expect(frame).toContain("elige dónde desplegar");
  } finally {
    setup.renderer.destroy();
  }
});

test("hex board fits its own canvas box", async () => {
  const canvas = hexBoardCanvas({ width: 90, height: 44 });
  const layout = hexBoardLayout(canvas.cols, canvas.rows);
  const setup = await testRender(
    <HexBoardView layout={layout} images={null} view={view()} />,
    { width: canvas.cols + 2, height: canvas.rows + 4 },
  );
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    // Todas las líneas del lienzo se pintan (tablero entero visible).
    expect(frame.split("\n").filter((line) => line.includes("▀")).length).toBeGreaterThan(layout.rows - 2);
  } finally {
    setup.renderer.destroy();
  }
});
