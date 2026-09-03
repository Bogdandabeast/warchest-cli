import type { FreeManeuver, FreeManeuverRequest, Game } from "../domain/game.ts";
import type { PlayerId } from "../domain/types.ts";
import type { UnitType } from "../domain/units.ts";
import { UNIT_NAMES } from "../domain/units.ts";
import type { GameStateView } from "./engine-view.ts";
import { targetPositions } from "./targeting.ts";

/** Maniobras que puede elegir el jugador al usar una concesión gratis. */
export type FreeKind = "move" | "attack" | "control";

/**
 * Concesiones pendientes del jugador que puede usar AHORA: suyas, con la
 * unidad todavía en el tablero y sin duplicados (misma unidad + mismo tipo de
 * concesión, como hace `play.ts`).
 */
export function grantsForPlayer(game: Game, playerId: PlayerId): FreeManeuver[] {
  return game.pendingFreeManeuvers
    .filter((fm) => fm.player === playerId && game.board.getAllUnits().includes(fm.unit))
    .filter((fm, index, all) => all.findIndex((g) => g.unit === fm.unit && g.kind === fm.kind) === index);
}

/**
 * Qué maniobras ofrece una concesión (viable-only, como el resto de la TUI):
 *  - Concesión de solo movimiento (Espadachín) → únicamente Mover.
 *  - El resto (Mercenario, cadena del Guerrero…) → Mover/Atacar/Dominar,
 *    cada una solo si tiene al menos un objetivo válido ahora mismo.
 */
export function kindsForFreeGrant(view: GameStateView, player: PlayerId, grant: FreeManeuver): FreeKind[] {
  const position = grant.unit.position;
  const can = (kind: FreeKind) => targetPositions(view, player, kind, position).length > 0;
  if (grant.kind === "move") return can("move") ? ["move"] : [];
  const kinds: FreeKind[] = [];
  if (can("move")) kinds.push("move");
  if (can("attack")) kinds.push("attack");
  if (can("control")) kinds.push("control");
  return kinds;
}

/** Texto mostrable para cada maniobra de la concesión. */
export function freeKindLabel(kind: FreeKind): string {
  return kind === "move" ? "Mover" : kind === "attack" ? "Atacar" : "Dominar";
}

/** Construye la petición de `executeFreeManeuver` para una concesión. */
export function freeRequest(grant: FreeManeuver, kind: FreeKind, target?: string): FreeManeuverRequest | undefined {
  const unitType = grant.unit.type;
  const unitPos = grant.unit.position;
  if (kind === "move") return target === undefined ? undefined : { kind: "move", unitType, to: target, unitPos };
  if (kind === "attack") return target === undefined ? undefined : { kind: "attack", unitType, target, unitPos };
  return { kind: "control", unitType, unitPos };
}

/** Texto mostrable del tipo de concesión (para la cabecera). */
export function grantKindLabel(grant: FreeManeuver): string {
  return grant.kind === "move" ? "movimiento gratis" : "maniobra gratis";
}

/** Etiqueta de la concesión: p. ej. «Mercenario en D6 · maniobra gratis». */
export function grantLabel(grant: FreeManeuver): string {
  return `${UNIT_NAMES[grant.unit.type as UnitType]} en ${grant.unit.position} · ${grantKindLabel(grant)}`;
}
