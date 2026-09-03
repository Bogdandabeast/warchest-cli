/**
 * Agregado `Game` (spec §3.4): encapsula tablero, jugadores y las nueve
 * acciones con sus validaciones.
 *
 * Convenciones de monedas (regla real + confirmaciones del usuario):
 *  - Colocación (Desplegar/Reforzar): la moneda de la mano se coloca en el
 *    tablero (no va al descarte).
 *  - Maniobras (Mover/Dominar/Atacar/Habilidad): se descarta boca arriba una
 *    moneda del mismo tipo que la unidad que actúa, SOLO si la acción tiene
 *    éxito.
 *  - Descarte boca abajo (Reclamar iniciativa/Reclutar/Pasar): se descarta
 *    cualquier moneda de la mano (la moneda real también).
 *  - Un ataque elimina la moneda de arriba de la pila objetivo y esa moneda
 *    sale del juego (a la caja). Si era la última, la unidad desaparece.
 *  - Solo puede haber una unidad de cada tipo por jugador (salvo la
 *    Infantería, que puede desplegar 2).
 *
 * El flujo de rondas/turnos (robo, alternancia, fin de ronda) es de un ciclo
 * posterior (spec §3.5): aquí las acciones se ejecutan contra un estado con
 * el jugador actual ya fijado.
 */
import { Board } from "./board.ts";
import type { RandomSource } from "./coins.ts";
import type { PlayerId, Position } from "./types.ts";
import type { UnitType } from "./units.ts";
import { UNIT_NAMES } from "./units.ts";
import { attackOnlyByAbility } from "./units.ts";
import { Unit } from "./unit.ts";
import type { Player } from "./player.ts";
import { distanceInHexes } from "./geometry.ts";
import { discardsRoyalCoin, resolveAbility } from "./abilities.ts";
import type { AbilityRequest } from "./abilities.ts";

/** Resultado de una acción (spec §3.4) con eventos extra opcionales. */
export type GameEventType = "free-maneuver" | "unit-destroyed" | "coin-lost" | "victory" | "drawn" | "coin-spent";

export interface GameEvent {
  type: GameEventType;
  message: string;
  unit?: Unit;
  player?: PlayerId;
}

export type GameResult =
  | { success: true; message: string; events: GameEvent[] }
  | { success: false; message: string; events: GameEvent[] };

export const ok = (message: string, events: GameEvent[] = []): GameResult => ({
  success: true,
  message,
  events,
});

export const err = (message: string): GameResult => ({ success: false, message, events: [] });

/** Fase del juego (spec §3.5, State Pattern simplificado). */
export type GamePhase = "setup" | "playing" | "round-over" | "finished";

/** Qué moneda se descarta boca abajo (acciones de descarte). */
export type DiscardChoice = { kind: "unit"; unitType: UnitType } | { kind: "royal" };

/** Qué maniobra gratis concede un atributo (I). "guerrero" es una cadena que paga monedas de la pila de la unidad. */
export type FreeManeuverKind = "move" | "maneuver" | "guerrero";

/** Maniobra a ejecutar como acción gratis (sin pagar moneda). */
export type FreeManeuverRequest =
  | { kind: "move"; unitType: UnitType; to: Position; unitPos?: Position }
  | { kind: "attack"; unitType: UnitType; target: Position; unitPos?: Position }
  | { kind: "control"; unitType: UnitType; unitPos?: Position };

/** Maniobra gratis otorgada por un atributo (I), pendiente de ejecutar. */
export interface FreeManeuver {
  id: string;
  player: PlayerId;
  unit: Unit;
  kind: FreeManeuverKind;
  source: string;
}

/** Acciones de colocación y de descarte boca abajo. */
export type Action =
  | { kind: "deploy"; unitType: UnitType; position: Position }
  | { kind: "bolster"; unitType: UnitType }
  | { kind: "claim-initiative"; discard: DiscardChoice }
  | { kind: "recruit"; discard: DiscardChoice; reserveType: UnitType }
  | { kind: "pass"; discard: DiscardChoice };

/**
 * Maniobras: se descarta boca arriba una moneda del tipo de la unidad que
 * actúa. `unitPos` elige la unidad cuando hay dos del mismo tipo (Infantería).
 */
export type Maneuver =
  | { kind: "move"; unitType: UnitType; to: Position; unitPos?: Position }
  | { kind: "attack"; unitType: UnitType; target: Position; unitPos?: Position; royalGuardFromReserve?: boolean }
  | { kind: "control"; unitType: UnitType; unitPos?: Position }
  | { kind: "ability"; unitType: UnitType; params: AbilityRequest; unitPos?: Position };

export interface GameOptions {
  board: Board;
  players: Record<PlayerId, Player>;
  /** Jugador con la iniciativa (empieza la primera ronda). */
  initiative: PlayerId;
}

/**
 * Agregado del juego. Este ciclo no implementa el flujo de rondas completo
 * (spec §3.5, ciclo posterior); expone el estado que las acciones necesitan
 * (jugador actual, iniciativa, número de ronda) y el motor de acciones.
 */
export class Game {
  readonly board: Board;
  readonly players: Record<PlayerId, Player>;
  initiative: PlayerId;
  currentPlayer: PlayerId;
  round = 1;
  /** ¿Alguien reclamó la iniciativa en esta ronda? (máx. una vez por ronda). */
  initiativeClaimedThisRound = false;
  /** Jugador ganador (al colocar su última ficha de dominio). */
  winner?: PlayerId;
  /** Fase del juego (spec §3.5): setup → playing → round-over → finished. */
  phase: GamePhase = "setup";
  /** ¿Pasó cada jugador en la ronda en curso? (quien pasa no vuelve a actuar). */
  readonly passed: Record<PlayerId, boolean> = { player1: false, player2: false };
  /** Maniobras gratis pendientes (atributos I) por ejecutar en el flujo de turnos. */
  private readonly freeManeuvers: FreeManeuver[] = [];
  private freeManeuverCounter = 0;

  constructor(options: GameOptions) {
    this.board = options.board;
    this.players = options.players;
    this.initiative = options.initiative;
    this.currentPlayer = options.initiative;
  }

  player(id: PlayerId): Player {
    return this.players[id];
  }

  other(id: PlayerId): PlayerId {
    return id === "player1" ? "player2" : "player1";
  }

  /** Maniobras gratis pendientes (atributos I) por ejecutar. */
  get pendingFreeManeuvers(): readonly FreeManeuver[] {
    return this.freeManeuvers.slice();
  }

  /**
   * Registra una maniobra gratis (atributo I: Espadachín, Mercenario…) y
   * devuelve su id para que el flujo de turnos la ejecute.
   */
  private grantFreeManeuver(player: PlayerId, unit: Unit, kind: FreeManeuverKind, source: string): string {
    const id = `fm-${++this.freeManeuverCounter}`;
    this.freeManeuvers.push({ id, player, unit, kind, source });
    return id;
  }

  /**
   * Guerrero (I): tras una maniobra con éxito puede encadenar otra pagando
   * una moneda de su propia pila (nunca la última). La concesión queda
   * pendiente y se reutiliza mientras la unidad siga en el tablero.
   */
  private grantGuerreroChain(playerId: PlayerId, unit: Unit, events: GameEvent[]): void {
    if (unit.type !== "guerrero") return;
    if (!this.board.getAllUnits().includes(unit)) return;
    if (this.freeManeuvers.some((fm) => fm.unit === unit && fm.kind === "guerrero")) return;
    this.grantFreeManeuver(
      playerId,
      unit,
      "guerrero",
      "El Guerrero puede realizar otra maniobra pagando una moneda de su pila.",
    );
    events.push({
      type: "free-maneuver",
      unit,
      player: playerId,
      message: "El Guerrero puede realizar otra maniobra (paga una moneda de su pila).",
    });
  }

  /**
   * Clérigo (I): tras Atacar o Dominar con éxito, roba 1 moneda de su bolsa
   * a la mano (debe usarla de inmediato; el flujo de rondas del próximo ciclo
   * obligará a gastarla en la siguiente acción).
   */
  private drawForClerigo(playerId: PlayerId, events: GameEvent[]): void {
    const player = this.player(playerId);
    const drawn = player.drawCoins(1);
    if (drawn > 0) {
      events.push({
        type: "drawn",
        player: playerId,
        message: "El Clérigo roba 1 moneda de su bolsa (debe usarla de inmediato).",
      });
    }
  }

  /** Elimina las concesiones de una unidad que salió del tablero. */
  private pruneFreeManeuvers(unit: Unit): void {
    for (const fm of this.freeManeuvers.slice()) {
      if (fm.unit === unit) {
        this.freeManeuvers.splice(this.freeManeuvers.indexOf(fm), 1);
      }
    }
  }

  /**
   * Ejecuta una maniobra gratis pendiente (sin gastar moneda). Consume la
   * concesión solo si tiene éxito; si falla, queda pendiente para reintentar.
   */
  executeFreeManeuver(playerId: PlayerId, maneuver: FreeManeuverRequest): GameResult {
    // Si la petición precisa la posición, se busca la concesión de la unidad
    // en esa casilla (dos unidades del mismo tipo podrían tener concesiones).
    const candidates = this.freeManeuvers.filter((fm) => fm.player === playerId && fm.unit.type === maneuver.unitType);
    const grant =
      maneuver.unitPos !== undefined
        ? candidates.find((fm) => fm.unit.position === maneuver.unitPos) ?? candidates[0]
        : candidates[0];
    if (grant === undefined) {
      return err("No tienes una maniobra gratis pendiente para esa unidad.");
    }

    // Restricciones por tipo de concesión.
    if (grant.kind === "move" && maneuver.kind !== "move") {
      return err("Este atributo solo concede un movimiento gratis.");
    }

    // Re-localizar la unidad (el flujo de turnos puede haberla movido).
    const unit = this.findActingUnit(playerId, grant.unit.type, maneuver.unitPos);
    if (unit === undefined) {
      // La unidad ya no está: la concesión es basura y se limpia.
      this.pruneFreeManeuvers(grant.unit);
      return err("La unidad de la maniobra gratis ya no está en el tablero.");
    }

    // Guerrero: cada maniobra encadenada paga UNA moneda de su propia pila;
    // nunca puede pagar la última (mínimo 2 para encadenar).
    if (grant.kind === "guerrero" && unit.coins < 2) {
      return err("El Guerrero no puede pagar otra maniobra con su última moneda.");
    }

    const result = this.resolveManeuver(playerId, unit, { ...maneuver, unitType: unit.type });
    if (result.success) {
      if (grant.kind === "guerrero") {
        // La moneda de refuerzo gastada sale del juego (a la caja), como las
        // que retira un ataque. Si la unidad cae en la maniobra, la cadena
        // termina. La concesión NO se consume: queda para encadenar más.
        if (this.board.getAllUnits().includes(unit)) {
          const survived = unit.removeCoin();
          result.events.push({
            type: "coin-spent",
            unit,
            player: playerId,
            message: `El Guerrero paga una moneda de su pila (pila de ${unit.coins}).`,
          });
          if (!survived) {
            // Igual que en un ataque: si paga su última moneda, se retira.
            this.board.removeUnit(unit);
            this.pruneFreeManeuvers(unit);
            result.events.push({
              type: "unit-destroyed",
              unit,
              player: playerId,
              message: "El Guerrero se deshace al pagar su última moneda.",
            });
          }
        } else {
          this.freeManeuvers.splice(this.freeManeuvers.indexOf(grant), 1);
        }
      } else {
        this.freeManeuvers.splice(this.freeManeuvers.indexOf(grant), 1);
      }
    }
    return result;
  }

  // ── Acciones de colocación ───────────────────────────────────────────────

  /**
   * Desplegar: gasta una moneda de la mano y crea la unidad en una casilla
   * vacía que controles (localización). El Explorador (I) puede hacerlo en
   * CUALQUIER casilla vacía adyacente a una unidad aliada.
   */
  deploy(playerId: PlayerId, unitType: UnitType, position: Position): GameResult {
    const player = this.player(playerId);
    if (!player.hand.hasUnit(unitType)) {
      return err(`No tienes una moneda de ${UNIT_NAMES[unitType]} en la mano para desplegar.`);
    }

    // Una unidad de cada tipo por jugador, salvo la Infantería (atributo: 2).
    const existing = this.board.getUnitsByPlayer(playerId).filter((u) => u.type === unitType);
    const maxUnits = unitType === "infanteria" ? 2 : 1;
    if (existing.length >= maxUnits) {
      return err(`Ya tienes ${UNIT_NAMES[unitType]} en el tablero (máx. ${maxUnits} por jugador).`);
    }

    const node = this.board.getNode(position);
    if (node === undefined) return err(`La casilla ${position} no existe.`);
    if (this.board.unitAt(position) !== undefined) return err(`La casilla ${position} ya está ocupada.`);

    // Explorador (I): puede desplegar adyacente a cualquier unidad aliada —
    // y en CUALQUIER casilla vacía (también las de movimiento, no solo
    // localizaciones), aunque no controle esa casilla.
    const scout = unitType === "explorador" && this.adjacentToOwnUnit(playerId, position);
    if (!node.isLocation() && !scout) {
      return err("Solo puedes desplegar en una localización (una base) o, con el Explorador, adyacente a una unidad aliada.");
    }
    if (!scout && !node.isControlledBy(playerId)) {
      return err("Debes desplegar en una localización vacía que controles.");
    }

    player.hand.play(unitType);
    const unit = new Unit({ type: unitType, owner: playerId, position });
    this.board.placeUnit(unit, position);
    return ok(`${UNIT_NAMES[unitType]} desplegada en ${position}.`);
  }

  /** Reforzar: gasta una moneda y apila otra del mismo tipo sobre la unidad en el tablero. */
  bolster(playerId: PlayerId, unitType: UnitType): GameResult {
    const player = this.player(playerId);
    const unit = this.board.findUnit(playerId, unitType);
    if (unit === undefined) return err(`No tienes un ${UNIT_NAMES[unitType]} en el tablero para reforzar.`);
    if (!player.hand.hasUnit(unitType)) {
      return err(`No tienes una moneda de ${UNIT_NAMES[unitType]} en la mano para reforzar.`);
    }
    player.hand.play(unitType);
    unit.addCoin();
    return ok(`${UNIT_NAMES[unitType]} reforzada (pila de ${unit.coins}).`);
  }

  // ── Maniobras ────────────────────────────────────────────────────────────

  /**
   * Ejecuta una maniobra: localiza la unidad (por posición si hay dos del
   * mismo tipo), valida la moneda que exige y resuelve. La moneda se descarta
   * boca arriba SOLO si la maniobra tiene éxito (regla real).
   */
  executeManeuver(playerId: PlayerId, maneuver: Maneuver): GameResult {
    const unit = this.findActingUnit(playerId, maneuver.unitType, maneuver.unitPos);
    if (unit === undefined) {
      return err(`No tienes ${UNIT_NAMES[maneuver.unitType]} en el tablero (despliega antes de maniobrar).`);
    }

    const player = this.player(playerId);
    // La Guardia Real paga su táctica con la moneda Real; el resto, con una
    // moneda boca arriba del tipo de la unidad.
    const royalPaid = maneuver.kind === "ability" && discardsRoyalCoin(maneuver.params);
    if (royalPaid) {
      if (!player.hand.hasRoyal()) {
        return err("La táctica de la Guardia Real requiere descartar la moneda Real.");
      }
    } else if (!player.hand.hasUnit(maneuver.unitType)) {
      return err(`Necesitas descartar boca arriba una moneda de ${UNIT_NAMES[maneuver.unitType]} para maniobrar.`);
    }

    const result = this.resolveManeuver(playerId, unit, maneuver);
    if (result.success) {
      if (royalPaid) {
        // La moneda Real SIEMPRE se descarta boca abajo (no controla tropas),
        // incluso al pagar la táctica de la Guardia Real.
        player.hand.removeRoyal();
        player.discard.addRoyal();
      } else {
        // Maniobra con la tropa → la moneda se descarta BOCA ARRIBA.
        player.hand.removeUnit(maneuver.unitType);
        player.discard.addUnit(maneuver.unitType, 1, true);
      }
    }
    return result;
  }

  /** Unidad que actúa: por posición si hay varias del mismo tipo (Infantería). */
  private findActingUnit(playerId: PlayerId, unitType: UnitType, unitPos?: Position): Unit | undefined {
    const units = this.board.getUnitsByPlayer(playerId).filter((u) => u.type === unitType);
    if (units.length === 0) return undefined;
    if (units.length === 1 || unitPos === undefined) return units[0]!;
    return units.find((u) => u.position === unitPos);
  }

  private resolveManeuver(playerId: PlayerId, unit: Unit, maneuver: Maneuver): GameResult {
    let result: GameResult;
    switch (maneuver.kind) {
      case "move":
        result = this.moveAction(unit, maneuver.to);
        break;
      case "attack":
        result = this.attackAction(playerId, unit, maneuver.target, maneuver.royalGuardFromReserve ?? false);
        break;
      case "control":
        result = this.controlAction(playerId, unit);
        break;
      case "ability":
        // La táctica se resuelve sobre la unidad actuante (la de la Infantería
        // recorre todas sus unidades por su cuenta).
        result = resolveAbility(this, playerId, unit, maneuver.params);
        break;
    }
    // Guerrero (I): tras una maniobra con éxito puede encadenar otra.
    if (result.success) {
      this.grantGuerreroChain(playerId, unit, result.events);
    }
    return result;
  }

  /** Mover: la unidad se mueve 1 casilla adyacente y vacía. (El movimiento de 2 de la Caballería ligera es su táctica.) */
  private moveAction(unit: Unit, to: Position): GameResult {
    if (!this.board.areAdjacent(unit.position, to)) {
      return err("El movimiento normal es de 1 casilla adyacente.");
    }
    if (this.board.unitAt(to) !== undefined) return err(`La casilla ${to} está ocupada.`);
    this.board.moveUnit(unit, to);
    return ok(`${UNIT_NAMES[unit.type]} se mueve a ${to}.`);
  }

  /** Atacar: retira la moneda de arriba de la pila enemiga adyacente (sale del juego). */
  private attackAction(playerId: PlayerId, attacker: Unit, targetPos: Position, royalGuardFromReserve: boolean): GameResult {
    if (attackOnlyByAbility(attacker.type)) {
      return err(`${UNIT_NAMES[attacker.type]} solo puede atacar con su habilidad (no con la acción Atacar).`);
    }
    if (!this.board.areAdjacent(attacker.position, targetPos)) {
      return err("El ataque normal solo alcanza unidades adyacentes.");
    }
    const target = this.board.unitAt(targetPos);
    if (target === undefined) return err("No hay ninguna unidad enemiga en esa casilla.");
    if (target.owner === playerId) return err("No puedes atacar a tu propia unidad.");
    return this.resolveAttack(playerId, attacker, target, royalGuardFromReserve);
  }

  /**
   * Núcleo de resolución de un ataque (lo usan la acción Atacar y las
   * habilidades que atacan: Arquero, Ballestero, Lancero, Mariscal…).
   *
   * Reglas aplicadas:
   *  - La moneda de arriba del objetivo sale del juego (a la caja).
   *  - Caballero (I): solo puede ser atacado por unidades reforzadas (2+).
   *  - Guardia Real (I): su dueño puede eliminar una moneda de la reserva en
   *    lugar de la del tablero.
   *  - Piquero (I): al ser atacado por una unidad adyacente, elimina una
   *    moneda del atacante (simultáneo al ataque).
   *  - Espadachín (I): puede moverse tras atacar → evento free-maneuver.
   *
   * La moneda de maniobra ya la paga `executeManeuver` (o la habilidad que
   * concede el ataque); aquí NO se descarta ninguna moneda.
   */
  resolveAttack(
    actingPlayer: PlayerId,
    attacker: Unit,
    target: Unit,
    royalGuardFromReserve = false,
  ): GameResult {
    if (target.type === "caballero" && !attacker.isReinforced()) {
      return err("El Caballero solo puede ser atacado por unidades reforzadas (2+ monedas).");
    }

    const events: GameEvent[] = [];
    const targetPlayer = this.player(target.owner);
    let boardCoinHit = true;
    if (target.type === "guardia-real" && royalGuardFromReserve) {
      if (targetPlayer.reserve.removeUnit("guardia-real")) {
        boardCoinHit = false; // la pila no pierde moneda
      }
    }

    if (boardCoinHit) {
      const survived = target.removeCoin();
      if (!survived) {
        this.board.removeUnit(target);
        this.pruneFreeManeuvers(target);
        events.push({
          type: "unit-destroyed",
          unit: target,
          player: target.owner,
          message: `${UNIT_NAMES[target.type]} de ${target.owner} destruida (moneda a la caja).`,
        });
      } else {
        events.push({
          type: "coin-lost",
          unit: target,
          player: target.owner,
          message: `${UNIT_NAMES[target.type]} pierde una moneda (pila de ${target.coins}).`,
        });
      }
    }

    // Piquero (I): si una unidad ADYACENTE lo ataca, elimina una moneda del
    // atacante en el MISMO instante, sea cual sea el resultado para ambos
    // (FAQ: se aplica aunque el Piquero sea destruido).
    const adjacent = this.board.areAdjacent(attacker.position, target.position);
    if (target.type === "piquero" && adjacent && attacker.coins > 0) {
      const survived = attacker.removeCoin();
      if (!survived) {
        this.board.removeUnit(attacker);
        this.pruneFreeManeuvers(attacker);
        events.push({
          type: "unit-destroyed",
          unit: attacker,
          player: attacker.owner,
          message: `${UNIT_NAMES[attacker.type]} de ${attacker.owner} destruida por el contraataque del Piquero.`,
        });
      } else {
        events.push({
          type: "coin-lost",
          unit: attacker,
          player: attacker.owner,
          message: `${UNIT_NAMES[attacker.type]} pierde una moneda por el Piquero.`,
        });
      }
    }

    // Espadachín (I): puede moverse tras atacar (maniobra gratis, sin moneda).
    // Solo si el Espadachín sigue en el tablero tras el ataque y no tiene ya
    // una concesión de movimiento pendiente (no se duplican).
    const hasMoveGrant = this.freeManeuvers.some((fm) => fm.unit === attacker && fm.kind === "move");
    if (attacker.type === "espadachin" && this.board.getAllUnits().includes(attacker) && !hasMoveGrant) {
      this.grantFreeManeuver(attacker.owner, attacker, "move", "El Espadachín puede moverse tras atacar.");
      events.push({
        type: "free-maneuver",
        unit: attacker,
        player: attacker.owner,
        message: "El Espadachín puede moverse tras atacar.",
      });
    }

    // Clérigo (I): tras atacar con éxito roba 1 moneda de su bolsa. Se aplica
    // aunque el Clérigo caiga en el mismo intercambio (el ataque ocurrió).
    if (attacker.type === "clerigo") {
      this.drawForClerigo(attacker.owner, events);
    }

    // Guerrero (I): puede encadenar tras atacar (idempotente: la concesión
    // ya concedida no se duplica). También cubre los ataques ordenados por el
    // Mariscal, que no pasan por `resolveManeuver`.
    this.grantGuerreroChain(attacker.owner, attacker, events);

    return ok(`${UNIT_NAMES[attacker.type]} ataca a ${UNIT_NAMES[target.type]}.`, events);
  }

  /** Dominar: la unidad coloca una ficha en la localización que ocupa. */
  private controlAction(playerId: PlayerId, unit: Unit): GameResult {
    return this.controlLocation(playerId, unit.position, unit);
  }

  /**
   * Dominar una localización concreta: valida, coloca la ficha (devolviendo
   * la enemiga si conquista), comprueba la victoria y aplica el robo del
   * Clérigo. Lo usan la acción Dominar y la táctica de la Infantería, para
   * que ambas pasen por la misma detección de victoria.
   */
  controlLocation(playerId: PlayerId, position: Position, actor?: Unit): GameResult {
    const node = this.board.getNode(position);
    if (node === undefined) return err(`La casilla ${position} no existe.`);
    if (!node.isLocation()) {
      return err("Para dominar, la unidad debe estar en una localización (una base).");
    }
    if (node.isControlledBy(playerId)) return err("Ya controlas esta localización.");

    const events: GameEvent[] = [];
    const previous = this.board.placeControlMarker(position, playerId);
    let message = `Dominas ${position}.`;
    if (previous !== undefined && previous !== playerId) {
      message += ` Ficha de ${this.players[previous].factionName} devuelta.`;
    }

    if (this.countPlacedMarkers(playerId) >= this.player(playerId).controlMarkers) {
      this.winner = playerId;
      this.phase = "finished";
      events.push({
        type: "victory",
        player: playerId,
        message: `${this.players[playerId].factionName} coloca su última ficha y gana.`,
      });
    }

    // Clérigo (I): tras dominar con éxito roba 1 moneda de su bolsa.
    if (actor?.type === "clerigo") {
      this.drawForClerigo(playerId, events);
    }

    return ok(message, events);
  }

  // ── Descarte boca abajo ──────────────────────────────────────────────────

  /** Reclamar iniciativa: descarta boca abajo y toma la iniciativa la próxima ronda. */
  claimInitiative(playerId: PlayerId, discard: DiscardChoice): GameResult {
    const player = this.player(playerId);
    if (this.initiative === playerId) return err("Ya tienes la iniciativa; no puedes reclamarla.");
    if (this.initiativeClaimedThisRound) return err("La iniciativa ya se reclamó esta ronda (solo una vez por ronda).");
    if (!this.discardFaceDown(player, discard)) return err("Necesitas descartar una moneda de la mano.");
    this.initiative = playerId;
    this.initiativeClaimedThisRound = true;
    return ok(`${this.players[playerId].factionName} reclamará la iniciativa la próxima ronda.`);
  }

  /** Reclutar: descarta boca abajo y lleva una moneda de la reserva al descarte boca arriba. */
  recruit(playerId: PlayerId, discard: DiscardChoice, reserveType: UnitType): GameResult {
    const player = this.player(playerId);
    if (player.reserve.countUnit(reserveType) <= 0) {
      return err(`No tienes monedas de ${UNIT_NAMES[reserveType]} en la reserva.`);
    }
    if (!this.discardFaceDown(player, discard)) return err("Necesitas descartar una moneda de la mano.");
    player.reserve.recruit(reserveType, player.discard);

    const events: GameEvent[] = [];
    // Mercenario (I): la moneda reclutada va boca arriba al descarte (como
    // cualquier recluta) y, si el Mercenario ya está en el tablero, recibe
    // UNA maniobra gratis (mover/atacar/dominar, sin moneda).
    const mercenarioOnBoard = this.board.findUnit(playerId, "mercenario");
    if (reserveType === "mercenario" && mercenarioOnBoard !== undefined) {
      this.grantFreeManeuver(playerId, mercenarioOnBoard, "maneuver", "El Mercenario en el tablero puede hacer una maniobra tras este reclutamiento.");
      events.push({
        type: "free-maneuver",
        player: playerId,
        message: "El Mercenario en el tablero puede hacer una maniobra tras este reclutamiento.",
      });
    }
    return ok(`Reclutas una moneda de ${UNIT_NAMES[reserveType]} (boca arriba al descarte).`, events);
  }

  /** Pasar: descarta boca abajo y no hace nada más (queda fuera de la ronda). */
  pass(playerId: PlayerId, discard: DiscardChoice): GameResult {
    const player = this.player(playerId);
    if (!this.discardFaceDown(player, discard)) return err("Necesitas descartar una moneda de la mano para pasar.");
    this.passed[playerId] = true;
    this.currentPlayer = this.other(playerId);
    return ok(`${this.players[playerId].factionName} pasa.`);
  }

  // ── Rondas (spec §3.5 / §4.2) ───────────────────────────────────────────

  /**
   * Pase sin descarte: el jugador se quedó sin monedas en la mano y no puede
   * actuar (spec §4.2.3). No descarta nada porque no hay moneda que gastar.
   */
  retire(playerId: PlayerId): GameResult {
    if (this.passed[playerId]) return err(`${this.players[playerId].factionName} ya pasó esta ronda.`);
    if (!this.player(playerId).hand.isEmpty()) {
      return err("Con monedas en la mano se pasa descartando una (acción Pasar).");
    }
    this.passed[playerId] = true;
    this.currentPlayer = this.other(playerId);
    return ok(`${this.players[playerId].factionName} se queda sin monedas y pasa.`);
  }

  /** ¿Terminó la ronda en curso (ambos jugadores pasaron)? */
  get roundOver(): boolean {
    return this.phase === "playing" && this.passed.player1 && this.passed.player2;
  }

  /** Pasa el turno al otro jugador (alternancia de la UsandoMonedasFase). */
  nextTurn(): void {
    this.currentPlayer = this.other(this.currentPlayer);
  }

  /**
   * RobandoFase: ambos jugadores roban 3 monedas de su bolsa a la mano y
   * comienza la ronda. La iniciativa (la reclamada si la hubo) decide quién
   * actúa primero. `round` se incrementa al empezar la ronda siguiente.
   */
  startRound(random: RandomSource = Math.random): GameResult {
    if (this.winner !== undefined) return err("La partida ya tiene ganador.");
    if (this.phase === "playing") return err("Ya hay una ronda en curso.");
    if (this.phase === "round-over") this.round += 1;
    const events: GameEvent[] = [];
    for (const id of ["player1", "player2"] as const) {
      const player = this.player(id);
      const drawn = player.drawCoins(3, random);
      events.push({ type: "drawn", player: id, message: `${player.factionName} roba ${drawn} moneda(s) de la bolsa.` });
    }
    this.currentPlayer = this.initiative;
    this.passed.player1 = false;
    this.passed.player2 = false;
    this.initiativeClaimedThisRound = false;
    this.phase = "playing";
    return ok(`Comienza la ronda ${this.round} — iniciativa: ${this.players[this.initiative].factionName}.`, events);
  }

  /**
   * FinRondaFase: descarta las manos restantes y cierra la ronda. La próxima
   * `startRound` usa la iniciativa reclamada (si la hubo) y sube de ronda.
   */
  endRound(): GameResult {
    if (!this.roundOver) return err("La ronda no ha terminado: ambos jugadores deben pasar.");
    for (const id of ["player1", "player2"] as const) {
      this.player(id).discardHand();
    }
    this.phase = "round-over";
    return ok(`Fin de la ronda ${this.round}. Manos descartadas para la siguiente.`);
  }

  // ── Utilidades ───────────────────────────────────────────────────────────

  private discardFaceDown(player: Player, discard: DiscardChoice): boolean {
    if (discard.kind === "royal") {
      if (!player.hand.removeRoyal()) return false;
      player.discard.addRoyal();
      return true;
    }
    if (!player.hand.removeUnit(discard.unitType)) return false;
    player.discard.addUnit(discard.unitType);
    return true;
  }

  /** Fichas de dominio colocadas por el jugador. */
  countPlacedMarkers(playerId: PlayerId): number {
    return this.board.countControlMarkers(playerId);
  }

  /** ¿El jugador tiene alguna unidad propia adyacente a `position`? */
  adjacentToOwnUnit(playerId: PlayerId, position: Position): boolean {
    return this.board
      .getNeighbors(position)
      .some((neighbor) => this.board.unitAt(neighbor)?.owner === playerId);
  }

  /**
   * Unidades aliadas a una distancia de 1 a `range` desde `origin`.
   */
  alliedUnitsInRange(playerId: PlayerId, origin: Position, range: number): Unit[] {
    return this.board
      .getUnitsByPlayer(playerId)
      .filter((u) => {
        const d = distanceInHexes(this.board, origin, u.position);
        return d >= 1 && d <= range;
      });
  }

}
