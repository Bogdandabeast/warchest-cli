# Decisiones de diseño

## v0.1.0 — Ciclo 1: Tablero 1v1 desde SVG (2026-09-02)

- **Fuente del tablero**: se carga `warchest_playmat_1v1.svg` (generado en el
  ciclo 0 por `bun run board`). El loader también acepta el playmat base: como
  el filtrado es por color, ignorar colores ajenos hace que ambos archivos
  produzcan el mismo tablero (verificado por test).
- **Tablero 1v1 = 33 casillas verdes + 4 bases**: los hexágonos verdes
  (`#8fff91`) son las casillas normales; los 4 hexágonos de otros colores que
  están *dentro* de la zona verde (2 amarillos arriba, 2 morados abajo) son las
  **bases (localizaciones de inicio)** de los jugadores. Los colores
  cian/naranja/azul oscuro pertenecen a otras configuraciones y se ignoran.
- **Mapeo de bases**: amarillo (arriba) → `player1`, morado (abajo) →
  `player2`. El playmat no documenta la asignación; es una asunción
  configurable en `BASE_COLOR_TO_PLAYER` dentro del loader.
- **Deduplicación**: el SVG dibuja cada casilla dos veces (hexágono grande en
  la capa Board + decorativo pequeño en la capa Symbols a <1 px). Se deduplica
  por proximidad de centro con tolerancia de 3 px, conservando la primera
  aparición (la grande).
- **Adyacencia por geometría**: dos casillas son vecinas si la distancia entre
  sus centros es la distancia mínima de la rejilla (~257.7 px) con margen del
  5 %. La rejilla es regular, así que no hay falsos positivos (la siguiente
  distancia es ~446 px). Evita codificar vecindarios a mano y se adapta si
  cambia el arte.
- **IDs de casilla**: rejilla `A0`–`G12` (letra = columna A–G según x, número
  = fila 0–12 según y), siguiendo el estilo `letra + número` de la spec
  (p. ej. "move from A1 to B2"). El centro del tablero es `D6`.
- **`Position` es un string opaco** (spec §3.1): igualdad nativa `===`; los
  ids los genera el loader.
- **Fuera de alcance de este ciclo**: marcadores de dominio
  (`controlledBy`/`controlMarkers`), unidades y config de partida. `BoardNode`
  solo modela geometría + base de inicio; el resto llega en ciclos 2–3 según
  la spec.