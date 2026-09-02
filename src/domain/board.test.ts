import { describe, expect, test } from "bun:test";
import { Board, BoardNode } from "./board.ts";
import { Unit } from "./unit.ts";

function node(id: string, x: number, options: Partial<ConstructorParameters<typeof BoardNode>[0]> = {}) {
  return new BoardNode({ id, x, y: 0, ...options });
}

describe("BoardNode", () => {
  test("expone id, coordenadas, vecinos y terreno (normal por defecto)", () => {
    const n = new BoardNode({ id: "D6", x: 1800, y: 1050, neighbors: ["C5", "C7"], terrain: "base-lobos" });
    expect(n.id).toBe("D6");
    expect(n.x).toBe(1800);
    expect(n.y).toBe(1050);
    expect(n.neighbors).toEqual(["C5", "C7"]);
    expect(n.terrain).toBe("base-lobos");
    expect(n.isLocation()).toBe(true);
  });

  test("una casilla normal no es localización ni base de inicio", () => {
    const n = new BoardNode({ id: "A3", x: 0, y: 0 });
    expect(n.terrain).toBe("normal");
    expect(n.isLocation()).toBe(false);
    expect(n.isStartZone()).toBe(false);
    expect(n.startZone).toBeUndefined();
    expect(n.isNeutral()).toBe(false);
  });

  test("la base de inicio se deriva del terreno (lobos→player1, cuervos→player2)", () => {
    expect(new BoardNode({ id: "C1", x: 0, y: 0, terrain: "base-lobos" }).startZone).toBe("player1");
    expect(new BoardNode({ id: "B10", x: 0, y: 0, terrain: "base-cuervos" }).startZone).toBe("player2");
    expect(new BoardNode({ id: "A7", x: 0, y: 0, terrain: "base-neutral" }).startZone).toBeUndefined();
  });

  test("una base neutral sin fichas es neutral; deja de serlo al controlarla", () => {
    const base = new BoardNode({ id: "A7", x: 0, y: 0, terrain: "base-neutral" });
    expect(base.isNeutral()).toBe(true);
    expect(base.isControlledBy("player1")).toBe(false);

    base.addControlMarker("player1");
    expect(base.controlledBy).toBe("player1");
    expect(base.controlMarkers).toBe(1);
    expect(base.isControlledBy("player1")).toBe(true);
    expect(base.isNeutral()).toBe(false);
  });

  test("addControlMarker reemplaza la ficha enemiga (conquista) y devuelve al dueño anterior", () => {
    const base = new BoardNode({ id: "A7", x: 0, y: 0, terrain: "base-neutral" });
    base.addControlMarker("player1");
    expect(base.addControlMarker("player2")).toBe("player1");
    expect(base.controlledBy).toBe("player2");
    expect(base.controlMarkers).toBe(1);
  });

  test("removeControlMarker devuelve la ficha al dueño y deja la base neutral", () => {
    const base = new BoardNode({ id: "A7", x: 0, y: 0, terrain: "base-neutral" });
    base.addControlMarker("player1");
    expect(base.removeControlMarker()).toBe("player1");
    expect(base.controlledBy).toBeUndefined();
    expect(base.controlMarkers).toBe(0);
    expect(base.isNeutral()).toBe(true);
  });

  test("las casillas normales no pueden recibir fichas (solo las bases)", () => {
    const normal = new BoardNode({ id: "D6", x: 0, y: 0 });
    expect(() => normal.addControlMarker("player1")).toThrow(/no es una localización/);
    expect(normal.controlMarkers).toBe(0); // el estado no cambia
  });

  test("rechaza ser vecino de sí misma", () => {
    expect(() => new BoardNode({ id: "D6", x: 0, y: 0, neighbors: ["D6"] })).toThrow();
  });

  test("copia la lista de vecinos recibida (aislamiento)", () => {
    const input = ["B", "C"];
    const n = new BoardNode({ id: "A", x: 0, y: 0, neighbors: input });
    input.push("D"); // mutar el array de entrada no afecta al nodo
    expect(n.neighbors).toEqual(["B", "C"]);
  });
});

describe("Board", () => {
  const a = new BoardNode({ id: "A", x: 0, y: 0, neighbors: ["B"] });
  const b = new BoardNode({ id: "B", x: 100, y: 0, neighbors: ["A", "C"] });
  const c = new BoardNode({ id: "C", x: 200, y: 0, neighbors: ["B"], terrain: "base-lobos" });
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

  test("getStartLocations deriva las bases del jugador desde el terreno", () => {
    const lobos = new BoardNode({ id: "F2", x: 300, y: 0, neighbors: [], terrain: "base-lobos" });
    const cuervos = new BoardNode({ id: "E11", x: 400, y: 0, neighbors: [], terrain: "base-cuervos" });
    const board2 = new Board([...board.getAllNodes(), lobos, cuervos]);
    expect(board2.getStartLocations("player1")).toEqual(["C", "F2"]);
    expect(board2.getStartLocations("player2")).toEqual(["E11"]);
  });

  test("placeControlMarker solo permite bases y controla correctamente", () => {
    expect(() => board.placeControlMarker("A", "player1")).toThrow(/no es una localización/);
    expect(board.placeControlMarker("C", "player1")).toBeUndefined();
    expect(board.placeControlMarker("C", "player2")).toBe("player1"); // conquista
    expect(board.getControlledLocations("player2").map((n) => n.id)).toEqual(["C"]);
    expect(board.countControlMarkers("player1")).toBe(0);
    expect(board.countControlMarkers("player2")).toBe(1);
  });

  test("unidades: placeUnit, ocupación, consultas y eliminación", () => {
    const b2 = new Board([a, b, c]);
    const u1 = new Unit({ type: "arquero", owner: "player1", position: "A" });
    const u2 = new Unit({ type: "caballeria", owner: "player2", position: "B" });

    b2.placeUnit(u1, "A");
    expect(b2.unitAt("A")).toBe(u1);
    expect(b2.getUnitsAt("A")).toEqual([u1]);
    expect(b2.getAllUnits()).toEqual([u1]);
    expect(b2.getUnitsByPlayer("player1")).toEqual([u1]);
    expect(b2.findUnit("player1", "arquero")).toBe(u1);
    expect(b2.findUnit("player1", "caballeria")).toBeUndefined();

    expect(() => b2.placeUnit(u2, "A")).toThrow(/ocupada/);
    b2.placeUnit(u2, "B");

    // mover (destino libre)
    b2.moveUnit(u1, "C");
    expect(u1.position).toBe("C");
    expect(b2.unitAt("C")).toBe(u1);

    // eliminar
    b2.removeUnit(u1);
    expect(b2.getAllUnits()).toEqual([u2]);
    expect(b2.getUnitsAt("C")).toEqual([]);
    expect(() => b2.moveUnit(u1, "B")).toThrow(/no está en el tablero/);
  });

  test("rechaza casillas con id duplicado", () => {
    expect(() => new Board([a, new BoardNode({ id: "A", x: 9, y: 9 })])).toThrow(/duplicada/);
  });

  test("rechaza vecinos que no existen en el tablero", () => {
    const lonely = new BoardNode({ id: "A", x: 0, y: 0, neighbors: ["Z"] });
    expect(() => new Board([lonely])).toThrow(/inexistente/);
  });

  test("rechaza relaciones de vecindad asimétricas", () => {
    const a2 = new BoardNode({ id: "A", x: 0, y: 0, neighbors: ["B"] });
    const b2 = new BoardNode({ id: "B", x: 100, y: 0, neighbors: [] });
    expect(() => new Board([a2, b2])).toThrow(/bidireccional/);
  });
});
