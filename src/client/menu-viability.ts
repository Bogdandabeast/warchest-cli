import type { GameStateView } from "./engine-view.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import type { Game } from "../domain/game.ts";
import type { Unit } from "../domain/unit.ts";
import { attackOnlyByAbility, UNIT_TYPES } from "../domain/units.ts";
import { ACTIVATABLE_TACTICS } from "../domain/abilities.ts";
import { abilityStep } from "./ability-flow.ts";
import type { AbilityToken } from "./ability-flow.ts";

export type MenuAction = "deploy" | "bolster" | "move" | "attack" | "control" | "ability" | "initiative" | "recruit" | "pass" | "retire";

/**
 * ¿Existe AL MENOS una secuencia completa del asistente de tácticas? Recorre
 * las opciones en profundidad (≤ profundidad de tokens del asistente) para
 * no ofrecer "Usar habilidad" cuando no hay ningún blanco/condición válido.
 */
function abilityUsable(game: Game, playerId: PlayerId, unit: Unit): boolean {
  const walk = (tokens: readonly AbilityToken[]): boolean => {
    const progress = abilityStep(game, playerId, unit, tokens);
    if ("request" in progress) return true;
    if (progress.step.options.length === 0) return false;
    return progress.step.options.some((option) => walk([...tokens, option.token]));
  };
  return walk([]);
}

function hasUnit(view: GameStateView, type: (typeof UNIT_TYPES)[number]): boolean {
  return view.hand.some((coin) => coin.type === type);
}

function ownUnits(view: GameStateView, player: PlayerId) {
  return Object.entries(view.board)
    .filter(([, cell]) => cell.unit?.owner === player)
    .map(([position, cell]) => ({ position, unit: cell.unit! }));
}

function adjacent(view: GameStateView, from: Position): Position[] {
  const declared = view.board[from]?.neighbors;
  if (declared !== undefined) return declared.filter((position) => view.board[position] !== undefined);
  const column = from.charCodeAt(0);
  const row = Number(from.slice(1));
  return Object.keys(view.board).filter((position) => {
    const dx = Math.abs(position.charCodeAt(0) - column);
    const dy = Math.abs(Number(position.slice(1)) - row);
    return dx <= 1 && dy <= 1 && dx + dy > 0;
  });
}

export function viableActions(view: GameStateView, coinIndex?: number, game?: Game): MenuAction[] {
  const player = view.localPlayer;
  if (view.phase !== "playing") return [];
  if (view.currentPlayer !== player && coinIndex !== undefined) return [];
  const coin = coinIndex === undefined ? undefined : view.hand[coinIndex];
  const units = ownUnits(view, player);
  // La MONEDA REAL no actúa como ninguna unidad: solo sirve para descartes
  // boca abajo (iniciativa/reclutar/pasar) o para pagar la táctica de la
  // Guardia Real. Cuando el índice apunta a una moneda sin tipo, no se deben
  // ofrecer acciones de unidad (antes se tomaba la PRIMERA moneda de tropa de
  // la mano, así la moneda real "heredaba" Desplegar/Mover… de otra moneda
  // y luego el motor rechazaba la acción).
  const usableUnit = coin?.type ?? (coinIndex === undefined ? view.hand.find((handCoin) => handCoin.type !== undefined)?.type : undefined);
  const actions: MenuAction[] = [];
  const deployable = Object.entries(view.board).some(([position, cell]) => cell.unit === undefined && (cell.controlledBy === player || cell.terrain === "base-lobos" && player === "player1" || cell.terrain === "base-cuervos" && player === "player2") || usableUnit === "explorador" && cell.unit === undefined && Object.entries(view.board).some(([allyPosition, ally]) => ally.unit?.owner === player && adjacent(view, allyPosition).includes(position)));

  if (usableUnit !== undefined && deployable && !units.some(({ unit }) => unit.type === usableUnit && usableUnit !== "infanteria")) actions.push("deploy");
  if (usableUnit !== undefined && hasUnit(view, usableUnit) && units.some(({ unit }) => unit.type === usableUnit)) actions.push("bolster");
  if (usableUnit !== undefined && units.some(({ position, unit }) => unit.type === usableUnit && adjacent(view, position).some((to) => view.board[to]?.unit === undefined))) actions.push("move");
  if (usableUnit !== undefined && units.some(({ position, unit }) => unit.type === usableUnit && !attackOnlyByAbility(unit.type) && adjacent(view, position).some((to) => {
    const enemy = view.board[to]?.unit;
    if (enemy === undefined || enemy.owner === player) return false;
    // Caballero (I): solo puede atacarlo una unidad reforzada (2+ monedas).
    if (enemy.type === "caballero" && (unit.coins ?? 1) < 2) return false;
    return true;
  }))) actions.push("attack");
  if (usableUnit !== undefined && units.some(({ position, unit }) => unit.type === usableUnit && view.board[position]?.terrain !== "normal" && view.board[position]?.controlledBy !== player)) actions.push("control");
  // "Usar habilidad" SOLO si la táctica tiene al menos un blanco/condición
  // válida ahora (asistente con secuencia completa) y la moneda que paga:
  // la del tipo de la unidad, o la moneda Real en la Guardia Real.
  if (usableUnit !== undefined && units.some(({ unit }) => unit.type === usableUnit && ACTIVATABLE_TACTICS.has(unit.type))) {
    let playable = true;
    if (game !== undefined) {
      const actor = game.board.findUnit(player, usableUnit);
      playable = actor !== undefined
        && game.player(player).hand.hasUnit(usableUnit)
        && (usableUnit !== "guardia-real" || game.player(player).hand.hasRoyal())
        && abilityUsable(game, player, actor);
    }
    if (playable) actions.push("ability");
  }
  if (coin !== undefined && view.initiative !== player) actions.push("initiative");
  if (coin !== undefined && Object.values(view.reserve).some((count) => count !== undefined && count > 0)) actions.push("recruit");
  if (coin !== undefined) actions.push("pass");
  // Sin monedas en la mano: la única jugada es retirarse de la ronda (el
  // motor solo permite el pase con descarte).
  if (view.hand.length === 0 && actions.length === 0) actions.push("retire");
  return actions;
}

export function validNeighborTargets(view: GameStateView, from: Position): Position[] {
  return adjacent(view, from).filter((position) => view.board[position]?.unit === undefined);
}
