import type { PlayerId } from "../domain/types.ts";
import type { UnitType } from "../domain/units.ts";

export const LOGO = [
  "╔══════════════════════════════════════════════════════╗",
  "║             ⚔  W A R   C H E S T  ⚔                 ║",
  "║       ≫ UNA GUERRA DE CLANES, UNA BARAJADA ≪        ║",
  "╚══════════════════════════════════════════════════════╝",
];

export const WOLF_ART = ["     /\\      /\\", "    /  \\____/  \\ ", "  /__/  LOBOS  \\__\\"];
export const RAVEN_ART = ["        ,__,", "       (o,o)  ...", "       /)__)   "];

export const UNIT_CODE: Readonly<Record<UnitType, string>> = {
  alferez: "Al", arquero: "Aq", ballestero: "Bs", caballeria: "Cv",
  "caballeria-ligera": "Cl", caballero: "Cb", clerigo: "Cl", espadachin: "Es",
  explorador: "Ex", "guardia-real": "GR", guerrero: "Gu", infanteria: "In",
  lancero: "La", mariscal: "Ma", mercenario: "Me", piquero: "Pi",
};

export const UNIT_GLYPH: Readonly<Record<UnitType, string>> = {
  alferez: "⚑", arquero: "➶", ballestero: "➶", caballeria: "♞", "caballeria-ligera": "♞",
  caballero: "♘", clerigo: "†", espadachin: "⚔", explorador: "☍", "guardia-real": "♛",
  guerrero: "⚔", infanteria: "⚔", lancero: "↗", mariscal: "⚑", mercenario: "₪", piquero: "↟",
};

export function factionMark(player: PlayerId): string {
  return player === "player1" ? "L" : "C";
}

export function coinMark(royal = false): string {
  return royal ? "⟡" : "◉";
}

/**
 * Apodo corto de cada unidad para mostrar DEBAJO de la moneda en el tablero
 * (los nombres de dos palabras se acortan a una; los largos se recortan).
 * Debe caber bajo una moneda de 6–8 celdas y entenderse de un vistazo.
 */
export const UNIT_NICKNAME: Readonly<Record<UnitType, string>> = {
  alferez: "Alférez",
  arquero: "Arquero",
  ballestero: "Ballesta",
  caballeria: "Caball.",
  "caballeria-ligera": "CabLig.",
  caballero: "Caballero",
  clerigo: "Clérigo",
  espadachin: "Espada",
  explorador: "Explora",
  "guardia-real": "Guardia",
  guerrero: "Guerrero",
  infanteria: "Infante",
  lancero: "Lancero",
  mariscal: "Mariscal",
  mercenario: "Mercena",
  piquero: "Piquero",
};
