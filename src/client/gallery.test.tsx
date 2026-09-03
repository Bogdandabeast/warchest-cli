import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { act } from "react";
import { GalleryView, GALLERY_ROWS, OTHER_ROWS } from "./views/gallery.tsx";
import { loadGalleryImages } from "./views/gallery.tsx";
import { BOARD_VARIANT_SCALES, boardVariantFile, loadBoardVariants } from "./board-images.ts";
import { loadAllTroopImages } from "./troop-images.ts";
import { UNIT_NAMES, UNIT_TYPES } from "../domain/units.ts";

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

test("gallery renders every coin image with its filename", async () => {
  const images = await loadGalleryImages();
  if (images === null) { console.warn("skipping: gallery PNGs not loaded"); return; }
  const setup = await testRender(<GalleryView />, { width: 100, height: 40 });
  try {
    await settleUntil(setup, "Otras imágenes");
    const frame = setup.captureCharFrame();
    expect(frame).toContain("GALERÍA");
    for (const [clean, original] of GALLERY_ROWS) {
      expect(frame).toContain(clean.label);
      expect(frame).toContain(original.label);
    }
    for (const [a, b] of OTHER_ROWS) {
      expect(frame).toContain(a.label);
      expect(frame).toContain(b.label);
    }
    expect(frame).toContain("Otras imágenes");
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(0); // image block pixels
  } finally {
    setup.renderer.destroy();
  }
});

test("gallery page 3 shows every troop PNG with its unit name", async () => {
  const troops = await loadAllTroopImages();
  if (troops === null) { console.warn("skipping: troop PNGs not loaded"); return; }
  const setup = await testRender(<GalleryView page={2} />, { width: 100, height: 48 });
  try {
    await settleUntil(setup, UNIT_NAMES.mercenario); // las filas ya renderizadas
    const frame = setup.captureCharFrame();
    expect(frame).toContain("TROPAS");
    for (const type of UNIT_TYPES) {
      expect(frame).toContain(UNIT_NAMES[type]);
    }
    // Las 16 tropas tienen su PNG propio: se ven los archivos de ballestero y explorador.
    expect(frame).toContain("ballestero.png");
    expect(frame).toContain("explorador.png");
    expect(frame).not.toContain("placeholder");
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(0); // imágenes dibujadas
  } finally {
    setup.renderer.destroy();
  }
});

test("gallery page 2 shows every board resolution with its filename", async () => {
  const boards = await loadBoardVariants();
  if (boards === null) { console.warn("skipping: board PNGs not loaded"); return; }
  const setup = await testRender(<GalleryView page={1} />, { width: 100, height: 48 });
  try {
    await settleUntil(setup, boardVariantFile(BOARD_VARIANT_SCALES[0]!)); // los tiles ya renderizados
    const frame = setup.captureCharFrame();
    expect(frame).toContain("RESOLUCIONES DEL TABLERO");
    expect(frame).toContain(String(BOARD_VARIANT_SCALES.length));
    for (const scale of BOARD_VARIANT_SCALES) {
      expect(frame).toContain(boardVariantFile(scale));
    }
    // las escalas cargables (≤ 2.5×) dibujan píxeles; las mayores muestran ✕
    expect(frame.match(/[█▀▄▌▐]/g)?.length ?? 0).toBeGreaterThan(0);
    expect(frame).toContain("✕");
  } finally {
    setup.renderer.destroy();
  }
});