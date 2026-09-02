import { describe, expect, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Pruebas de build-board-from-terrain.ts (validación de conteos de terreno).
 *
 * El script es un programa de top-level (no exporta nada), así que se ejecuta
 * al hacer `import()`. Para probar su validación de conteos SIN tocar el
 * código de producción, se registra un mock de `node:fs` antes de importarlo:
 * `readFileSync` devuelve un playmat modificado (todas las casillas verdes
 * pintadas de amarillo → 0 normales y 35 de lobos) y `writeFileSync` lanza un
 * error si llega a llamarse. La validación debe abortar ANTES de escribir.
 */

/** El playmat real del repo (leído ANTES de registrar el mock de node:fs). */
const realPlaymat = readFileSync(
  resolve(import.meta.dir, "../../warchest_playmat_1v1.svg"),
  "utf8",
);

/** Conteo inválido: pinta TODAS las casillas verdes de amarillo (33 → 0 normales). */
const invalidPlaymat = realPlaymat.replaceAll("stroke:#8fff91", "stroke:#ffff00");

describe("build-board-from-terrain", () => {
  test("un conteo de terreno inválido aborta sin escribir el SVG", async () => {
    let writeCalls = 0;

    mock.module("node:fs", () => ({
      mkdirSync: mock(() => undefined),
      readFileSync: mock((path: string) => {
        const file = String(path);
        if (file.includes("warchest_playmat_1v1.svg")) return invalidPlaymat;
        // Los tiles solo se leen DESPUÉS de validar los conteos; nunca llegan.
        throw new Error(`readFileSync inesperado: ${file}`);
      }),
      writeFileSync: mock((path: string) => {
        writeCalls += 1;
        throw new Error(`writeFileSync no debería llamarse con conteos inválidos: ${path}`);
      }),
    }));

    // El playmat roto tiene 0 casillas normales → la validación de conteos
    // (27 normales / 6 bases sin conquistar / 2 de lobos / 2 de cuervos)
    // lanza el error esperado antes de componer o escribir el board.
    await expect(
      import("../scripts/build-board-from-terrain.ts"),
    ).rejects.toThrow(
      /Conteo de terreno inválido: normal = 0, se esperaban 27 \(el SVG no se escribió\)/,
    );
    expect(writeCalls).toBe(0);
  });
});