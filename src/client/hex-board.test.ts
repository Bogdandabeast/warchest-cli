import { describe, expect, test } from "bun:test";
import { dimHex, glowHex, hexBoardCanvas, hexBoardLayout, hexLineRuns, hexTerrainColor, HEX_TABLE } from "./hex-board.ts";

describe("hex board canvas sizing", () => {
  test("fills the available height with proportional width", () => {
    const canvas = hexBoardCanvas({ width: 100, height: 44 });
    // 44 − 18 filas reservadas (zona de descarte, mano/menú, mensajes,
    // ayudas), ancho según la proporción real del recorte 1632:1802 con
    // media altura de celda.
    expect(canvas.rows).toBe(26);
    expect(canvas.cols).toBe(Math.round((26 * 2 * 1632) / 1802));
    expect(canvas.cols).toBeLessThanOrEqual(100);
  });

  test("clamps to a minimum and never exceeds the terminal width", () => {
    const tiny = hexBoardCanvas({ width: 20, height: 20 });
    expect(tiny.rows).toBeGreaterThanOrEqual(14);
    expect(tiny.cols).toBeGreaterThanOrEqual(24);
    const narrow = hexBoardCanvas({ width: 30, height: 60 });
    expect(narrow.cols).toBe(30); // nunca más ancho que la terminal
    const tall = hexBoardCanvas({ width: 400, height: 80 });
    expect(tall.rows).toBe(32); // tope por defecto
  });
});

describe("hex board terrain colors", () => {
  test("matches the playmat palette of bun run render", () => {
    expect(hexTerrainColor("normal")).toBe("#8fff91");
    expect(hexTerrainColor("base-lobos")).toBe("#ffff00");
    expect(hexTerrainColor("base-cuervos")).toBe("#9696ff");
    // La base neutral es un verde atenuado hacia el color de mesa.
    const neutral = hexTerrainColor("base-neutral");
    expect(neutral).toMatch(/^#[0-9a-f]{6}$/);
    expect(neutral).not.toBe("#8fff91");
  });

  test("dimHex oscurece hacia la mesa y glowHex aclara hacia el blanco", () => {
    const dim = dimHex(hexTerrainColor("normal"));
    const glow = glowHex(hexTerrainColor("normal"));
    expect(dim).toMatch(/^#[0-9a-f]{6}$/);
    expect(glow).toMatch(/^#[0-9a-f]{6}$/);
    const read = (hex: string): number[] => [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
    const base = read(hexTerrainColor("normal"));
    const dimRgb = read(dim);
    const glowRgb = read(glow);
    const sum = (rgb: number[]) => rgb[0]! + rgb[1]! + rgb[2]!;
    // Oscurecido: cada canal baja hacia la mesa (#0d1526) y el total cae.
    expect(sum(dimRgb)).toBeLessThan(sum(base));
    for (let i = 0; i < 3; i++) expect(dimRgb[i]!).toBeLessThanOrEqual(base[i]!);
    // Resplandor: el total sube hacia el blanco (255) sin bajar ningún canal.
    expect(sum(glowRgb)).toBeGreaterThan(sum(base));
    for (let i = 0; i < 3; i++) expect(glowRgb[i]!).toBeGreaterThanOrEqual(base[i]!);
  });
});

describe("hex board layout", () => {
  const { cols, rows } = hexBoardCanvas({ width: 100, height: 44 });

  test("renders one line per terminal row with the terrain colors of the 37 cells", () => {
    const layout = hexBoardLayout(cols, rows);
    expect(layout.lines).toHaveLength(rows);
    expect(layout.centers.size).toBe(37);

    const text = layout.lines.flatMap((line) => line.map((run) => run.text)).join("");
    expect(text).toContain("▀"); // casillas con medio-bloque
    const seen = new Set(layout.lines.flatMap((line) => line.map((run) => [run.fg, run.bg] as const)).flat());
    for (const color of ["#8fff91", "#ffff00", "#9696ff", HEX_TABLE]) expect(seen.has(color)).toBe(true);
    expect(seen.has(hexTerrainColor("base-neutral"))).toBe(true);
  });

  test("keeps hexagon aspect and centers the board without distortion", () => {
    const layout = hexBoardLayout(cols, rows);
    // D6 es el centro geométrico del playmat (1800, 1050).
    const center = layout.centers.get("D6")!;
    expect(center.col).toBeGreaterThan(cols / 2 - 2);
    expect(center.col).toBeLessThan(cols / 2 + 2);
    expect(center.row).toBe(Math.round(rows / 2));
    // Las bases amarillas están arriba y las moradas abajo.
    const c1 = layout.centers.get("C1")!;
    const b10 = layout.centers.get("B10")!;
    expect(c1.row).toBeLessThan(center.row);
    expect(b10.row).toBeGreaterThan(center.row);
  });

  test("sizes the coin as a round disc 1:1 with the hexagon", () => {
    const layout = hexBoardLayout(cols, rows);
    expect(layout.coin.width % 2).toBe(0);
    expect(layout.coin.height).toBe(layout.coin.width / 2);
    expect(layout.coin.width).toBeGreaterThanOrEqual(4);
  });

  test("caches layouts by canvas size", () => {
    expect(hexBoardLayout(cols, rows)).toBe(hexBoardLayout(cols, rows));
    expect(hexBoardLayout(cols, rows)).not.toBe(hexBoardLayout(cols + 4, rows));
  });

  test("flip inverts the board so the current player's bases end up at the bottom", () => {
    const plain = hexBoardLayout(cols, rows);
    const flipped = hexBoardLayout(cols, rows, true);
    expect(flipped).not.toBe(plain);
    // Sin flip: las bases amarillas (player1) están arriba y las moradas
    // (player2) abajo. Con flip: al revés (el rival queda arriba).
    const c1 = plain.centers.get("C1")!;
    const b10 = plain.centers.get("B10")!;
    const fC1 = flipped.centers.get("C1")!;
    const fB10 = flipped.centers.get("B10")!;
    expect(c1.row).toBeLessThan(b10.row);
    expect(fC1.row).toBeGreaterThan(fB10.row);
    // El centro geométrico D6 se mantiene en el centro.
    expect(flipped.centers.get("D6")!.row).toBe(Math.round(rows / 2));
    // Los samples se espejan: un píxel de C1 arriba sin flip cae abajo con flip.
    const w = plain.cols;
    const c1Index = plain.locations.findIndex((loc) => loc.id === "C1");
    let sample = -1;
    for (let y = 0; y < Math.floor(rows / 2) && sample === -1; y++) {
      for (let x = 0; x < w; x++) {
        if (plain.samples[y * w + x] === c1Index) { sample = y * w + x; break; }
      }
    }
    expect(sample).toBeGreaterThanOrEqual(0);
    const mirrored = (rows * 2 - 1 - Math.floor(sample / w)) * w + (sample % w);
    expect(flipped.samples[mirrored]).toBe(c1Index);
  });

  test("hexLineRuns recolorea casillas (modo señalamiento: brillan los objetivos)", () => {
    const layout = hexBoardLayout(cols, rows);
    // C1 (base-lobos, amarilla) como objetivo → se dibuja con glow; las demás
    // casillas se oscurecen hacia la mesa.
    const targetId = "C1";
    const lines = hexLineRuns(layout, (index) => {
      if (index === -1) return HEX_TABLE;
      const loc = layout.locations[index]!;
      return loc.id === targetId ? glowHex(hexTerrainColor(loc.terrain)) : dimHex(hexTerrainColor(loc.terrain));
    });
    const flat = lines.flatMap((line) => line.map((run) => [run.fg, run.bg] as const)).flat();
    const seen = new Set(flat);
    expect(seen.has(glowHex(hexTerrainColor("base-lobos")))).toBe(true); // C1 brilla
    expect(seen.has(dimHex(hexTerrainColor("normal")))).toBe(true); // el resto se oscurece
    expect(seen.has(dimHex(hexTerrainColor("base-cuervos")))).toBe(true);
    expect(seen.has(HEX_TABLE)).toBe(true);
    // Los colores plenos NO aparecen en modo señalamiento.
    expect(seen.has(hexTerrainColor("normal"))).toBe(false);
    expect(seen.has(hexTerrainColor("base-lobos"))).toBe(false);
  });

  test("the ring mask hugs the outside of each hexagon", () => {
    const layout = hexBoardLayout(cols, rows);
    const { samples, ring, cols: w } = layout;
    let ringCells = 0;
    for (let i = 0; i < samples.length; i++) {
      if ((ring[i] ?? -1) !== -1) {
        ringCells += 1;
        expect(samples[i]).toBe(-1); // el halo nunca pisa el interior de una casilla
      }
    }
    expect(ringCells).toBeGreaterThan(0);
    // D6, en el centro, tiene halo por todos sus lados.
    const d6 = layout.centers.get("D6")!;
    const found: number[] = [];
    for (let dy = -6; dy <= 6; dy++) {
      for (let dx = -6; dx <= 6; dx++) {
        const idx = (d6.row + dy) * w + (d6.col + dx);
        if (idx < 0 || idx >= ring.length) continue;
        if ((ring[idx] ?? -1) !== -1) found.push(idx);
      }
    }
    expect(found.length).toBeGreaterThan(0);
  });

  test("hexLineRuns pinta el anillo de selección en color de acento", () => {
    const layout = hexBoardLayout(cols, rows);
    const selected = layout.locations.findIndex((loc) => loc.id === "D6");
    const lines = hexLineRuns(layout, (index, ringOwner) => {
      if (ringOwner === selected) return "#ffd75e"; // anillo del hexágono seleccionado
      if (index === -1) return HEX_TABLE;
      const loc = layout.locations[index]!;
      return dimHex(hexTerrainColor(loc.terrain));
    });
    const seen = new Set(lines.flatMap((line) => line.map((run) => [run.fg, run.bg] as const)).flat());
    expect(seen.has("#ffd75e")).toBe(true);
  });
});
