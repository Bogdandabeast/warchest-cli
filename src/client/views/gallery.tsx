import { useEffect, useMemo, useState } from "react";
import { useTerminalDimensions } from "@opentui/react";
import { NativeImage } from "@opentui/core";
import { COLORS } from "../theme.ts";
import { BOARD_VARIANT_SCALES, boardVariantFile, loadBoardVariants } from "../board-images.ts";
import type { BoardVariantImage } from "../board-images.ts";
import { UNIT_NAMES, UNIT_TYPES } from "../../domain/units.ts";
import type { UnitType } from "../../domain/units.ts";
import { loadAllTroopImages, TROOP_ART_FILE } from "../troop-images.ts";

/** Una imagen de la galería: nombre del archivo + caja de visualización. */
export interface GalleryItem {
  image: string;
  label: string;
  /** Ancho/alto en celdas a los que se dibuja la imagen. */
  width: number;
  height: number;
}

/**
 * Filas de la galería: cada fila muestra [sin aro, con aro] del mismo
 * tamaño, en orden grande → mediano → pequeño.
 */
export const GALLERY_ROWS: readonly (readonly [GalleryItem, GalleryItem])[] = [
  [
    { image: "caballero-coin-grande.png", label: "caballero-coin-grande.png", width: 10, height: 5 },
    { image: "caballero-grande.png", label: "caballero-grande.png", width: 10, height: 5 },
  ],
  [
    { image: "caballero-coin-mediano.png", label: "caballero-coin-mediano.png", width: 6, height: 3 },
    { image: "caballero-mediano.png", label: "caballero-mediano.png", width: 6, height: 3 },
  ],
  [
    { image: "caballero-coin-pequeno.png", label: "caballero-coin-pequeno.png", width: 4, height: 2 },
    { image: "caballero-pequeno.png", label: "caballero-pequeno.png", width: 4, height: 2 },
  ],
];

/**
 * Las demás imágenes de `assets/troops/` (casilla, fichas y el caballero
 * original), en pares para que cada fila muestre dos con su nombre.
 */
export const OTHER_ROWS: readonly (readonly [GalleryItem, GalleryItem])[] = [
  [
    { image: "casilla.png", label: "casilla.png", width: 10, height: 5 },
    { image: "caballero.png", label: "caballero.png (original)", width: 10, height: 5 },
  ],
  [
    { image: "controltokenwhite.png", label: "controltokenwhite.png", width: 5, height: 3 },
    { image: "controltokenblack.png", label: "controltokenblack.png", width: 5, height: 3 },
  ],
];

function imageUrl(file: string): string {
  return new URL(`../../../assets/troops/${file}`, import.meta.url).toString();
}

/** Carga todas las imágenes de la galería (una sola vez, compartidas). */
let galleryCache: Promise<Map<string, NativeImage> | null> | undefined;
export function loadGalleryImages(): Promise<Map<string, NativeImage> | null> {
  galleryCache ??= (async () => {
    try {
      const entries = await Promise.all(
        [...GALLERY_ROWS.flat(), ...OTHER_ROWS.flat()].map(async (item) => {
          const image = await NativeImage.load(imageUrl(item.image));
          return [item.image, image] as const;
        }),
      );
      return new Map(entries);
    } catch {
      return null;
    }
  })();
  return galleryCache;
}

function GalleryItemView({ item, source }: { item: GalleryItem; source: NativeImage | undefined }) {
  return (
    <box style={{ flexDirection: "row", alignItems: "center", gap: 2, width: 46 }}>
      {source === undefined
        ? <text fg={COLORS.muted} style={{ width: item.width, height: item.height }}>?</text>
        : <image source={source} fit="fit" protocol="auto" style={{ width: item.width, height: item.height }} />}
      <box style={{ flexDirection: "column" }}>
        <text fg={COLORS.accent}>{item.label}</text>
        <text fg={COLORS.muted}>{`${source?.width ?? item.width}×${source?.height ?? item.height} px`}</text>
      </box>
    </box>
  );
}

/**
 * Página 3: los PNG de las 16 tropas (assets/troops/<tropa>.png), cada uno
 * con el nombre de la unidad y del archivo. Se cargan SOLO al abrir la
 * página (igual que las variantes del tablero).
 */
function TroopPage() {
  const { width } = useTerminalDimensions();
  const [troops, setTroops] = useState<Map<UnitType, NativeImage> | null>();
  useEffect(() => {
    let alive = true;
    void loadAllTroopImages().then((loaded) => { if (alive) setTroops(loaded); });
    return () => { alive = false; };
  }, []);

  if (troops === undefined) return <text fg={COLORS.text}>Cargando tropas…</text>;
  if (troops === null) return <text fg={COLORS.error}>No se pudieron cargar las imágenes de las tropas.</text>;
  // Menos columnas en terminales estrechos para que los tiles no se corten.
  const perRow = Math.max(1, Math.min(4, Math.floor((Number.isFinite(width) && width > 0 ? width : 100) / 25)));
  const rows = chunk(UNIT_TYPES, perRow);
  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      {rows.map((row, rowIndex) => (
        <box key={`troop-row-${rowIndex}`} style={{ flexDirection: "row", gap: 2 }}>
          {row.map((type) => {
            const image = troops.get(type);
            return (
              <box key={`troop-${type}`} style={{ flexDirection: "column", alignItems: "center", width: 24 }}>
                {image === undefined
                  ? <text fg={COLORS.muted} style={{ width: 10, height: 5, justifyContent: "center", alignItems: "center" }}>?</text>
                  : <image source={image} fit="fit" protocol="auto" style={{ width: 10, height: 5 }} />}
                <text fg={COLORS.accent}>{UNIT_NAMES[type]}</text>
                <text fg={COLORS.muted}>{TROOP_ART_FILE[type]}</text>
              </box>
            );
          })}
        </box>
      ))}
    </box>
  );
}

/** Azulejo de una resolución del tablero: preview pequeño + nombre + píxeles. */
function BoardTileView({ file, source }: { file: string; source: NativeImage | null | undefined }) {
  return (
    <box style={{ flexDirection: "column", alignItems: "center", width: 32 }}>
      {source === undefined
        ? <text fg={COLORS.muted} style={{ width: 14, height: 6, justifyContent: "center", alignItems: "center" }}>…</text>
        : source === null
          ? <text fg={COLORS.error} style={{ width: 14, height: 6, justifyContent: "center", alignItems: "center" }}>✕</text>
          : <image source={source} fit="fit" protocol="auto" style={{ width: 14, height: 6 }} />}
      <text fg={source === null ? COLORS.error : COLORS.accent}>{file}</text>
      <text fg={COLORS.muted}>{source === null ? ">4096 px" : source === undefined ? "…" : `${source.width}×${source.height} px`}</text>
    </box>
  );
}

/** Agrupa una lista en filas de `perRow`. */
function chunk<T>(items: readonly T[], perRow: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) rows.push(items.slice(i, i + perRow));
  return rows;
}

/**
 * Página 1: todas las resoluciones del tablero con su nombre de archivo.
 * Las variantes se cargan SOLO cuando esta página se muestra (para no
 * decodificar los PNG grandes al arrancar la app).
 */
function BoardPage() {
  const [boards, setBoards] = useState<readonly BoardVariantImage[] | null>();
  useEffect(() => {
    let alive = true;
    void loadBoardVariants().then((loaded) => { if (alive) setBoards(loaded); });
    return () => { alive = false; };
  }, []);

  if (boards === undefined) return <text fg={COLORS.text}>Cargando variantes del tablero…</text>;
  if (boards === null) return <text fg={COLORS.error}>No se pudieron cargar las variantes del tablero.</text>;
  const rows = chunk(BOARD_VARIANT_SCALES, 3);
  return (
    <box style={{ flexDirection: "column", gap: 1 }}>
      {rows.map((row, rowIndex) => (
        <box key={`board-row-${rowIndex}`} style={{ flexDirection: "row", gap: 1 }}>
          {row.map((scale) => {
            const entry = boards.find((variant) => variant.scale === scale);
            return <BoardTileView key={`board-${scale}`} file={boardVariantFile(scale)} source={entry?.image} />;
          })}
        </box>
      ))}
    </box>
  );
}

export function GalleryView({ page = 0 }: { page?: number }) {
  const [images, setImages] = useState<Map<string, NativeImage> | null>();
  useEffect(() => {
    let alive = true;
    void loadGalleryImages().then((loaded) => { if (alive) setImages(loaded); });
    return () => { alive = false; };
  }, []);

  const body = useMemo(() => {
    if (page === 1) return <BoardPage />;
    if (page === 2) return <TroopPage />;
    if (images === undefined) return <text fg={COLORS.text}>Cargando imágenes…</text>;
    if (images === null) return <text fg={COLORS.error}>No se pudieron cargar las imágenes.</text>;
    return (
      <box style={{ flexDirection: "column", gap: 1 }}>
        {GALLERY_ROWS.map(([clean, original], rowIndex) => (
          <box key={`coin-${rowIndex}`} style={{ flexDirection: "row", gap: 4 }}>
            <GalleryItemView item={clean} source={images.get(clean.image)} />
            <GalleryItemView item={original} source={images.get(original.image)} />
          </box>
        ))}
        <text fg={COLORS.muted}>— Otras imágenes de assets/troops —</text>
        {OTHER_ROWS.map(([a, b], rowIndex) => (
          <box key={`other-${rowIndex}`} style={{ flexDirection: "row", gap: 4 }}>
            <GalleryItemView item={a} source={images.get(a.image)} />
            <GalleryItemView item={b} source={images.get(b.image)} />
          </box>
        ))}
      </box>
    );
  }, [page, images]);

  return (
    <box style={{ flexDirection: "column", gap: 1, alignItems: "center", justifyContent: "center", flexGrow: 1 }}>
      {page === 0
        ? <>
            <text fg={COLORS.accent}>GALERÍA DE LA MONEDA DEL CABALLERO</text>
            <text fg={COLORS.muted}>caballero-coin-*.png = sin aro oscuro · caballero-*.png = aro original</text>
          </>
        : page === 1
          ? <>
              <text fg={COLORS.accent}>RESOLUCIONES DEL TABLERO 1V1 ({BOARD_VARIANT_SCALES.length})</text>
              <text fg={COLORS.muted}>de 5× a 0.3× · ✕ = excede el límite del cliente (~4096 px) · B = ver a tamaño real</text>
            </>
          : <>
              <text fg={COLORS.accent}>TROPAS · {UNIT_TYPES.length} PNG DE assets/troops</text>
              <text fg={COLORS.muted}>cada unidad usa su PNG tal cual · las 16 tropas tienen imagen propia</text>
            </>}
      {body}
      <text fg={COLORS.text}>[ ← → cambiar sección ]   [ Enter — JUGAR ]   [ B — TABLERO ]   [ q — SALIR ]</text>
      <text fg={COLORS.muted}>sección {page + 1}/3</text>
    </box>
  );
}