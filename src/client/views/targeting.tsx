import { COLORS } from "../theme.ts";
import type { GameStateView } from "../engine-view.ts";
import { UNIT_NICKNAME } from "../art.ts";
import { BoardView } from "./board.tsx";

export function TargetingView({ view, action, targets, selected, title }: { view: GameStateView; action: string; targets: readonly string[]; selected: number; title?: string }) {
  const target = targets[selected];
  // Si el blanco es una unidad (ataque, tácticas de Arquero/Ballestero/
  // Lancero, objetivo de la Infantería…), el pie muestra a QUIÉN se apunta.
  const targetUnit = target === undefined ? undefined : view.board[target]?.unit;
  return <box style={{ flexDirection: "column", flexGrow: 1, alignItems: "center" }}>
    <BoardView view={view} validTargets={targets} cursor={target} hint={`OBJETIVO SELECCIONADO: ${target ?? "ninguno"}`} dim />
    <text fg={COLORS.accent}>{title !== undefined ? title : `ELIGE OBJETIVO · ${action.toUpperCase()}`}</text>
    <text fg={COLORS.text}>{target ? `▶ ${target}${targetUnit !== undefined ? ` · ${UNIT_NICKNAME[targetUnit.type]}` : ""}` : "No hay objetivos válidos para esta acción."}</text>
    <text fg={COLORS.muted}>← → cambiar objetivo · Enter confirmar · Esc cancelar y volver a acciones</text>
  </box>;
}
