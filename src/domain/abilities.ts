/**
 * Habilidades de las unidades (spec §3.3, tabla de habilidades del usuario).
 *
 * Cada unidad activa su TÁCTICA descartando una moneda boca arriba de su
 * tipo (salvo la Guardia Real, que descarta la moneda Real). Las unidades con
 * solo atributos (I) no tienen táctica activable: sus efectos se aplican en
 * las acciones (ataque, despliegue, reclutamiento…).
 *
 * Mapa unidad → táctica:
 *  - Alférez: mueve una unidad aliada (1 casilla) a otra a 1-2 del Alférez.
 *  - Arquero (X): ataca a exactamente 2 casillas (la intermedia puede ocuparse).
 *  - Ballestero: ataca en línea recta a 1-2; si la intermedia está ocupada,
 *    ataca a ESA unidad (la primera del camino).
 *  - Caballería: se mueve 1 y después ataca.
 *  - Caballería ligera: se mueve hasta 2 casillas.
 *  - Guardia Real: descarta la moneda Real y se mueve hasta 2 a una
 *    localización que domines.
 *  - Infantería: realiza 1 maniobra con cada Infantería en el tablero.
 *  - Lancero (X): embiste 1-2 en línea recta y ataca a la primera unidad del
 *    camino (nunca con la acción normal).
 *  - Mariscal: una unidad aliada a 1-2 casillas ataca (si puede atacar normal).
 */
import type { Game } from "./game.ts";
import type { GameEvent, GameResult } from "./game.ts";
import type { PlayerId, Position } from "./types.ts";
import type { UnitType } from "./units.ts";
import { UNIT_NAMES } from "./units.ts";
import { attackOnlyByAbility } from "./units.ts";
import type { Unit } from "./unit.ts";
import { distanceInHexes, hexesInStraightLine, reachableWithin } from "./geometry.ts";

/** Peticiones de táctica por unidad (cada variante lleva sus blancos). */
export type AbilityRequest =
  | { ability: "ensign"; ally: Position; to: Position }
  | { ability: "archer"; target: Position }
  | { ability: "crossbowman"; target: Position }
  | { ability: "cavalry"; moveTo: Position; attackTarget?: Position }
  | { ability: "light-cavalry"; to: Position }
  | { ability: "royal-guard"; to: Position }
  | { ability: "footman"; maneuvers: FootmanManeuver[] }
  | { ability: "lancer"; target: Position }
  | { ability: "marshal"; ally: Position; attackTarget: Position };

/** Una maniobra que ejecuta una Infantería con su táctica (no paga moneda). */
export type FootmanManeuver =
  | { kind: "move"; unitPos: Position; to: Position }
  | { kind: "attack"; unitPos: Position; target: Position }
  | { kind: "control"; unitPos: Position };

/** Tácticas activables (las demás unidades solo tienen atributos). */
export const ACTIVATABLE_TACTICS: ReadonlySet<UnitType> = new Set([
  "alferez",
  "arquero",
  "ballestero",
  "caballeria",
  "caballeria-ligera",
  "guardia-real",
  "infanteria",
  "lancero",
  "mariscal",
]);

/** ¿La táctica de la Guardia Real descarta la moneda Real (no la de su tipo)? */
export function discardsRoyalCoin(request: AbilityRequest): boolean {
  return request.ability === "royal-guard";
}

/** Nombre de táctica → tipo de unidad que la posee (valida el dispatch). */
const ABILITY_UNIT: Readonly<Record<string, UnitType>> = {
  ensign: "alferez",
  archer: "arquero",
  crossbowman: "ballestero",
  cavalry: "caballeria",
  "light-cavalry": "caballeria-ligera",
  "royal-guard": "guardia-real",
  footman: "infanteria",
  lancer: "lancero",
  marshal: "mariscal",
};

/**
 * Resuelve la táctica de la unidad (ya validada la moneda por
 * `executeManeuver`). Antes de despachar valida que el tipo de la unidad
 * coincida con la táctica pedida: un desajuste se rechaza sin ejecutar nada.
 */
export function resolveAbility(game: Game, playerId: PlayerId, unit: Unit, params: AbilityRequest): GameResult {
  const expected = ABILITY_UNIT[params.ability];
  if (expected === undefined) return errResult(`Táctica desconocida: ${params.ability}.`);
  if (unit.type !== expected) {
    return errResult(`${UNIT_NAMES[unit.type]} no tiene la táctica ${params.ability}.`);
  }
  const name = params.ability;
  switch (name) {
    case "ensign":
      return ensignTactic(game, playerId, unit, params);
    case "archer":
      return archerTactic(game, playerId, unit, params);
    case "crossbowman":
      return crossbowmanTactic(game, playerId, unit, params);
    case "cavalry":
      return cavalryTactic(game, playerId, unit, params);
    case "light-cavalry":
      return lightCavalryTactic(game, unit, params);
    case "royal-guard":
      return royalGuardTactic(game, playerId, unit, params);
    case "footman":
      return footmanTactic(game, playerId, unit, params);
    case "lancer":
      return lancerTactic(game, playerId, unit, params);
    case "marshal":
      return marshalTactic(game, playerId, unit, params);
  }
}

/** Alférez: una unidad aliada a 1-2 hace 1 movimiento normal a una casilla a 1-2 del Alférez. */
function ensignTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "ensign" }>): GameResult {
  const ally = game.board.unitAt(params.ally);
  if (ally === undefined) return errResult("No hay una unidad aliada en esa casilla.");
  if (ally.owner !== playerId) return errResult("La unidad elegida debe ser aliada.");
  if (ally === unit) return errResult("El Alférez no puede elegirse a sí mismo.");

  const allyRange = distanceInHexes(game.board, unit.position, params.ally);
  if (allyRange < 1 || allyRange > 2) {
    return errResult("La unidad aliada debe estar a 1 o 2 casillas del Alférez.");
  }
  const destRange = distanceInHexes(game.board, unit.position, params.to);
  if (destRange < 1 || destRange > 2) {
    return errResult("El destino debe estar a 1 o 2 casillas del Alférez.");
  }
  if (!game.board.areAdjacent(params.ally, params.to)) {
    return errResult("La unidad aliada solo puede hacer 1 movimiento normal (a una casilla adyacente).");
  }
  if (game.board.unitAt(params.to) !== undefined) return errResult("La casilla de destino está ocupada.");
  game.board.moveUnit(ally, params.to);
  return okResult(`${UNIT_NAMES[ally.type]} se mueve de ${params.ally} a ${params.to} gracias al Alférez.`);
}

/** Arquero (X): ataca a una unidad a exactamente 2 casillas (intermedia puede ocuparse). */
function archerTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "archer" }>): GameResult {
  const target = game.board.unitAt(params.target);
  if (target === undefined) return errResult("No hay una unidad en esa casilla.");
  if (target.owner === playerId) return errResult("No puedes atacar a tu propia unidad.");
  const range = distanceInHexes(game.board, unit.position, params.target);
  if (range !== 2) return errResult("El Arquero ataca a exactamente 2 casillas.");
  return game.resolveAttack(playerId, unit, target, false);
}

/**
 * Ballestero: ataca en línea recta a 1 o 2 casillas. Si hay una unidad en la
 * casilla intermedia, esa es el objetivo (regla del usuario: ataca a la
 * primera unidad del camino, no a la de detrás).
 */
function crossbowmanTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "crossbowman" }>): GameResult {
  const requested = game.board.unitAt(params.target);
  if (requested === undefined) return errResult("No hay una unidad en esa casilla.");
  if (requested.owner === playerId) return errResult("No puedes atacar a tu propia unidad.");
  const range = distanceInHexes(game.board, unit.position, params.target);
  if (range < 1 || range > 2) return errResult("El Ballestero ataca a 1 o 2 casillas.");
  const between = hexesInStraightLine(game.board, unit.position, params.target);
  if (between.length !== range - 1) return errResult("El ataque debe ser en línea recta.");

  // Primera unidad del camino: si la intermedia está ocupada por un enemigo,
  // el Ballestero ataca a ESA unidad y no a la de detrás. Si la primera del
  // camino es aliada, el tiro se rechaza (no se dispara a través de aliados).
  const blocked = between.find((p) => game.board.unitAt(p) !== undefined);
  if (blocked !== undefined) {
    const blocker = game.board.unitAt(blocked)!;
    if (blocker.owner === playerId) {
      return errResult("La primera unidad del camino es aliada: el Ballestero no puede disparar a través de ella.");
    }
    return game.resolveAttack(playerId, unit, blocker, false);
  }
  return game.resolveAttack(playerId, unit, requested, false);
}

/**
 * Caballería: se mueve 1 casilla y DESPUÉS ataca. La táctica solo puede
 * ejecutarse si hay un objetivo de ataque adyacente al destino (regla del
 * usuario: la habilidad de moverse exige objetivo; no vale solo moverse).
 */
function cavalryTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "cavalry" }>): GameResult {
  if (params.attackTarget === undefined) {
    return errResult("La Caballería solo puede usar su táctica si hay un objetivo de ataque tras moverse.");
  }
  if (!game.board.areAdjacent(unit.position, params.moveTo)) {
    return errResult("La Caballería se mueve primero 1 casilla adyacente.");
  }
  if (game.board.unitAt(params.moveTo) !== undefined) return errResult("La casilla de destino está ocupada.");

  const target = game.board.unitAt(params.attackTarget);
  if (target === undefined) return errResult("No hay unidad enemiga en la casilla de ataque.");
  if (target.owner === playerId) return errResult("No puedes atacar a tu propia unidad.");
  if (!game.board.areAdjacent(params.moveTo, params.attackTarget)) {
    return errResult("Tras moverse, la Caballería solo ataca a unidades adyacentes al destino.");
  }

  // Caballero (I): la embestida se rechaza ANTES de mover si la Caballería no
  // está reforzada (2+ monedas) — la acción falla sin mover ni gastar moneda.
  if (target.type === "caballero" && !unit.isReinforced()) {
    return errResult("La Caballería no puede embestir a un Caballero sin estar reforzada (2+ monedas).");
  }

  game.board.moveUnit(unit, params.moveTo);
  return game.resolveAttack(playerId, unit, target, false);
}

/** Caballería ligera: se mueve hasta 2 casillas (por casillas vacías). */
function lightCavalryTactic(game: Game, unit: Unit, params: Extract<AbilityRequest, { ability: "light-cavalry" }>): GameResult {
  if (game.board.areAdjacent(unit.position, params.to)) {
    // El atajo de 1 casilla también exige destino libre (igual que el de 2).
    if (game.board.unitAt(params.to) !== undefined) return errResult("La casilla de destino está ocupada.");
    game.board.moveUnit(unit, params.to);
    return okResult(`Caballería ligera se mueve a ${params.to}.`);
  }
  const reachable = reachableWithin(game.board, unit.position, 2, (p) => game.board.unitAt(p) !== undefined);
  if (!reachable.includes(params.to)) return errResult("La Caballería ligera se mueve hasta 2 casillas por casillas vacías.");
  game.board.moveUnit(unit, params.to);
  return okResult(`Caballería ligera se mueve a ${params.to}.`);
}

/** Guardia Real: descarta la moneda Real y se mueve hasta 2 a una localización que domines. */
function royalGuardTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "royal-guard" }>): GameResult {
  const player = game.player(playerId);
  if (!player.hand.hasRoyal()) return errResult("La táctica de la Guardia Real requiere descartar la moneda Real.");

  const node = game.board.getNode(params.to);
  if (node === undefined) return errResult(`La casilla ${params.to} no existe.`);
  if (!node.isLocation()) return errResult("La Guardia Real solo puede moverse a una localización.");
  if (!node.isControlledBy(playerId)) return errResult("La Guardia Real solo puede moverse a una localización que domines.");
  if (game.board.unitAt(params.to) !== undefined) return errResult("La localización de destino está ocupada.");

  const reachable = reachableWithin(game.board, unit.position, 2, (p) => game.board.unitAt(p) !== undefined);
  if (!reachable.includes(params.to)) return errResult("La Guardia Real se mueve hasta 2 casillas.");
  game.board.moveUnit(unit, params.to);
  return okResult(`Guardia Real se mueve a ${params.to}.`);
}

/**
 * Infantería: realiza 1 maniobra con cada unidad de Infantería del tablero.
 * La táctica es ATÓMICA: todas las maniobras se validan antes de ejecutar
 * ninguna, así un fallo deja el estado intacto y no se gasta la moneda.
 */
function footmanTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "footman" }>): GameResult {
  const footmen = game.board.getUnitsByPlayer(playerId).filter((u) => u.type === "infanteria");
  if (footmen.length === 0) return errResult("No tienes Infantería en el tablero.");

  const requests = params.maneuvers;
  if (requests.length === 0) return errResult("Indica qué maniobra hace cada Infantería.");

  const prepared: { footman: Unit; request: FootmanManeuver }[] = [];
  const seen = new Set<Position>();
  for (const request of requests) {
    const footman = footmen.find((u) => u.position === request.unitPos);
    if (footman === undefined) return errResult("Una de las maniobras no referencia a una Infantería en el tablero.");
    if (seen.has(request.unitPos)) return errResult("Cada Infantería solo puede hacer una maniobra en esta táctica.");
    seen.add(request.unitPos);

    const validation = validateFootmanManeuver(game, playerId, footman, request);
    if (!validation.success) return validation;
    prepared.push({ footman, request });
  }

  const events: GameEvent[] = [];
  for (const { footman, request } of prepared) {
    // Ya validado: la aplicación no puede fallar (solo resuelve el ataque).
    const result = applyFootmanManeuver(game, playerId, footman, request);
    events.push(...result.events);
  }
  return { success: true, message: "Infantería completa sus maniobras.", events };
}

/** Valida una maniobra de Infantería SIN tocar el estado (táctica atómica). */
function validateFootmanManeuver(game: Game, playerId: PlayerId, footman: Unit, maneuver: FootmanManeuver): GameResult {
  switch (maneuver.kind) {
    case "move": {
      if (!game.board.areAdjacent(footman.position, maneuver.to)) return errResult("Maniobra inválida: movimiento no adyacente.");
      if (game.board.unitAt(maneuver.to) !== undefined) return errResult("Maniobra inválida: destino ocupado.");
      return okResult("ok");
    }
    case "attack": {
      const target = game.board.unitAt(maneuver.target);
      if (target === undefined) return errResult("Maniobra inválida: no hay unidad en esa casilla.");
      if (target.owner === playerId) return errResult("Maniobra inválida: no puedes atacar a tu propia unidad.");
      if (!game.board.areAdjacent(footman.position, maneuver.target)) return errResult("Maniobra inválida: el ataque no es adyacente.");
      if (target.type === "caballero" && !footman.isReinforced()) {
        return errResult("Maniobra inválida: el Caballero solo puede ser atacado por unidades reforzadas.");
      }
      return okResult("ok");
    }
    case "control": {
      const node = game.board.getNode(footman.position);
      if (node === undefined || !node.isLocation()) return errResult("Maniobra inválida: no está en una localización.");
      if (node.isControlledBy(playerId)) return errResult("Maniobra inválida: ya controlas esa localización.");
      return okResult("ok");
    }
  }
}

/** Ejecuta una maniobra de Infantería ya validada. */
function applyFootmanManeuver(game: Game, playerId: PlayerId, footman: Unit, maneuver: FootmanManeuver): GameResult {
  switch (maneuver.kind) {
    case "move":
      game.board.moveUnit(footman, maneuver.to);
      return okResult(`Infantería se mueve a ${maneuver.to}.`);
    case "attack": {
      const target = game.board.unitAt(maneuver.target)!;
      return game.resolveAttack(playerId, footman, target, false);
    }
    case "control":
      // El control centralizado también detecta la victoria al colocar la
      // última ficha (la maniobra de la Infantería no la saltaba).
      return game.controlLocation(playerId, footman.position, footman);
  }
}

/**
 * Lancero (X): embiste. Elige un enemigo en línea recta a 2-3 casillas con el
 * camino libre; el Lancero avanza hasta la casilla inmediatamente anterior al
 * objetivo y lo ataca. Nunca ataca con la acción normal (X).
 */
function lancerTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "lancer" }>): GameResult {
  const target = game.board.unitAt(params.target);
  if (target === undefined) return errResult("No hay una unidad en esa casilla.");
  if (target.owner === playerId) return errResult("No puedes atacar a tu propia unidad.");

  const between = hexesInStraightLine(game.board, unit.position, params.target);
  const distance = distanceInHexes(game.board, unit.position, params.target);
  // Distancia 2 → 1 casilla entre; distancia 3 → 2 casillas entre (embestida de 1-2).
  if (distance < 2 || distance > 3 || between.length !== distance - 1) {
    return errResult("El Lancero embiste en línea recta a una unidad a 2-3 casillas.");
  }
  if (between.some((p) => game.board.unitAt(p) !== undefined)) {
    return errResult("El camino de la embestida debe estar libre.");
  }
  // Avanza hasta la casilla anterior al objetivo.
  const stop = between[between.length - 1]!;
  if (game.board.unitAt(stop) !== undefined) return errResult("El Lancero no tiene espacio para embestir.");

  // Caballero (I): la embestida se rechaza ANTES de avanzar si el Lancero no
  // está reforzado (2+ monedas) — no mueve ni gasta la moneda.
  if (target.type === "caballero" && !unit.isReinforced()) {
    return errResult("El Lancero no puede embestir a un Caballero sin estar reforzado (2+ monedas).");
  }

  game.board.moveUnit(unit, stop);
  return game.resolveAttack(playerId, unit, target, false);
}

/**
 * Mariscal: una unidad aliada a 1-2 casillas ataca (si puede hacer un ataque
 * normal; no vale para Arquero ni Lancero).
 */
function marshalTactic(game: Game, playerId: PlayerId, unit: Unit, params: Extract<AbilityRequest, { ability: "marshal" }>): GameResult {
  const ally = game.board.unitAt(params.ally);
  if (ally === undefined) return errResult("No hay una unidad aliada en esa casilla.");
  if (ally.owner !== playerId) return errResult("La unidad elegida debe ser aliada.");
  if (attackOnlyByAbility(ally.type)) {
    return errResult(`${UNIT_NAMES[ally.type]} no puede hacer un ataque normal (solo con su habilidad); el Mariscal no lo puede ordenar.`);
  }
  const range = distanceInHexes(game.board, unit.position, params.ally);
  if (range < 1 || range > 2) return errResult("La unidad aliada debe estar a 1 o 2 casillas del Mariscal.");

  const target = game.board.unitAt(params.attackTarget);
  if (target === undefined) return errResult("No hay una unidad en esa casilla.");
  if (target.owner === playerId) return errResult("No puedes atacar a tu propia unidad.");
  if (!game.board.areAdjacent(params.ally, params.attackTarget)) {
    return errResult("El ataque ordenado debe ser contra una unidad adyacente a la aliada.");
  }
  return game.resolveAttack(playerId, ally, target, false);
}

// ── Resultados (re-exportados para no duplicar tipos) ──────────────────────

function okResult(message: string): GameResult {
  return { success: true, message, events: [] };
}

function errResult(message: string): GameResult {
  return { success: false, message, events: [] };
}
