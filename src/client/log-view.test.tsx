import { expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { LogView } from "./views/log.tsx";
import type { LogEntry } from "./log.ts";

test("LogView muestra las líneas del registro etiquetadas con su facción", async () => {
  const entries: LogEntry[] = [
    { faction: "player1", text: "Arquero desplegada en E5." },
    { faction: "player2", text: "Caballería destruida (moneda a la caja)." },
    { faction: "player1", text: "Lancero ataca a Caballería." },
    { text: "Comienza la ronda 2 — iniciativa: Cuervos." },
  ];
  const setup = await testRender(<LogView entries={entries} />, { width: 80, height: 20 });
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("REGISTRO DE EVENTOS");
    expect(frame).toContain("LOBOS: Arquero desplegada en E5.");
    expect(frame).toContain("CUERVOS: Caballería destruida (moneda a la caja).");
    expect(frame).toContain("Comienza la ronda 2");
    expect(frame).toContain("4 evento(s)");
  } finally {
    setup.renderer.destroy();
  }
});

test("LogView muestra un aviso cuando no hay eventos", async () => {
  const setup = await testRender(<LogView entries={[]} />, { width: 80, height: 20 });
  try {
    await setup.renderOnce();
    await setup.flush({ maxPasses: 10 });
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Todavía no hay eventos.");
  } finally {
    setup.renderer.destroy();
  }
});
