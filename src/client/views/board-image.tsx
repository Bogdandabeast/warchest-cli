import { NativeImage } from "@opentui/core";
import type { GameStateView } from "../engine-view.ts";
import type { PlayerId } from "../../domain/types.ts";
import { COLORS } from "../theme.ts";
import { hexCenter, BOARD_CANVAS, HEX_WIDTH } from "../board-geometry.ts";
import type { BoardImages } from "../board-images.ts";
import { factionMark } from "../art.ts";

type BoardCell = NonNullable<GameStateView["board"][string]>;

/**
 * Tablero con la imagen PNG del playmat completo (un solo `<image>`, tamaño
 * BOARD_CANVAS) más overlays por hexágono. Es la variante que usa la vista
 * previa de resoluciones (`board-preview`); la partida usa el tablero nativo
 * de hexágonos (`HexBoardView`). Cada unidad dibuja el PNG de SU tropa.
 */
export function ImageBoardView({ images, view, cursor, validTargets, hint }: { images: BoardImages; view: GameStateView; cursor?: string; validTargets?: readonly string[]; hint?: string }) {
  const ids = Object.keys(view.board);
  const { width, height } = BOARD_CANVAS;
  const targets = new Set(validTargets ?? []);
  return <box style={{ flexDirection: "column", flexGrow: 1, flexShrink: 1, backgroundColor: COLORS.background, overflow: "hidden" }}>
    <text fg={COLORS.accent}>⚔ WAR CHEST · RONDA {view.round} · TURNO {view.currentPlayer === "player1" ? "LOBOS" : "CUERVOS"}</text>
    <box style={{ flexGrow: 1, flexShrink: 1, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
      <box style={{ position: "relative", width, height }}>
        <image source={images.board} fit="fill" protocol="auto" style={{ width, height }} />
        {ids.map((id) => {
          const center = hexCenter(id);
          const cell = view.board[id];
          if (center === null || cell === undefined) return null;
          return <Overlay key={id} images={images} id={id} cell={cell} left={center.left} top={center.top} cursor={cursor === id || targets.has(id)} target={cursor !== id && targets.has(id)} />;
        })}
      </box>
    </box>
    {validTargets?.length ? <text fg={COLORS.accent}>Objetivos: {validTargets.join(", ")}</text> : null}
    {hint ? <text fg={COLORS.accent}>{hint}</text> : null}
  </box>;
}

/**
 * Overlay de una casilla anclado al centro del hexágono del PNG. La moneda
 * (unidad) se dibuja en una caja del ANCHO del hexágono (1:1) y, gracias a la
 * media altura de caja (las celdas son ~2:1), aparece como una moneda redonda
 * de ese tamaño sobre la casilla. Usa el PNG de la propia tropa.
 */
function Overlay({ images, id, cell, left, top, cursor, target }: { images: BoardImages; id: string; cell: BoardCell; left: number; top: number; cursor: boolean; target: boolean }) {
  const token = tokenFor(images, cell);
  const unit = cell.unit;
  const neutral = cell.terrain === "base-neutral";
  const cx = Math.round(left);
  const cy = Math.round(top);
  const coinW = Math.round(HEX_WIDTH);
  const coinH = Math.round(HEX_WIDTH / 2);
  const troopArt = unit !== undefined ? images.troops.get(unit.type) : undefined;
  return <box style={{ position: "absolute", left: cx - coinW / 2, top: cy - coinH / 2, width: coinW, height: coinH, overflow: "hidden" }}>
    {unit !== undefined && troopArt !== undefined ? <>
      <image source={troopArt} fit="cover" protocol="auto" style={{ position: "absolute", left: 0, top: 0, width: coinW, height: coinH }} />
      <text fg={unit.owner === "player1" ? COLORS.lobos : COLORS.cuervos} style={{ position: "absolute", left: coinW - 5, top: 0 }}>{`${factionMark(unit.owner)}×${unit.coins}`}</text>
    </> : unit !== undefined ? <text fg={unit.owner === "player1" ? COLORS.lobos : COLORS.cuervos} style={{ position: "absolute", left: Math.max(0, Math.round((coinW - 6) / 2)), top: Math.round(coinH / 2) - 1 }}>{`${factionMark(unit.owner)}×${unit.coins}`}</text> : null}
    {token !== undefined ? <image source={token} fit="fit" protocol="auto" style={{ position: "absolute", left: 1, top: Math.max(0, coinH - 3), width: 4, height: 2 }} /> : null}
    {neutral ? <text fg={COLORS.neutral} style={{ position: "absolute", left: 1, top: 0 }}>{id}</text> : null}
    {cursor ? <text fg={target ? COLORS.error : COLORS.accent} style={{ position: "absolute", left: coinW / 2 - 1, top: Math.max(0, coinH / 2) }}>{target ? "◇" : "◆"}</text> : null}
  </box>;
}

/** Ficha de control de la base: blanca para lobos, negra para cuervos. */
export function tokenFor(images: BoardImages, cell: BoardCell): NativeImage | undefined {
  const owner: PlayerId | undefined = cell.controlledBy;
  if (owner === "player1" || cell.terrain === "base-lobos") return images.whiteToken;
  if (owner === "player2" || cell.terrain === "base-cuervos") return images.blackToken;
  return undefined;
}
