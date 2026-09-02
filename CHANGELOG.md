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
- **Render del tablero en terminal** (`render-board-terminal.ts`,
  `bun run render`): dibuja el tablero como hexágonos de colores (ANSI
  truecolor, medio-bloques ▀) a partir de **`assets/board/board-1v1.svg`**
  (el board compuesto desde los tiles; se regenera solo si falta). Usa la
  geometría (r1/r2) de los propios SVG de los tiles y **se ajusta al ancho y
  alto de la terminal para que el tablero se vea completo sin scrollear**
  (resuelve filas máximas = ancho × 2100/3600 / 2). Es el render que
  reutilizará el cliente TUI (spec §7). Flag `--playmat` para renderizar el
  playmat original.
- **Clasificación de terrenos compartida** (`src/infrastructure/terrain.ts`):
  `classifyBoardLocations` (playmat) y `classifyComposedBoardLocations`
  (board compuesto, suma el translate del grupo `cell-*` al centro del path),
  con los colores, nombres de archivo y símbolos de los 4 terrenos.
- **Scripts**: `package.json` con solo los comandos de la spec §13 y los
  previstos (`dev`, `start`, `test`, `check`); `dev`/`start` apuntan a
  `index.ts` hasta que existan `src/server/` y `src/client/` en ciclos 6–7.
  Los scripts de assets (`build-playmat-1v1`, `build-terrain-svgs`,
  `build-board-from-terrain`, `render-board-terminal`) se ejecutan
  directamente con `bun run src/scripts/…`.
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