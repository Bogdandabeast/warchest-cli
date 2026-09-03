import { NativeImage } from "@opentui/core";
import { useEffect, useState } from "react";
import type { GameStateView } from "../engine-view.ts";
import { COLORS } from "../theme.ts";
import type { UnitType } from "../../domain/units.ts";
import { UNIT_NAMES } from "../../domain/units.ts";
import { loadTroopImage } from "../troop-images.ts";
import { coinMark } from "../art.ts";

/**
 * Cara de una moneda de la mano: cada TROPA muestra su propio PNG (sin
 * transformaciones); la MONEDA REAL no tiene imagen y se muestra solo con su
 * símbolo ⟡. Mientras el PNG de la tropa se carga se muestra un marcador.
 */
function CoinFace({ type, royal }: { type?: UnitType; royal: boolean }) {
  const [art, setArt] = useState<NativeImage | undefined>();
  useEffect(() => {
    if (type === undefined) { setArt(undefined); return; }
    let alive = true;
    void loadTroopImage(type).then((image) => { if (alive) setArt(image); });
    return () => { alive = false; };
  }, [type]);
  if (royal) return <text fg={COLORS.accent} style={{ width: 8, height: 4, justifyContent: "center", alignItems: "center" }}>⟡</text>;
  if (art === undefined) return <text fg={COLORS.muted} style={{ width: 8, height: 4, justifyContent: "center", alignItems: "center" }}>◉</text>;
  return <image source={art} fit="cover" protocol="auto" style={{ width: 8, height: 4 }} />;
}

export function HandView({ view, selected }: { view: GameStateView; selected: number }) {
  return <box style={{ flexDirection: "column", height: 8, border: true, borderColor: COLORS.border }}>
    <text fg={COLORS.accent}>PASO 1/2 · ELIGE UNA MONEDA DE TU MANO</text>
    <box style={{ flexDirection: "row" }}>
      {view.hand.map((handCoin, index) => {
        const active = index === selected;
        const royal = handCoin.royal === true;
        const type = royal ? undefined : handCoin.type;
        return <box key={`${index}-${handCoin.type ?? "royal"}`} style={{ flexDirection: "row", border: true, borderColor: active ? COLORS.accent : COLORS.border, width: 30, height: 4, alignItems: "center", gap: 1, padding: 1 }}>
          <CoinFace type={type} royal={royal} />
          <text fg={active ? COLORS.accent : COLORS.text}>{`${index + 1}. ${handCoin.royal ? "⟡ MONEDA REAL" : UNIT_NAMES[handCoin.type!]}`}</text>
        </box>;
      })}
    </box>
    <text fg={COLORS.muted}>← → cambiar moneda · Enter ver acciones · q salir</text>
  </box>;
}
