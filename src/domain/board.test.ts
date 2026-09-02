import { describe, expect, test } from "bun:test";
import { Board, BoardNode } from "./board.ts";

describe("BoardNode", () => {
  test("expone id, coordenadas, vecinos y startZone", () => {
    const node = new BoardNode({
      id: "D6",
      x: 1800,
      y: 1050,
      neighbors: ["C5", "C7"],
      startZone: "player1",
    });
    expect(node.id).toBe("D6");
    expect(node.x).toBe(1800);
    expect(node.y).toBe(1050);
    expect(node.neighbors).toEqual(["C5", "C7"]);
    expect(node.startZone).toBe("player1");
    expect(node.isStartZone()).toBe(true);
  });

  test("una casilla sin base no es startZone", () => {
    const node = new BoardNode({ id: "A3", x: 0, y: 0 });
    expect(node.startZone).toBeUndefined();
    expect(node.isStartZone()).toBe(false);
    expect(node.neighbors).toEqual([]);
  });

  test("rechaza ser vecino de sí misma", () => {
    expect(() => new BoardNode({ id: "D6", x: 0, y: 0, neighbors: ["D6"] })).toThrow();
  });

  test("copia la lista de vecinos recibida (aislamiento)", () => {
    const input = ["B", "C"];
    const node = new BoardNode({ id: "A", x: 0, y: 0, neighbors: input });
    input.push("D"); // mutar el array de entrada no afecta al nodo
    expect(node.neighbors).toEqual(["B", "C"]);
  });
});

describe("Board", () => {
  const a = new BoardNode({ id: "A", x: 0, y: 0, neighbors: ["B"] });
  const b = new BoardNode({ id: "B", x: 100, y: 0, neighbors: ["A", "C"] });
  const c = new BoardNode({ id: "C", x: 200, y: 0, neighbors: ["B"], startZone: "player1" });
  const board = new Board([a, b, c]);

  test("tamaño, consulta y existencia", () => {
    expect(board.size).toBe(3);
    expect(board.has("B")).toBe(true);
    expect(board.has("Z")).toBe(false);
    expect(board.getNode("B")).toBe(b);
    expect(board.getNode("Z")).toBeUndefined();
    expect(board.getAllNodes().map((n) => n.id)).toEqual(["A", "B", "C"]);
  });

  test("getNeighbors devuelve los vecinos y [] para posiciones inexistentes", () => {
    expect(board.getNeighbors("B")).toEqual(["A", "C"]);
    expect(board.getNeighbors("Z")).toEqual([]);
  });

  test("areAdjacent rechaza no adyacentes, inexistentes y la misma casilla", () => {
    expect(board.areAdjacent("A", "B")).toBe(true);
    expect(board.areAdjacent("B", "C")).toBe(true);
    expect(board.areAdjacent("A", "C")).toBe(false);
    expect(board.areAdjacent("A", "Z")).toBe(false);
    expect(board.areAdjacent("B", "B")).toBe(false);
  });

  test("getStartLocations devuelve las bases del jugador ordenadas", () => {
    expect(board.getStartLocations("player1")).toEqual(["C"]);
    expect(board.getStartLocations("player2")).toEqual([]);
  });

  test("rechaza casillas con id duplicado", () => {
    expect(() => new Board([a, new BoardNode({ id: "A", x: 9, y: 9 })])).toThrow(/duplicada/);
  });
});