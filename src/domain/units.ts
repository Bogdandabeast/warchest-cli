/**
 * Tipos de unidad del juego (spec §3.1) y sus datos estáticos.
 *
 * Los identificadores son slugs ASCII en español (sin acentos ni espacios);
 * `UNIT_NAMES` guarda el nombre mostrable con su ortografía real.
 *
 * Cantidades de monedas y habilidades aportadas por el usuario (tabla de
 * unidades): cada jugador recibe `UNIT_TOTAL_COINS[type]` monedas del tipo
 * cuando lo elige en el draft; 2 van a su bolsa inicial y el resto a su
 * reserva.
 */

/** Los 16 tipos de unidad del juego. */
export const UNIT_TYPES = [
  "alferez",
  "arquero",
  "ballestero",
  "caballeria",
  "caballeria-ligera",
  "caballero",
  "clerigo",
  "espadachin",
  "explorador",
  "guardia-real",
  "guerrero",
  "infanteria",
  "lancero",
  "mariscal",
  "mercenario",
  "piquero",
] as const;

export type UnitType = (typeof UNIT_TYPES)[number];

/** Nombre mostrable de cada unidad (con acentos). */
export const UNIT_NAMES: Readonly<Record<UnitType, string>> = {
  alferez: "Alférez",
  arquero: "Arquero",
  ballestero: "Ballestero",
  caballeria: "Caballería",
  "caballeria-ligera": "Caballería ligera",
  caballero: "Caballero",
  clerigo: "Clérigo",
  espadachin: "Espadachín",
  explorador: "Explorador",
  "guardia-real": "Guardia Real",
  guerrero: "Guerrero",
  infanteria: "Infantería",
  lancero: "Lancero",
  mariscal: "Mariscal",
  mercenario: "Mercenario",
  piquero: "Piquero",
};

/** Número de unidades de distinto tipo que elige cada jugador en el draft. */
export const UNITS_PER_PLAYER = 4;

/** Cartas de unidad que se reparten al azar para el draft (spec §4.1). */
export const DRAFT_CARDS = 8;

/**
 * Cantidad total de monedas de cada tipo que recibe un jugador al elegir la
 * unidad en el draft (2 a la bolsa; el resto a la reserva). Valores de la
 * tabla de unidades del usuario.
 */
export const UNIT_TOTAL_COINS: Readonly<Record<UnitType, number>> = {
  alferez: 5,
  arquero: 4,
  ballestero: 5,
  caballeria: 4,
  "caballeria-ligera": 5,
  caballero: 4,
  clerigo: 4,
  espadachin: 5,
  explorador: 5,
  "guardia-real": 5,
  guerrero: 5,
  infanteria: 5,
  lancero: 4,
  mariscal: 5,
  mercenario: 5,
  piquero: 4,
};

/**
 * Unidades con la restricción (X): no pueden usar la acción Atacar; solo
 * atacan mediante su habilidad (tabla del usuario: Arquero y Lancero).
 */
export const ATTACK_ONLY_BY_ABILITY: ReadonlySet<UnitType> = new Set([
  "arquero",
  "lancero",
]);

/**
 * Unidades con habilidad innata/pasiva (I), según la tabla del usuario.
 * (El motor de habilidades se implementa en el siguiente paso del ciclo.)
 */
export const INNATE_ABILITY_UNITS: ReadonlySet<UnitType> = new Set([
  "caballero",
  "clerigo",
  "espadachin",
  "explorador",
  "guardia-real",
  "guerrero",
  "infanteria",
  "mercenario",
  "piquero",
]);

/** ¿La unidad solo puede atacar mediante su habilidad (X)? */
export function attackOnlyByAbility(type: UnitType): boolean {
  return ATTACK_ONLY_BY_ABILITY.has(type);
}

/** ¿La unidad tiene habilidad innata (I)? */
export function hasInnateAbility(type: UnitType): boolean {
  return INNATE_ABILITY_UNITS.has(type);
}
