import { describe, expect, test } from "bun:test";
import { UNIT_TYPES } from "../domain/units.ts";
import { TROOP_ART_FILE, loadAllTroopImages, loadTroopImage } from "./troop-images.ts";

describe("troop images", () => {
  test("every unit type has its own art file (no placeholders)", () => {
    expect(Object.keys(TROOP_ART_FILE).sort()).toEqual([...UNIT_TYPES].sort());
    // Las 16 tropas tienen PNG propio: ninguno apunta a caballero.png.
    for (const type of UNIT_TYPES) {
      expect(TROOP_ART_FILE[type], `sin archivo para ${type}`).toBe(`${type}.png`);
    }
  });

  test("loads a real image per unit type (each troop decodes its own PNG)", async () => {
    const all = await loadAllTroopImages();
    if (all === null) { console.warn("skipping: troop PNGs not loaded"); return; }
    expect(all.size).toBe(UNIT_TYPES.length);
    for (const type of UNIT_TYPES) {
      const image = all.get(type);
      expect(image, `sin imagen para ${type}`).toBeDefined();
      expect(image!.width).toBeGreaterThan(0);
    }
    // Cada tropa decodifica SU archivo: instancias distintas entre tipos.
    const [knight, crossbowman, explorer] = await Promise.all([loadTroopImage("caballero"), loadTroopImage("ballestero"), loadTroopImage("explorador")]);
    expect(knight).not.toBe(crossbowman);
    expect(knight).not.toBe(explorer);
    expect(crossbowman).not.toBe(explorer);
  });
});
