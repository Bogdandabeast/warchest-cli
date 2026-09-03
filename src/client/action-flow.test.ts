import { describe, expect, test } from "bun:test";
import { moveActionSelection, noActionsMessageFor } from "./app.tsx";

describe("action flow (producción: app.tsx)", () => {
  test("moves horizontally through action cards", () => {
    // moveActionSelection es la función que usa App en los modos coin/action.
    expect(moveActionSelection(0, "right", 3)).toBe(1);
    expect(moveActionSelection(2, "right", 3)).toBe(2);
    expect(moveActionSelection(0, "left", 3)).toBe(0);
    // Sin opciones la selección no avanza (nunca deja pantalla en blanco).
    expect(moveActionSelection(0, "right", 0)).toBe(0);
  });

  test("never leaves a blank action screen", () => {
    // noActionsMessageFor alimenta el render de App: con opciones viables el
    // mensaje está vacío (se muestra el menú con su cabecera); sin opciones se
    // avisa al jugador; sin monedas se invita a retirarse.
    expect(noActionsMessageFor(2, 0)).toContain("Escoge otra moneda");
    expect(noActionsMessageFor(2, 1)).toBe("");
    expect(noActionsMessageFor(0, 0)).toContain("No tienes monedas");
  });
});
