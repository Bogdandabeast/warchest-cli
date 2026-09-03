import type { MenuAction } from "../menu-viability.ts";
import { COLORS } from "../theme.ts";

const LABELS: Readonly<Record<MenuAction, string>> = {
  deploy: "Desplegar", bolster: "Reforzar", move: "Mover", attack: "Atacar", control: "Dominar",
  ability: "Usar habilidad", initiative: "Reclamar iniciativa", recruit: "Reclutar", pass: "Pasar",
  retire: "Retirarse",
};

const SYMBOLS: Readonly<Record<MenuAction, string>> = {
  deploy: "＋", bolster: "»", move: "⇢", attack: "⚔", control: "▣",
  ability: "✦", initiative: "★", recruit: "◎", pass: "…", retire: "∅",
};

export function MenuView({ actions, selected, coinLabel }: { actions: readonly MenuAction[]; selected: number; coinLabel: string }) {
  return <box style={{ flexDirection: "column", height: actions.some((action) => action === "retire") ? 7 : 11, border: true, borderColor: COLORS.accent }}>
    <text fg={COLORS.accent}>{`PASO 2/2 · ¿QUÉ HACER CON ${coinLabel.toUpperCase()}?`}</text>
    <box style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {actions.map((action, index) => <box key={action} style={{ border: true, borderColor: index === selected ? COLORS.accent : COLORS.border, width: 24, height: 3 }}>
        <text fg={index === selected ? COLORS.accent : COLORS.text}>{`${index === selected ? "▶" : " "} ${index + 1}. ${SYMBOLS[action]} ${LABELS[action].toUpperCase()}`}</text>
      </box>)}
    </box>
    <text fg={COLORS.muted}>← → cambiar acción · Enter confirmar · Esc volver a monedas</text>
  </box>;
}
