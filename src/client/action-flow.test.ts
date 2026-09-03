import { describe, expect, test } from "bun:test";
import type { MenuAction } from "./menu-viability.ts";

function moveSelection(current: number, key: "left" | "right", count: number): number {
  if (count === 0) return 0;
  return key === "left" ? Math.max(0, current - 1) : Math.min(count - 1, current + 1);
}

function actionPrompt(actions: readonly MenuAction[]): string {
  return actions.length === 0 ? "Esta moneda no permite ninguna acción ahora. Escoge otra moneda." : "ELIGE UNA ACCIÓN";
}

describe("action flow", () => {
  test("moves horizontally through action cards", () => {
    const actions: MenuAction[] = ["deploy", "recruit", "pass"];
    expect(moveSelection(0, "right", actions.length)).toBe(1);
    expect(moveSelection(2, "right", actions.length)).toBe(2);
    expect(moveSelection(0, "left", actions.length)).toBe(0);
  });

  test("never leaves a blank action screen", () => {
    expect(actionPrompt([])).toContain("Escoge otra moneda");
    expect(actionPrompt(["pass"])).toBe("ELIGE UNA ACCIÓN");
  });
});
