import type { LogEntry } from "../log.ts";
import { logEntryLabel } from "../log.ts";
import type { PlayerId } from "../../domain/types.ts";
import { COLORS } from "../theme.ts";

/** Color de una línea según la facción protagonista. */
function entryColor(faction?: PlayerId): string {
  if (faction === "player1") return COLORS.lobos;
  if (faction === "player2") return COLORS.cuervos;
  return COLORS.text;
}

/**
 * Pantalla de REGISTRO DE EVENTOS: el histórico completo de la partida (las
 * acciones con éxito y los eventos del motor, los más recientes al final).
 * Se abre con la tecla `l` desde la pantalla de juego.
 */
export function LogView({ entries }: { entries: readonly LogEntry[] }) {
  const visible = entries.slice(-40);
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background, paddingLeft: 1, paddingRight: 1 }}>
      <text fg={COLORS.accent}>⚔ WAR CHEST · REGISTRO DE EVENTOS</text>
      <text fg={COLORS.muted}>{entries.length === 0 ? "Todavía no hay eventos." : `${entries.length} evento(s) · los más recientes abajo`}</text>
      <box style={{ flexDirection: "column", flexGrow: 1, border: true, borderColor: COLORS.border, paddingLeft: 1 }}>
        {visible.map((entry, index) => (
          <text key={`${entries.length - visible.length + index}-${entry.text}`} fg={entryColor(entry.faction)}>
            {`» ${logEntryLabel(entry)}`}
          </text>
        ))}
      </box>
      <text fg={COLORS.muted}>Enter · volver al juego · q salir</text>
    </box>
  );
}
