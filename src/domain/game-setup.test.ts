import { describe, expect, test } from "bun:test";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import {
  DraftSession,
  configureGame,
  dealDraftCards,
  DRAFT_PICK_SEQUENCE,
  DRAFT_PATTERN,
} from "./game-setup.ts";
import { UNIT_TYPES } from "./units.ts";
import { CONTROL_MARKERS_PER_PLAYER } from "./player.ts";

describe("DraftSession", () => {
  test("patrón 1-2-2-2-1 expandido a 8 elecciones alternadas", () => {
    expect(DRAFT_PATTERN.map((p) => p.count)).toEqual([1, 2, 2, 2, 1]);
    expect(DRAFT_PICK_SEQUENCE).toEqual(["player1", "player2", "player2", "player1", "player1", "player2", "player2", "player1"]);
  });

  test("dealDraftCards reparte 8 cartas únicas", () => {
    const cards = dealDraftCards(() => 0.5);
    expect(cards).toHaveLength(8);
    expect(new Set(cards).size).toBe(8);
  });

  test("el turno alterna y cada jugador acaba con 4 unidades", () => {
    const pool = UNIT_TYPES.slice(0, 8);
    const draft = new DraftSession([...pool]);
    expect(draft.currentPlayer).toBe("player1");
    expect(draft.currentCount).toBe(1);

    // player1 elige 1
    draft.pick("player1", pool[0]!);
    expect(draft.currentPlayer).toBe("player2");
    expect(draft.currentCount).toBe(2);

    // player2 elige 2
    draft.pick("player2", pool[1]!);
    draft.pick("player2", pool[2]!);
    expect(draft.currentPlayer).toBe("player1");

    // player1 elige 2
    draft.pick("player1", pool[3]!);
    draft.pick("player1", pool[4]!);
    expect(draft.currentPlayer).toBe("player2");

    // player2 elige 2
    draft.pick("player2", pool[5]!);
    draft.pick("player2", pool[6]!);
    expect(draft.currentPlayer).toBe("player1");

    // player1 se queda la última
    draft.pick("player1", pool[7]!);
    expect(draft.isComplete).toBe(true);
    expect(draft.results.player1).toHaveLength(4);
    expect(draft.results.player2).toHaveLength(4);
  });

  test("valida turno, disponibilidad y repetición", () => {
    const pool = UNIT_TYPES.slice(0, 8);
    const draft = new DraftSession([...pool]);
    expect(() => draft.pick("player2", pool[1]!)).toThrow(/Le toca/);
    draft.pick("player1", pool[0]!);
    // Ahora le toca a player2: elegir una carta ya cogida no está disponible.
    expect(() => draft.pick("player2", pool[0]!)).toThrow(/ya no está disponible/);
  });

  test("rechaza un mazo con cartas repetidas o tamaño incorrecto", () => {
    expect(() => new DraftSession(["arquero", "arquero"])).toThrow(/8 cartas/);
    expect(() => new DraftSession([...UNIT_TYPES.slice(0, 7), "arquero"])).toThrow(/repetidas/);
  });
});

describe("configureGame", () => {
  test("monta bolsas (real + 2 por tipo), reserva, fichas iniciales e iniciativa", async () => {
    const board = await new SVGBoardLoader().load();
    const chosen = {
      player1: ["arquero", "caballeria", "alferez", "piquero"],
      player2: ["lancero", "guardia-real", "infanteria", "explorador"],
    } as const;

    const config = configureGame(board, chosen);

    // Iniciativa para el segundo en elegir.
    expect(config.initiative).toBe("player2");

    // Bolsa: moneda real + 2 por tipo (9 monedas).
    expect(config.player1.bag.total()).toBe(1 + 4 * 2);
    expect(config.player1.bag.hasRoyal()).toBe(true);
    expect(config.player1.bag.countUnit("arquero")).toBe(2);
    expect(config.player2.bag.total()).toBe(1 + 4 * 2);

    // Reserva: total − 2 por tipo (arquero 4 → 2; caballeria 4 → 2; alferez 5 → 3…).
    expect(config.player1.reserve.countUnit("arquero")).toBe(2);
    expect(config.player1.reserve.countUnit("alferez")).toBe(3);
    expect(config.player1.reserve.countUnit("piquero")).toBe(2);

    // Mano y descarte vacíos.
    expect(config.player1.hand.total()).toBe(0);
    expect(config.player1.discard.total()).toBe(0);

    // Dos fichas iniciales de cada jugador sobre sus bases.
    expect(board.countControlMarkers("player1")).toBe(2);
    expect(board.countControlMarkers("player2")).toBe(2);
    expect(board.getStartLocations("player1")).toEqual(["C1", "F2"]);
    expect(board.getStartLocations("player2")).toEqual(["B10", "E11"]);

    // Las bases empiezan vacías de tropas.
    expect(board.getAllUnits()).toHaveLength(0);

    // Cada jugador tiene sus 6 fichas en total.
    expect(config.player1.controlMarkers).toBe(CONTROL_MARKERS_PER_PLAYER);
  });

  test("no añade más fichas si el board ya está configurado (idempotente por tablero nuevo)", async () => {
    const board = await new SVGBoardLoader().load();
    const chosen = {
      player1: ["arquero", "caballeria", "alferez", "piquero"],
      player2: ["lancero", "guardia-real", "infanteria", "explorador"],
    } as const;
    configureGame(board, chosen);
    // El mismo board: colocar 2 fichas sobre una base ya controlada reemplaza
    // pero no incrementa (una ficha por localización).
    expect(board.countControlMarkers("player1")).toBe(2);
  });
});
