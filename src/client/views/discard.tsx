import { useEffect, useState } from "react";
import { NativeImage } from "@opentui/core";
import type { GameStateView } from "../engine-view.ts";
import type { UnitType } from "../../domain/units.ts";
import type { PlayerId } from "../../domain/types.ts";
import type { LogEntry } from "../log.ts";
import { COLORS } from "../theme.ts";
import { UNIT_GLYPH } from "../art.ts";
import { loadTroopImage } from "../troop-images.ts";
import { loadCachedTroopFile } from "../troop-images.ts";

/**
 * Zona inferior de la pantalla de juego:
 *
 * 1. DESCARTE por facción: cada moneda jugada se muestra SEGÚN CÓMO entró —
 *    BOCA ARRIBA (maniobra con su tropa) se ve la moneda (PNG de la tropa, o
 *    ⟡ la Real) y BOCA ABAJO (pasar, iniciativa, reclutar, fin de ronda) se
 *    muestra el DORSO con la ficha de control de la facción (blanca Lobos /
 *    negra Cuervos). La moneda Real solo existe boca abajo.
 * 2. REGISTRO: las últimas líneas de eventos de la partida (coloreadas por
 *    facción); pulsa `l` para el registro completo.
 */

function CoinBack({ player }: { player: PlayerId }) {
  const isPlayer1 = player === "player1";
  const [back, setBack] = useState<NativeImage | undefined>();
  useEffect(() => {
    let alive = true;
    void loadCachedTroopFile(isPlayer1 ? "controltokenwhite.png" : "controltokenblack.png")
      .then((image) => { if (alive) setBack(image); })
      .catch(() => { /* sin ficha → marcador de texto */ });
    return () => { alive = false; };
  }, [isPlayer1]);
  if (back !== undefined) return <image source={back} fit="cover" protocol="auto" style={{ width: 4, height: 2 }} />;
  return <text fg={isPlayer1 ? COLORS.lobos : COLORS.cuervos} style={{ width: 4, height: 2, justifyContent: "center", alignItems: "center" }}>{isPlayer1 ? "◯" : "●"}</text>;
}

function CoinFace({ type, royal }: { type?: UnitType; royal?: boolean }) {
  const [art, setArt] = useState<NativeImage | undefined>();
  useEffect(() => {
    if (type === undefined) { setArt(undefined); return; }
    let alive = true;
    void loadTroopImage(type).then((image) => { if (alive) setArt(image); });
    return () => { alive = false; };
  }, [type]);
  if (royal === true) return <text fg={COLORS.accent} style={{ width: 4, height: 2, justifyContent: "center", alignItems: "center" }}>⟡</text>;
  if (art === undefined || type === undefined) return <text fg={COLORS.muted} style={{ width: 4, height: 2, justifyContent: "center", alignItems: "center" }}>{type === undefined ? "?" : UNIT_GLYPH[type]}</text>;
  return <image source={art} fit="cover" protocol="auto" style={{ width: 4, height: 2 }} />;
}

/** Máximo de monedas visibles por jugador (las más recientes); el resto se resume. */
const MAX_VISIBLE = 10;

interface DiscardCoin { type?: UnitType; royal?: true; faceUp: boolean }

function PlayerDiscard({ faction, color, player, coins }: { faction: string; color: string; player: PlayerId; coins: readonly DiscardCoin[] }) {
  const recent = coins.slice(-MAX_VISIBLE).reverse();
  const hidden = coins.length - recent.length;
  return (
    <box style={{ flexDirection: "column", flexGrow: 1, minWidth: 0, padding: 1 }}>
      <text fg={color}>{`${faction} · ${coins.length} jugada${coins.length === 1 ? "" : "s"}`}</text>
      <box style={{ flexDirection: "row", gap: 1, minWidth: 0 }}>
        {recent.length === 0 ? <text fg={COLORS.muted}>— sin monedas jugadas —</text> : null}
        {recent.map((coin, index) => coin.faceUp
          ? <CoinFace key={`${index}-${coin.type ?? "royal"}`} type={coin.type} royal={coin.royal} />
          : <CoinBack key={`${index}-down`} player={player} />)}
        {hidden > 0 ? <text fg={COLORS.muted}>+{hidden}</text> : null}
      </box>
    </box>
  );
}

/** Últimas líneas del registro (recortadas a la columna) + aviso de tecla `l`. */
function RegisterColumn({ entries }: { entries: readonly LogEntry[] }) {
  const recent = entries.slice(-3);
  return (
    <box style={{ flexDirection: "column", width: 42, minWidth: 0, paddingLeft: 1, paddingRight: 1, border: true, borderColor: COLORS.border }}>
      <text fg={COLORS.accent}>REGISTRO · (l ver todo)</text>
      {recent.length === 0
        ? <text fg={COLORS.muted}>— sin eventos —</text>
        : recent.map((entry, index) => {
          const faction = entry.faction;
          const color = faction === "player1" ? COLORS.lobos : faction === "player2" ? COLORS.cuervos : COLORS.text;
          const text = entry.text.length > 36 ? `${entry.text.slice(0, 35)}…` : entry.text;
          return <text key={`${index}-${text}`} fg={color}>{`» ${text}`}</text>;
        })}
    </box>
  );
}

export function DiscardView({ view, log = [] }: { view: GameStateView; log?: readonly LogEntry[] }) {
  return (
    <box style={{ flexDirection: "row", height: 6, border: true, borderColor: COLORS.border, gap: 1 }}>
      <PlayerDiscard faction="LOBOS" color={COLORS.lobos} player="player1" coins={view.players.player1.discard ?? []} />
      <PlayerDiscard faction="CUERVOS" color={COLORS.cuervos} player="player2" coins={view.players.player2.discard ?? []} />
      <RegisterColumn entries={log} />
    </box>
  );
}
