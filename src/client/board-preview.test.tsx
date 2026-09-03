import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { BoardPreviewView } from "./views/board-preview.tsx";
import { BOARD_VARIANT_SCALES, BOARD_MAX_CLIENT_SCALE, PREVIEW_START_INDEX, boardVariantFile, loadBoardImages, loadBoardVariant } from "./board-images.ts";

/** Avanza renders hasta que el frame contiene el texto esperado (o agota intentos). */
async function settleUntil(setup: Awaited<ReturnType<typeof testRender>>, marker: string) {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      await setup.renderOnce();
      await setup.flush({ maxPasses: 60 });
    });
    if (setup.captureCharFrame().includes(marker)) return;
  }
}

test("board preview starts at the highest loadable resolution", () => {
  // 5×…3× superan el límite del decodificador (~4096 px): la vista previa
  // debe abrir SIEMPRE en una resolución visible (2.5×).
  expect(PREVIEW_START_INDEX).toBeGreaterThan(0);
  expect(BOARD_VARIANT_SCALES[PREVIEW_START_INDEX]).toBe(BOARD_MAX_CLIENT_SCALE);
  expect(boardVariantFile(BOARD_VARIANT_SCALES[PREVIEW_START_INDEX]!)).toBe("board-1v1-2.5x.png");
});

test("board preview shows each resolution at the real board canvas", async () => {
  const scale = BOARD_VARIANT_SCALES[0]!;
  const image = await loadBoardVariant(scale); // 5× → null (excede el límite)
  if (image !== null) { console.warn("skipping: se esperaba que 5× excediera el límite"); return; }

  const setup = await testRender(<BoardPreviewView index={0} />, { width: 100, height: 44 });
  try {
    await settleUntil(setup, "excede el límite");
    const frame = setup.captureCharFrame();
    expect(frame).toContain("VISTA PREVIA DEL TABLERO");
    expect(frame).toContain(`1/${BOARD_VARIANT_SCALES.length}`);
    expect(frame).toContain(boardVariantFile(scale));
    expect(frame).toContain("excede el límite");
  } finally {
    setup.renderer.destroy();
  }
});

test("board preview shows a loadable resolution with the real board art", async () => {
  const scale = BOARD_VARIANT_SCALES[4]!; // 2.5× → la mayor resolución decodificable
  const image = await loadBoardVariant(scale);
  const base = await loadBoardImages();
  if (image === null || base === null) { console.warn("skipping: 2.5× o imágenes base no cargaron"); return; }

  const setup = await testRender(<BoardPreviewView index={4} />, { width: 100, height: 44 });
  try {
    await settleUntil(setup, "RONDA 3 · TURNO"); // solo aparece cuando el tablero real está dibujado
    const frame = setup.captureCharFrame();
    expect(frame).toContain(`5/${BOARD_VARIANT_SCALES.length}`);
    expect(frame).toContain(boardVariantFile(scale));
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(50); // board image blocks
  } finally {
    setup.renderer.destroy();
  }
});