import type { GameStateView } from "./engine-view.ts";
import type { MenuAction } from "./menu-viability.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import type { UnitType } from "../domain/units.ts";
import { attackOnlyByAbility } from "../domain/units.ts";

export function ownUnitPositions(view: GameStateView, player: PlayerId, type?: string): Position[] {
  return Object.entries(view.board)
    .filter(([, cell]) => cell.unit?.owner === player && (type === undefined || cell.unit.type === type))
    .map(([position]) => position);
}

export function targetPositions(view: GameStateView, player: PlayerId, action: MenuAction, unitPosition?: Position, selectedCoinType?: UnitType): Position[] {
  const entries = Object.entries(view.board);
  if (action === "deploy") {
    const scout = selectedCoinType === "explorador";
    const bases = entries.filter(([, cell]) => cell.unit === undefined && (cell.controlledBy === player || cell.terrain === "base-lobos" && player === "player1" || cell.terrain === "base-cuervos" && player === "player2"));
    const adjacentToAlly = entries.filter(([position, cell]) => cell.unit === undefined && Object.entries(view.board).some(([allyPosition, ally]) => ally.unit?.owner === player && adjacentPositions(view, allyPosition).includes(position)));
    return (scout ? [...bases, ...adjacentToAlly] : bases).map(([position]) => position).filter((position, index, all) => all.indexOf(position) === index);
  }
  if (!unitPosition) return [];
  const source = view.board[unitPosition];
  if (!source?.unit) return [];
  if (action === "move") return adjacentPositions(view, unitPosition).filter((position) => view.board[position]?.unit === undefined);
  if (action === "attack") {
    return adjacentPositions(view, unitPosition).filter((position) => {
      const cell = view.board[position];
      if (cell?.unit === undefined || cell.unit.owner === player) return false;
      if (attackOnlyByAbility(source.unit!.type)) return false;
      // Caballero (I): solo puede atacarlo una unidad reforzada (2+ monedas).
      if (cell.unit.type === "caballero" && (source.unit!.coins ?? 1) < 2) return false;
      return true;
    });
  }
  if (action === "control") return source.terrain !== "normal" && source.controlledBy !== player ? [unitPosition] : [];
  return [];
}

function adjacentPositions(view: GameStateView, from: Position): Position[] {
  const declared = view.board[from]?.neighbors;
  if (declared !== undefined) return declared.filter((position) => view.board[position] !== undefined);
  const [column, rowText] = [from.slice(0, 1), from.slice(1)];
  const row = Number(rowText);
  return Object.keys(view.board).filter((position) => {
    const columnDistance = Math.abs(position.charCodeAt(0) - column.charCodeAt(0));
    const rowDistance = Math.abs(Number(position.slice(1)) - row);
    return columnDistance <= 1 && rowDistance <= 1 && columnDistance + rowDistance > 0;
  });
}

export function cursorStep(positions: readonly Position[], current: number, direction: -1 | 1): number {
  if (positions.length === 0) return 0;
  return (current + direction + positions.length) % positions.length;
}
