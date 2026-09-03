/**
 * Vista previa del tablero por resolución: muestra cada variante de
 * `assets/board/board-1v1-*.png` (generadas por `bun run board-png`) en la
 * caja REAL del tablero (BOARD_CANVAS 80×33) con una partida de ejemplo
 * encima (el PNG de cada tropa sobre las casillas, fichas de base, ids en
 * bases neutrales, cursor y objetivos), para comparar qué resolución queda
 * mejor en el render del terminal.
 *
 * Las escalas se cargan BAJO DEMANDA (una a una, según el índice) porque los
 * PNG de alta resolución son grandes; las que superan el límite del
 * decodificador nativo (~4096 px, las escalas 3×+ ) se muestran con su
 * nombre y un aviso en lugar del tablero.
 *
 * La navegación la maneja App: ← → cambian de resolución, Esc/Enter vuelve
 * a la galería. Esta vista solo recibe el índice y carga las imágenes.
 */
import { useEffect, useMemo, useState } from "react";
import type { NativeImage } from "@opentui/core";
import type { GameStateView, UnitView } from "../engine-view.ts";
import type { PlayerId } from "../../domain/types.ts";
import type { Terrain } from "../../domain/terrain.ts";
import { COLORS } from "../theme.ts";
import type { BoardImages } from "../board-images.ts";
import { loadBoardImages, loadBoardVariant, BOARD_VARIANT_SCALES, boardVariantFile } from "../board-images.ts";
import { ImageBoardView } from "./board-image.tsx";

/** Partida de ejemplo: monedas sobre casillas, bases conquistadas y neutras. */
function demoView(): GameStateView {
  const cell = (terrain: Terrain, unit?: UnitView, controlledBy?: PlayerId) => ({
    terrain,
    ...(unit === undefined ? {} : { unit }),
    ...(controlledBy === undefined ? {} : { controlledBy }),
  });
  return {
    board: {
      "C1": cell("base-lobos", { type: "caballero", owner: "player1", coins: 3 }, "player1"),
      "F2": cell("base-lobos", undefined, "player1"),
      "B10": cell("base-cuervos", { type: "piquero", owner: "player2", coins: 2 }, "player2"),
      "E11": cell("base-cuervos", undefined, "player2"),
      "A7": cell("base-neutral"),
      "B4": cell("base-neutral"),
      "C7": cell("base-neutral"),
      "E5": cell("base-neutral", { type: "caballero", owner: "player1", coins: 4 }),
      "F8": cell("base-neutral"),
      "G5": cell("base-neutral"),
      "D6": cell("normal", { type: "infanteria", owner: "player2", coins: 1 }),
      "C3": cell("normal"),
      "E3": cell("normal"),
      "F4": cell("normal"),
      "B7": cell("normal"),
      "D9": cell("normal"),
    },
    players: {
      player1: { id: "player1", faction: "Lobos", unitCards: [], markersPlaced: 3, markersTotal: 6 },
      player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 2, markersTotal: 6 },
    },
    localPlayer: "player1",
    currentPlayer: "player1",
    initiative: "player2",
    round: 3,
    phase: "playing",
    hand: [],
    reserve: {},
    markers: { player1: 3, player2: 2 },
    pendingFreeManeuvers: [],
    lastEvents: [],
  };
}

export function BoardPreviewView({ index }: { index: number }) {
  const [base, setBase] = useState<BoardImages | null>();
  /** undefined = cargando · null = excede el límite del cliente. */
  const [variant, setVariant] = useState<NativeImage | null | undefined>();
  const view = useMemo(demoView, []);
  const scale = BOARD_VARIANT_SCALES[index]!; // App clampa index a [0, length)

  useEffect(() => {
    let alive = true;
    void loadBoardImages().then((loaded) => { if (alive) setBase(loaded); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setVariant(undefined);
    void loadBoardVariant(scale).then((image) => { if (alive) setVariant(image); });
    return () => { alive = false; };
  }, [scale]);

  const total = BOARD_VARIANT_SCALES.length;
  const file = boardVariantFile(scale);
  const detail = variant === undefined
    ? "cargando…"
    : variant === null
      ? "excede el límite del cliente (~4096 px) — el PNG existe pero no se puede decodificar en el TUI"
      : `${variant.width}×${variant.height} px (1:1 en el tablero)`;

  return (
    <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background }}>
      <text fg={COLORS.accent}>{`VISTA PREVIA DEL TABLERO · ${index + 1}/${total}`}</text>
      <text fg={variant === null ? COLORS.error : COLORS.muted}>{`${file} · escala ${scale}× · ${detail}`}</text>
      <box style={{ flexGrow: 1, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
        {base !== undefined && base !== null && variant !== undefined && variant !== null
          ? <ImageBoardView
              images={{ board: variant, troops: base.troops, whiteToken: base.whiteToken, blackToken: base.blackToken }}
              view={view}
              cursor="A7"
              validTargets={["C7", "G5"]}
            />
          : <text fg={variant === null ? COLORS.error : COLORS.muted}>{variant === null ? "Esta resolución no se puede mostrar en el cliente." : "…"}</text>}
      </box>
      <text fg={COLORS.text}>← → cambiar resolución · Esc / Enter volver a la galería</text>
    </box>
  );
}