import { RAVEN_ART, WOLF_ART } from "../art.ts";
import { COLORS } from "../theme.ts";

/** Facción ganadora: unión literal para que los llamadores se validen en compilación. */
export type VictoryFaction = "Lobos" | "Cuervos";

export function VictoryView({ faction, round }: { faction: VictoryFaction; round: number }) {
  const art = faction === "Lobos" ? WOLF_ART : RAVEN_ART;
  return <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>{art.map((line, index) => <text key={`victory-art-${index}`} fg={faction === "Lobos" ? COLORS.lobos : COLORS.cuervos}>{line}</text>)}<text fg={COLORS.accent}>{`≫ ¡${faction.toUpperCase()} VENCEN EN LA RONDA ${round}! ≪`}</text><text>Enter — nueva partida   q — salir</text></box>;
}
