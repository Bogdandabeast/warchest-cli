# Changelog

## v0.1.0 — Ciclo 1: Tablero 1v1 desde SVG

- **Dominio** (`src/domain/`):
  - Tipos base `Position` (string opaco) y `PlayerId` (spec §3.1).
  - Entidad `BoardNode` (spec §3.2.1): id, coordenadas para UI, vecinos y
    `startZone` (base de inicio de un jugador).
  - Agregado `Board` (spec §3.2.2): índice por `Position`, `getNode`,
    `getNeighbors`, `areAdjacent`, `getStartLocations`, validación de
    duplicados y aislamiento de listas.
- **Infraestructura** (`src/infrastructure/`):
  - `svg-parse.ts`: parseo compartido de elementos `<path>` del SVG
    (hexágonos, color, centro), reutilizado por el loader y el script de build.
  - `BoardLoader` (spec §8) y su implementación `SVGBoardLoader`: carga
    `warchest_playmat_1v1.svg` (o el playmat base, ignorando colores ajenos),
    deduplica hexágonos decorativos, calcula adyacencias por geometría
    (distancia mínima entre centros) y marca las 4 bases de jugadores.
- **Terrenos en `assets/terrain/`**: `build-terrain-svgs.ts` extrae cada tipo
  de terreno del tablero a un tile SVG independiente (un **único hexágono**
  representativo por tipo, con viewBox recortado y centrado):
  `terrain-normal.svg` (casilla verde de movimiento, D6),
  `terrain-base-neutral.svg` (base sin conquistar, A7: verde con marcador
  interior), `terrain-base-lobos.svg` (C1: hexágono amarillo **con el dibujo
  del lobo dentro**) y `terrain-base-cuervos.svg` (E11: hexágono morado **con
  el dibujo del cuervo dentro**). Script: `bun run terrain`.
  El parser de íconos expone `r2` (radio menor) y extrae los grupos de íconos
  anclando el match al tag que lleva `id="g..."`, para que contenedores
  externos (el layer `layer5` que envuelve a los lobos) no corrompan el XML.
- **Tablero reconstruido desde tiles** (`build-board-from-terrain.ts`,
  `bun run board-terrain`): compone `assets/board/board-1v1.svg` colocando el
  tile de cada terreno en las 37 casillas del playmat (coordenadas absolutas
  de los tiles + translate por casilla), renombra ids para evitar duplicados,
  verifica que el resultado sea igual al playmat 1v1 (mismas posiciones y
  colores) e imprime el tablero como mapa ASCII en la terminal.
- **Scripts**: `package.json` con `check`, `test`, `board`, `terrain`,
  `board-terrain` y los previstos en la spec §13 adaptados al estado actual
  del repo (`dev`/`start` apuntan a `index.ts` hasta que existan
  `src/server/` y `src/client/` en ciclos 6–7).
- **Pruebas** (`bun:test`): 17 tests — dominio (`BoardNode`/`Board`), loader
  contra los dos playmats (37 casillas, ids de rejilla, bases, adyacencias) y
  helper de parseo. `bun run check` y `bun test` en verde.
- Refactor: `build-playmat-1v1.ts` usa ahora `svg-parse.ts`; el SVG generado
  queda byte-idéntico (verificado con git diff).

## Antes

- `v0.0.0` — Proyecto inicializado (`bun init`), `spec.md`, playmats
  `warchest_playmat_base.svg` y `warchest_playmat_1v1.svg` (limpio, generado
  por el build script), config de CodeRabbit y flujo GitHub Flow documentado
  en `AGENTS.md`. Commit inicial en `main`.