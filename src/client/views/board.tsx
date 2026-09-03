import { useEffect, useMemo, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import type { GameStateView } from "../engine-view.ts";
import type { UnitType } from "../../domain/units.ts";
import { COLORS } from "../theme.ts";
import { dimHex, glowHex, hexBoardCanvas, hexBoardLayout, hexLineRuns, hexRingMask, hexTerrainColor, HEX_TABLE } from "../hex-board.ts";
import type { HexBoardLayout } from "../hex-board.ts";
import type { OverlayImages } from "../board-images.ts";
import { loadOverlayImages } from "../board-images.ts";
import { factionMark, UNIT_GLYPH, UNIT_NICKNAME } from "../art.ts";

type BoardCell = NonNullable<GameStateView["board"][string]>;

export { ImageBoardView } from "./board-image.tsx";

/**
 * Tablero de la partida: hexágonos de color nativos (el MISMO render que
 * `bun run render`) con las monedas de las unidades encima — el PNG de cada
 * tropa del tamaño del hexágono (1:1) cuando está cargado, o su marcador de
 * texto mientras tanto.
 *
 * Con `flip` (por defecto: rival arriba) el tablero se invierte verticalmente
 * para que el jugador actual tenga SIEMPRE sus bases abajo y el rival arriba.
 */
export function BoardView({ view, cursor, validTargets, hint, dim, flip, playableTypes }: { view: GameStateView; cursor?: string; validTargets?: readonly string[]; hint?: string; dim?: boolean; flip?: boolean; playableTypes?: readonly UnitType[] }) {
  const { width, height } = useTerminalDimensions();
  const canvas = useMemo(() => hexBoardCanvas({ width, height }), [width, height]);
  const [images, setImages] = useState<OverlayImages | null>();
  useEffect(() => {
    let alive = true;
    void loadOverlayImages().then((loaded) => { if (alive) setImages(loaded); });
    return () => { alive = false; };
  }, []);
  const mirrored = flip ?? view.currentPlayer === "player1";
  const layout = useMemo(() => hexBoardLayout(canvas.cols, canvas.rows, mirrored), [canvas.cols, canvas.rows, mirrored]);
  return <HexBoardView layout={layout} images={images ?? null} view={view} cursor={cursor} validTargets={validTargets} hint={hint} dim={dim} playableTypes={playableTypes} />;
}

/**
 * Tablero dibujado con hexágonos de color (como `bun run render`) dentro de
 * un lienzo de `layout.cols`×`layout.rows` celdas, más los overlays por
 * casilla: monedas de las unidades, fichas de control, id de base neutral,
 * cursor y objetivos.
 */
export function HexBoardView({ layout, images, view, cursor, validTargets, hint, dim, playableTypes }: { layout: HexBoardLayout; images: OverlayImages | null; view: GameStateView; cursor?: string; validTargets?: readonly string[]; hint?: string; dim?: boolean; playableTypes?: readonly UnitType[] }) {
  const targets = new Set(validTargets ?? []);
  if (cursor !== undefined) targets.add(cursor);
  const ids = Object.keys(view.board).filter((id) => layout.centers.has(id));
  const footer: string[] = [];
  if (validTargets?.length) footer.push(`Objetivos: ${validTargets.join(", ")}`);
  if (hint) footer.push(hint);

  // Tropas del jugador actual cuyo tipo está en la mano: son las que PUEDE
  // jugar este turno. Se resaltan con un halo de acento alrededor del
  // hexágono y el chip del apodo en color de acento (✦), para distinguirlas
  // de un vistazo del resto del tablero.
  const playable = new Set(playableTypes ?? []);
  const playableIds = new Set<string>();
  for (const id of ids) {
    const cell = view.board[id];
    if (cell?.unit !== undefined && cell.unit.owner === view.currentPlayer && playable.has(cell.unit.type)) playableIds.add(id);
  }

  // Modo de señalamiento: se oscurece todo el tablero y "brillan" (más
  // claros y con su color real) solo los hexágonos donde se puede actuar. El
  // hexágono SELECCIONADO se resalta además con un anillo en color de acento
  // alrededor (máscara `hexRingMask`) y un interior más luminoso, para que
  // siempre se vea cuál es.
  const selectedIndex = cursor === undefined ? -1 : layout.locations.findIndex((loc) => loc.id === cursor);
  const ringMask = dim === true && selectedIndex >= 0 ? hexRingMask(layout, selectedIndex) : null;
  // Fuera de señalamiento: si hay tropas jugables, se recalcula el tablero
  // para pintar su halo (borde exterior) en color de acento.
  const hasPlayable = playableIds.size > 0;
  const lines = dim === true
    ? hexLineRuns(layout, (index, _ringOwner, sampleIndex) => {
        if (ringMask !== null && sampleIndex !== undefined && ringMask[sampleIndex] === 1) return COLORS.accent;
        if (index === -1) return HEX_TABLE;
        const loc = layout.locations[index]!;
        const base = hexTerrainColor(loc.terrain);
        if (loc.id === cursor) return glowHex(base, 0.55);
        return targets.has(loc.id) ? glowHex(base) : dimHex(base);
      })
    : hasPlayable
      ? hexLineRuns(layout, (index, ringOwner) => {
          if (index === -1) {
            // Halo de acento alrededor de los hexágonos de las tropas jugables.
            if (ringOwner !== undefined && playableIds.has(layout.locations[ringOwner]!.id)) return COLORS.accent;
            return HEX_TABLE;
          }
          const loc = layout.locations[index]!;
          const base = hexTerrainColor(loc.terrain);
          // La casilla de una tropa jugable brilla un poco más.
          return playableIds.has(loc.id) ? glowHex(base, 0.18) : base;
        })
      : layout.lines;

  return <box style={{ flexDirection: "column", flexGrow: 1, flexShrink: 1, backgroundColor: COLORS.background, overflow: "hidden" }}>
    <text fg={COLORS.accent}>{`⚔ WAR CHEST · RONDA ${view.round} · TURNO ${view.currentPlayer === "player1" ? "LOBOS" : "CUERVOS"}`}</text>
    <box style={{ flexGrow: 1, flexShrink: 1, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <box style={{ position: "relative", width: layout.cols, height: layout.rows, backgroundColor: COLORS.background }}>
        <box style={{ flexDirection: "column", width: layout.cols, height: layout.rows }}>
          {lines.map((line, row) => (
            <text key={row} style={{ width: layout.cols, height: 1 }}>
              <>{line.map((run, runIndex) => <span key={runIndex} fg={run.fg} bg={run.bg}>{run.text}</span>)}</>
            </text>
          ))}
        </box>
        {ids.map((id) => {
          const anchor = layout.centers.get(id)!;
          const cell = view.board[id];
          if (cell === undefined) return null;
          // En modo señalamiento solo se pintan los overlays de las casillas
          // donde se puede actuar (y la del cursor); el resto queda oscuro.
          if (dim === true && !targets.has(id)) return null;
          return <HexOverlay key={id} layout={layout} anchor={anchor} images={images} id={id} cell={cell} cursor={cursor === id || targets.has(id)} target={cursor !== id && targets.has(id)} playable={dim !== true && playableIds.has(id)} />;
        })}
      </box>
    </box>
    {footer.map((line, index) => <text key={index} fg={COLORS.accent}>{line}</text>)}
  </box>;
}

/**
 * Overlay de una casilla anclado a su centro. La moneda (unidad) se dibuja
 * con el ANCHO del círculo inscrito en el hexágono y media altura de caja
 * (las celdas de terminal son ~2:1), de modo que se ve como una moneda
 * redonda del tamaño del hexágono (1:1). Cada tropa usa SU propio PNG; si la
 * imagen de esa unidad no está cargada se muestra su marcador de texto en el
 * centro.
 */
function HexOverlay({ layout, anchor, images, id, cell, cursor, target, playable }: { layout: HexBoardLayout; anchor: { col: number; row: number }; images: OverlayImages | null; id: string; cell: BoardCell; cursor: boolean; target: boolean; playable: boolean }) {
  const unit = cell.unit;
  const neutral = cell.terrain === "base-neutral";
  const coinW = layout.coin.width;
  const coinH = layout.coin.height;
  // El apodo de la unidad va DEBAJO de la moneda; la caja crece hacia abajo.
  // Con `playable` el chip se pinta en color de acento con ✦ (tropa que se
  // puede jugar este turno).
  const nickname = unit === undefined ? undefined : playable ? `✦ ${UNIT_NICKNAME[unit.type]}` : UNIT_NICKNAME[unit.type];
  const nickW = nickname === undefined ? 0 : nickname.length + 2;
  const boxW = Math.max(coinW, nickW);
  const left = Math.round(anchor.col - boxW / 2);
  const top = Math.round(anchor.row - coinH / 2);
  const coinLeft = Math.round((boxW - coinW) / 2);
  const ownerColor = unit === undefined ? COLORS.text : unit.owner === "player1" ? COLORS.lobos : COLORS.cuervos;
  const token = tokenImage(images, cell);
  const fallbackText = unit === undefined ? "" : `${factionMark(unit.owner)}${UNIT_GLYPH[unit.type]}×${unit.coins}`;
  // PNG de la tropa concreta (cada unidad usa SU imagen; si no está cargada, marcador de texto).
  const troopArt = unit !== undefined && images !== null ? images.troops.get(unit.type) : undefined;
  return <box style={{ position: "absolute", left, top, width: boxW, height: coinH + 2 }}>
    <box style={{ position: "absolute", left: coinLeft, top: 0, width: coinW, height: coinH, overflow: "hidden" }}>
      {troopArt !== undefined
        ? <image source={troopArt} fit="cover" protocol="auto" style={{ position: "absolute", left: 0, top: 0, width: coinW, height: coinH }} />
        : null}
      {troopArt !== undefined
        ? <text fg={ownerColor} style={{ position: "absolute", left: Math.max(0, coinW - fallbackText.length), top: 0 }}>{fallbackText}</text>
        : null}
      {unit !== undefined && troopArt === undefined
        ? <text fg={ownerColor} style={{ position: "absolute", left: Math.max(0, Math.round((coinW - fallbackText.length) / 2)), top: Math.round(coinH / 2) - 1 }}>{fallbackText}</text>
        : null}
      {token !== undefined && images !== null
        ? <image source={token} fit="fit" protocol="auto" style={{ position: "absolute", left: 1, top: Math.max(0, coinH - 3), width: 5, height: 3 }} />
        : null}
      {token === undefined && cell.controlledBy !== undefined && images === null
        ? <text fg={cell.controlledBy === "player1" ? COLORS.lobos : COLORS.cuervos} style={{ position: "absolute", left: 1, top: Math.max(0, coinH - 2) }}>{factionMark(cell.controlledBy)}</text>
        : null}
      {neutral ? <text fg={unit === undefined ? COLORS.neutral : COLORS.muted} style={{ position: "absolute", left: Math.max(0, coinW - 4), top: 0 }}>{id}</text> : null}
      {cursor ? <text fg={target ? COLORS.error : COLORS.accent} style={{ position: "absolute", left: Math.max(0, Math.round(coinW / 2) - 1), top: Math.max(0, Math.round(coinH / 2)) }}>{target ? "◇" : "◆"}</text> : null}
    </box>
    {nickname !== undefined
      ? <box style={{ position: "absolute", left: 0, top: coinH + 1, width: boxW, height: 1, justifyContent: "center", alignItems: "center", backgroundColor: playable ? COLORS.accent : COLORS.background }}>
          <text fg={playable ? COLORS.background : ownerColor} bg={playable ? COLORS.accent : COLORS.background}>{nickname}</text>
        </box>
      : null}
  </box>;
}

/** Ficha de control de la base (blanca lobos / negra cuervos), si la hay. */
export function tokenImage(images: OverlayImages | null, cell: BoardCell): import("@opentui/core").NativeImage | undefined {
  if (images === null) return undefined;
  if (cell.controlledBy === "player1" || cell.terrain === "base-lobos") return images.whiteToken;
  if (cell.controlledBy === "player2" || cell.terrain === "base-cuervos") return images.blackToken;
  return undefined;
}
