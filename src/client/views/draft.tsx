import { useEffect, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { NativeImage } from "@opentui/core";
import { UNIT_NAMES, UNIT_TOTAL_COINS } from "../../domain/units.ts";
import type { UnitType } from "../../domain/units.ts";
import type { PlayerId } from "../../domain/types.ts";
import { UNIT_GLYPH, UNIT_NICKNAME } from "../art.ts";
import { COLORS } from "../theme.ts";
import { draftLayout } from "../draft-layout.ts";
import { loadTroopImage } from "../troop-images.ts";

/**
 * Agrupa `items` en filas de `perRow` (de izquierda a derecha).
 */
function chunk<T>(items: readonly T[], perRow: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

/** Recorta una etiqueta para que quepa en una carta (sin saltos de línea). */
function fitLabel(label: string, maxWidth: number): string {
  return label.length <= maxWidth ? label : `${label.slice(0, Math.max(0, maxWidth - 1)).trimEnd()}…`;
}

/**
 * Draft: cada carta muestra el PNG de la tropa (en lugar del ASCII art) con su
 * nombre y monedas debajo. Debajo de la cabecera, un panel muestra EN GRANDE
 * las tropas que cada jugador ya ha elegido (sus PNG, con el apodo debajo de
 * cada una). Las celdas del terminal son ~2:1, así que el área de imagen usa
 * ancho 2×alto para que el PNG cuadrado se vea cuadrado.
 */
export function DraftView({ available, selected, player, playerId, lot, chosen }: { available: readonly UnitType[]; selected: number; player: string; playerId?: PlayerId; lot: { picked: number; total: number }; chosen: Readonly<Record<PlayerId, readonly UnitType[]>> }) {
  const { width, height } = useTerminalDimensions();
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 100;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 30;
  const layout = draftLayout(safeWidth, available.length);
  const focused = available[selected];

  // Tipos que se pintan: las cartas del lote + las ya elegidas por ambos.
  const imageTypes = [...new Set([...available, ...chosen.player1, ...chosen.player2])];

  // Imágenes de las tropas (una vez por lote; cacheadas por archivo).
  const [art, setArt] = useState<ReadonlyMap<UnitType, NativeImage>>(new Map());
  useEffect(() => {
    let alive = true;
    setArt(new Map());
    // allSettled: una carga que falla no aborta las demás; el mapa se
    // construye solo con las imágenes que SÍ cargaron (fallback: glifos).
    void Promise.allSettled(imageTypes.map(async (type) => [type, await loadTroopImage(type)] as const))
      .then((results) => {
        if (!alive) return;
        const entries = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
        setArt(new Map(entries));
      });
    return () => { alive = false; };
  }, [imageTypes.join(",")]);

  // ── Tamaño del área de imagen ─────────────────────────────────────────────
  // Filas de cartas y hueco vertical fijo (cabecera + panel de elegidas + pie).
  // El área de imagen usa ancho 2×alto (celdas ~2:1) para que el PNG cuadrado
  // se vea cuadrado.
  const pickedPlayers = ([["player1", chosen.player1], ["player2", chosen.player2]] as const).filter(([, list]) => list.length > 0);
  const picksRows = pickedPlayers.length === 0 ? 0 : pickedPlayers.length * 6; // etiqueta + fila de imágenes (5)
  const rows = Math.max(1, layout.rows);
  const fixed = 9 + picksRows; // cabecera (4) + elegidas + pie (5)
  const cardText = 4; // filas de texto bajo la imagen (nombre + monedas)
  const imageH = Math.max(2, Math.min(Math.floor(layout.cardWidth / 2) - 1, Math.floor((safeHeight - fixed) / rows) - cardText - 2));
  const imageW = Math.min(layout.cardWidth - 4, imageH * 2);
  const cardH = imageH + cardText + 2; // imagen + texto + bordes

  return <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background }}>
    <box style={{ height: 4, flexDirection: "column", alignItems: "center" }}>
      <text fg={COLORS.accent}>⚔ WAR CHEST · DRAFT</text>
      <text fg={COLORS.text}>{`${player.toUpperCase()} · CARTA ${lot.picked + 1} DE ${lot.total}`}</text>
      <text fg={COLORS.muted}>Elige una tropa con ← → y confirma con Enter</text>
    </box>
    {pickedPlayers.length > 0 ? (
      <box style={{ flexDirection: "column", flexGrow: 1, justifyContent: "center", alignItems: "center" }}>
        {pickedPlayers.map(([pid, list]) => (
          <box key={pid} style={{ flexDirection: "column", alignItems: "center" }}>
            <text fg={pid === "player1" ? COLORS.lobos : COLORS.cuervos}>{pid === playerId ? "▶ " : "  "}{pid === "player1" ? "LOBOS" : "CUERVOS"} · {list.length} elegida{list.length === 1 ? "" : "s"}</text>
            <box style={{ flexDirection: "row", gap: 2, justifyContent: "center" }}>
              {list.map((type) => {
                const artImage = art.get(type);
                return (
                  <box key={`picked-${type}`} style={{ flexDirection: "column", alignItems: "center", border: true, borderColor: COLORS.border, width: 12, height: 6 }}>
                    <box style={{ width: 10, height: 4, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                      {artImage !== undefined
                        ? <image source={artImage} fit="cover" protocol="auto" style={{ width: 10, height: 4 }} />
                        : <text fg={COLORS.muted} style={{ justifyContent: "center", alignItems: "center" }}>{UNIT_GLYPH[type]}</text>}
                    </box>
                    <text fg={pid === "player1" ? COLORS.lobos : COLORS.cuervos}>{UNIT_NICKNAME[type]}</text>
                  </box>
                );
              })}
            </box>
          </box>
        ))}
      </box>
    ) : null}
    <box style={{ flexDirection: "column", flexGrow: 1, justifyContent: "center", alignItems: "center", gap: 1 }}>
      {chunk(available, layout.columns).map((row, rowIndex) => (
        <box key={`draft-row-${rowIndex}`} style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 2 }}>
          {row.map((type, index) => {
            const global = rowIndex * layout.columns + index;
            const active = global === selected;
            const artImage = art.get(type);
            return <box key={`${type}-${global}`} style={{ flexDirection: "column", alignItems: "center", border: true, borderColor: active ? COLORS.accent : COLORS.border, width: layout.cardWidth, height: cardH }}>
              <box style={{ width: imageW, height: imageH, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                {artImage !== undefined
                  ? <image source={artImage} fit="cover" protocol="auto" style={{ width: imageW, height: imageH }} />
                  : <text fg={active ? COLORS.accent : COLORS.muted} style={{ justifyContent: "center", alignItems: "center" }}>{UNIT_GLYPH[type]}</text>}
              </box>
              <text fg={active ? COLORS.accent : COLORS.text}>{fitLabel(`${global + 1}. ${UNIT_GLYPH[type]} ${UNIT_NAMES[type]}`, layout.cardWidth - 2)}</text>
              <text fg={COLORS.muted}>{`${UNIT_TOTAL_COINS[type]} monedas`}</text>
            </box>;
          })}
        </box>
      ))}
    </box>
    <box style={{ height: 5, border: true, borderColor: COLORS.border, flexDirection: "column" }}>
      <text fg={COLORS.accent}>{focused ? `${UNIT_GLYPH[focused]} ${UNIT_NAMES[focused]}` : "Draft terminado"}</text>
      <text fg={COLORS.text}>{focused ? `Esta carta aporta ${UNIT_TOTAL_COINS[focused]} monedas a tu ejército.` : "Preparando la partida…"}</text>
      <text fg={COLORS.muted}>El draft no se puede cancelar · q salir</text>
    </box>
  </box>;
}