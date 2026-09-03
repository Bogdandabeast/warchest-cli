import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { GameStateView } from "./engine-view.ts";
import { ImageBoardView } from "./views/board-image.tsx";
import { loadBoardImages } from "./board-images.ts";
import type { BoardImages } from "./board-images.ts";

let cachedImages: BoardImages | null | undefined;

async function boardImages(): Promise<BoardImages | null> {
  cachedImages ??= await loadBoardImages();
  return cachedImages;
}

function view(): GameStateView {
  return {
    round: 1,
    currentPlayer: "player1",
    phase: "playing",
    board: {
      "A3": { terrain: "normal" },
      "A7": { terrain: "base-neutral" },
      "C1": { terrain: "base-lobos" },
      "B10": { terrain: "base-cuervos" },
      "D2": { terrain: "base-neutral", controlledBy: "player1" },
      "E5": { terrain: "base-neutral", unit: { type: "caballero", owner: "player2", coins: 2 } },
    },
    players: { player1: { id: "player1", faction: "Lobos", unitCards: [], markersPlaced: 0, markersTotal: 6 }, player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 0, markersTotal: 6 } },
    localPlayer: "player1",
    initiative: "player2",
    hand: [],
    reserve: {},
    markers: { player1: 0, player2: 0 },
    pendingFreeManeuvers: [],
    lastEvents: [],
  };
}

test("image board renders the playmat PNG with base labels and units", async () => {
  const images = await boardImages();
  if (images === null) { console.warn("skipping: board PNGs not loaded"); return; }
  const setup = await testRender(<ImageBoardView images={images} view={view()} />, { width: 100, height: 40 });
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(0); // playmat block pixels
    expect(frame).toContain("A7"); // neutral base label
    expect(frame).toMatch(/C[♘✕×][a-zA-Z]*/); // unit overlay for player2
  } finally {
    setup.renderer.destroy();
  }
});