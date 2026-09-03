import type { ImageRenderableSource } from "@opentui/core";
import { useMemo, useState } from "react";
import { LOGO } from "../art.ts";
import { COLORS } from "../theme.ts";

const LOGO_BADGE = new URL("../../../assets/troops/caballero-coin-mediano.png", import.meta.url).toString();

export function TitleView({ source = LOGO_BADGE }: { source?: ImageRenderableSource } = {}) {
  const [badgeFailed, setBadgeFailed] = useState(false);
  const badge = useMemo(() => {
    if (badgeFailed) return LOGO.map((line, index) => <text key={`logo-${index}`} fg={COLORS.accent}>{line}</text>);
    return <image source={source} fit="fit" protocol="auto" style={{ width: 8, height: 4 }} onError={() => setBadgeFailed(true)} />;
  }, [badgeFailed, source]);
  return <box style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", flexGrow: 1 }}>{badge}<text fg={COLORS.text}>[ Enter — EMPEZAR ]   [ q — SALIR ]</text></box>;
}