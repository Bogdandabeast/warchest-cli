import type { GameStateView } from "../engine-view.ts";
import { COLORS } from "../theme.ts";

export function Panels({ view }: { view: GameStateView }) {
  const active = view.currentPlayer === "player1" ? "LOBOS" : "CUERVOS";
  return <box style={{ width: 25, flexDirection: "column" }}>
    <box style={{ border: true, borderColor: COLORS.accent, height: 5, flexDirection: "column" }}>
      <text fg={COLORS.accent}>{`≫ ${active} ≪`}</text>
      <text>{`Iniciativa: ${view.initiative === "player1" ? "Lobos" : "Cuervos"}`}</text>
      <text>{`Fichas: ${view.markers[view.currentPlayer]}/6`}</text>
      <text fg={COLORS.muted}>La mano rival está oculta</text>
    </box>
    <box style={{ border: true, borderColor: COLORS.border, flexDirection: "column", flexGrow: 1 }}>
      <text fg={COLORS.accent}>REGISTRO</text>
      {view.lastEvents.slice(-4).map((event, index) => <text key={`${event}-${index}`} fg={COLORS.muted}>{`» ${event}`}</text>)}
    </box>
  </box>;
}
