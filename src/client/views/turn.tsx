import { useEffect, useState } from "react";
import { NativeImage } from "@opentui/core";
import type { PlayerId } from "../../domain/types.ts";
import { COLORS } from "../theme.ts";
import { loadCachedTroopFile } from "../troop-images.ts";

/**
 * Pantalla de cambio de turno / revelación: entre cada turno se muestra la
 * facción del siguiente jugador con su ficha de control EN GRANDE (la blanca
 * para los Lobos, la negra para los Cuervos). Da privacidad en hot-seat: el
 * tablero queda oculto y el jugador entrante ve solo quién juega. Enter
 * continúa a la elección de moneda.
 */
export function TurnView({ player, round, initiative }: { player: PlayerId; round: number; initiative: boolean }) {
  const isPlayer1 = player === "player1";
  const faction = isPlayer1 ? "LOBOS" : "CUERVOS";
  const [token, setToken] = useState<NativeImage | undefined>();
  useEffect(() => {
    let alive = true;
    void loadCachedTroopFile(isPlayer1 ? "controltokenwhite.png" : "controltokenblack.png")
      .then((image) => { if (alive) setToken(image); })
      .catch(() => { /* sin ficha → marcador de texto */ });
    return () => { alive = false; };
  }, [isPlayer1]);

  return <box style={{ flexGrow: 1, flexDirection: "column", justifyContent: "center", alignItems: "center", backgroundColor: COLORS.background, gap: 1 }}>
    <text fg={COLORS.accent}>⚔ WAR CHEST · CAMBIO DE TURNO</text>
    <text fg={COLORS.muted}>{`RONDA ${round}${initiative ? " · CON INICIATIVA" : ""}`}</text>
    <box style={{ width: 26, height: 12, justifyContent: "center", alignItems: "center", border: true, borderColor: COLORS.border }}>
      {token !== undefined
        ? <image source={token} fit="fit" protocol="auto" style={{ width: 20, height: 10 }} />
        : <text fg={isPlayer1 ? COLORS.lobos : COLORS.cuervos} style={{ justifyContent: "center", alignItems: "center" }}>{isPlayer1 ? "◯" : "●"}</text>}
    </box>
    <text fg={isPlayer1 ? COLORS.lobos : COLORS.cuervos}>{`TURNO DE ${faction}`}</text>
    <text fg={COLORS.text}>Pulsa Enter para empezar tu turno</text>
    <text fg={COLORS.muted}>q salir</text>
  </box>;
}