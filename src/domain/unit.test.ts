import { describe, expect, test } from "bun:test";
import { Unit, INITIAL_STACK } from "./unit.ts";

describe("Unit", () => {
  test("nace con 1 moneda y refuerza con addCoin", () => {
    const unit = new Unit({ type: "caballeria", owner: "player1", position: "C1" });
    expect(unit.coins).toBe(INITIAL_STACK);
    unit.addCoin();
    expect(unit.coins).toBe(2);
    unit.addCoin(2);
    expect(unit.coins).toBe(4);
    expect(unit.isReinforced()).toBe(true);
  });

  test("dos unidades del mismo tipo y dueño tienen ids distintos (Infantería)", () => {
    const a = new Unit({ type: "infanteria", owner: "player1", position: "C1" });
    const b = new Unit({ type: "infanteria", owner: "player1", position: "F2" });
    expect(a.id).not.toBe(b.id);
    // El id no deriva de la posición: al moverse se mantiene estable.
    const before = a.id;
    a.position = "D1";
    expect(a.id).toBe(before);
  });

  test("la pila solo se modifica vía métodos (coins es de solo lectura)", () => {
    const unit = new Unit({ type: "caballeria", owner: "player1", position: "C1" });
    expect(() => {
      // @ts-expect-error – asignación externa prohibida por diseño
      unit.coins = 99;
    }).toThrow(TypeError);
    expect(unit.coins).toBe(1);
  });

  test("removeCoin no decrementa una pila vacía", () => {
    const unit = new Unit({ type: "caballeria", owner: "player1", position: "C1" });
    unit.removeCoin(); // 1 → 0 (destruida)
    expect(unit.coins).toBe(0);
    expect(unit.removeCoin()).toBe(false);
    expect(unit.coins).toBe(0);
  });

  test("valida enteros positivos en el constructor y en addCoin", () => {
    expect(() => new Unit({ type: "caballeria", owner: "player1", position: "C1" }, 0)).toThrow(/entero positivo/);
    expect(() => new Unit({ type: "caballeria", owner: "player1", position: "C1" }, -1)).toThrow(/entero positivo/);
    expect(() => new Unit({ type: "caballeria", owner: "player1", position: "C1" }, 1.5)).toThrow(/entero positivo/);
    const unit = new Unit({ type: "caballeria", owner: "player1", position: "C1" });
    expect(() => unit.addCoin(0)).toThrow(/entero positivo/);
    expect(() => unit.addCoin(-2)).toThrow(/entero positivo/);
    expect(unit.coins).toBe(1); // sin cambios
  });
});