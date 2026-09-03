import { describe, expect, test } from "bun:test";
import type { GameResult } from "../domain/game.ts";
import { cleanLogText, entriesFromResult, logEntryLabel } from "./log.ts";

describe("registro de eventos (TUI)", () => {
  test("cleanLogText convierte ids de jugador en facciones y quita el dueño redundante", () => {
    expect(cleanLogText("Caballería de player2 destruida (moneda a la caja).")).toBe("Caballería destruida (moneda a la caja).");
    expect(cleanLogText("Caballero de player1 pierde una moneda (pila de 1).")).toBe("Caballero pierde una moneda (pila de 1).");
    expect(cleanLogText("player1 reclama la iniciativa para la próxima ronda.")).toBe("Lobos reclama la iniciativa para la próxima ronda.");
  });

  test("entriesFromResult etiqueta la acción y cada evento con su facción", () => {
    const result: GameResult = {
      success: true,
      message: "Lancero ataca a Caballería.",
      events: [
        { type: "unit-destroyed", player: "player2", message: "Caballería de player2 destruida (moneda a la caja)." },
        { type: "coin-lost", player: "player1", message: "Lancero pierde una moneda por el Piquero." },
      ],
    };
    const entries = entriesFromResult(result, "player1");
    expect(entries).toEqual([
      { faction: "player1", text: "Lancero ataca a Caballería." },
      { faction: "player2", text: "Caballería destruida (moneda a la caja)." },
      { faction: "player1", text: "Lancero pierde una moneda por el Piquero." },
    ]);
    expect(logEntryLabel(entries[0]!)).toBe("LOBOS: Lancero ataca a Caballería.");
    expect(logEntryLabel(entries[1]!)).toBe("CUERVOS: Caballería destruida (moneda a la caja).");
  });

  test("cleanLogText recorta líneas muy largas y normaliza espacios", () => {
    const long = `  Un   mensaje ${"muy ".repeat(40)}largo`;
    expect(cleanLogText(long).length).toBeLessThanOrEqual(90);
    expect(cleanLogText("  hola   mundo ")).toBe("hola mundo");
  });
});
