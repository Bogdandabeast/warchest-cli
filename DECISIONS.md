# Decisiones de diseño

## v0.2.0 — Herramientas de desarrollo (2026-09-02)

- **ESLint como única herramienta de lint + formato**: se desinstaló Prettier.
  El formato lo aplica **ESLint Stylistic** (`@stylistic/eslint-plugin`) con
  el preset `customize` ajustado a las preferencias que tenía Prettier en el
  repo (indent 2, comillas dobles, `semi: true`, `braceStyle: 1tbs`,
  `commaDangle: always-multiline`, `max-len` 110). Eliminar Prettier evita
  dos configuraciones de estilo que pueden chocar (dependencias y tiempos de
  CI); `eslint --fix` se ejecuta en el hook pre-commit vía lint-staged.
- **TypeScript 6.0.3, no 7.x**: la 7.0.2 es la `latest` de npm, pero
  `typescript-eslint` exige `>=4.8.4 <6.1.0` (la 7 es el compilador nuevo
  nativo; hay que esperar soporte). Se fijó la última estable compatible
  (6.0.3) y se documentó en el `peerDependencies` del package.json; cuando
  typescript-eslint soporte TS ≥7, basta actualizar ese campo.
- **Tsconfig**: se añadió `"types": ["bun"]` para que TypeScript 6 resuelva
  los tipos ambientales de Bun (sin él, `console`/`process` no se encontraban
  al actualizar desde 5.x).
- **`no-non-null-assertion` desactivada (convención del repo)**: el código usa
  `!` deliberadamente sobre valores ya validados (guardas previas) y con
  `noUncheckedIndexedAccess` activo la alternativa (chequeos `undefined`
  repetidos) reduce la legibilidad. Decisión documentada en la propia config
  para que no se reactive por error.
- **commitlint conventional commits**: el repo ya usaba mensajes tipo
  `feat:…`/`chore:…` de facto; commitlint los hace obligatorios en el hook
  `commit-msg` (tipos estándar + `header-max-length` 100 + `subject-case`
  lower-case).
- **Husky v9 con `bun`**: los hooks usan `bunx lint-staged`/`bunx --no-install
  commitlint` y `bun run check`/`bun test` (Bun como runtime; sin npm).

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
- **Tipos de terreno** (extraídos a `assets/terrain/`): el playmat distingue
  las bases con un **hexágono pequeño interior** (marcador r1≈68 dibujado
  dentro de la casilla grande). Clasificación:
  - *Normales* (movimiento de tropas): hexágono verde sin marcador.
  - *Bases sin conquistar*: hexágono verde con marcador (A7, B4, C7, E5, F8,
    G5).
  - *Bases conquistadas de lobos* (amarillas): C1, F2.
  - *Bases conquistadas de cuervos* (moradas): B10, E11.
  La asignación amarillo→lobos y morado→cuervos es asumida (coherente con
  amarillo→`player1` y morado→`player2` del loader); cambiar en el script
  `build-terrain-svgs.ts` si el usuario la define distinta.
- **Un tile por terreno**: cada `assets/terrain/*.svg` contiene **un solo
  hexágono representativo** del tipo (casilla canónica por coordenada fijada
  en `SELECTED_CELL`), en vez de todos los del tablero — el arte es un tile
  reutilizable, no un mapa completo. El viewBox recorta a la casilla más un
  margen (`PAD_PX=60`) para no cortar trazos ni dibujos.
- **Íconos de lobo/cuervo dentro de las bases conquistadas**: el tile de base
  conquistada incluye el grupo de íconos del playmat que el arte ya coloca
  sobre esa base (amarillo → `g1009`-* lobo, morado → `g944`-* cuervo),
  traducido junto con la casilla vía el transform del documento. El grupo se
  elige por cercanía de centro a la casilla (tolerancia < 100 px).
- **Parseo robusto de grupos de íconos**: los lobos viven *dentro* del layer
  `layer5` del playmat y los cuervos *fuera*, así que un regex genérico de
  `<g>…</g>` capturaba el contenedor externo y desbalanceaba el XML. El parser
  ancla el match al tag de apertura que lleva `id="g…"` (los grupos de íconos
  solo contienen `<path>`, sin `<g>` anidados) y toma la matriz de ese mismo
  tag; el resultado son tiles well-formed (validados con `xmllint`).
- **El tablero se puede reconstruir desde los tiles** (`build-board-from-
  terrain.ts`): los tiles conservan las **coordenadas absolutas** del playmat,
  así que colocar un tile en una casilla = envolver su contenido en
  `<g transform="translate(centroCasilla − centroTile)">`. Se renombran los
  ids internos por casilla (sufijo `-<id de rejilla>`) para que el SVG
  compuesto no tenga ids duplicados, y la verificación compara los centros
  **renderizados** (path + translate del grupo) contra el playmat, no los
  `sodipodi:cx/cy` crudos del path (que son los del tile).
- **Render del tablero sin rasterizadores externos** (`render-board-
  terminal.ts`): en vez de convertir el SVG a imagen (los trazos de 9 px se
  pierden a escala de terminal), el renderer reconstruye la geometría
  flat-sided de cada casilla y pinta medio-bloques Unicode (▀) con ANSI
  truecolor; las casillas se contraen al 88 % para dejar visible el fondo de
  la mesa entre ellas. La geometría (r1/r2) se lee de los SVG de los tiles
  (via `BoardLocation.r1/r2`) en vez de constantes. Este mismo módulo será
  la base del renderizado ASCII del cliente TUI (spec §7).
- **El tablero cabe en pantalla sin scroll**: el render no fija solo el
  ancho — resuelve el ancho máximo que cumpla `filas ≈ ancho × 2100/3600
  / 2 ≤ LINES − cabecera − pie`, tomando el mínimo entre el ancho del TTY y
  el permitido por la altura. Así un render de 60×24 imprime 22 líneas y uno
  de 140×50 imprime 45, siempre dentro de la terminal.
- **El renderer usa el board compuesto desde tiles**: la fuente por defecto
  de `bun run render` es `assets/board/board-1v1.svg`, no el playmat — así el
  render refleja exactamente lo que construye `build-board-from-terrain.ts`
  (y lo regenera si no existe). Para eso la clasificación de terrenos vive en
  `src/infrastructure/terrain.ts` con dos variantes: la del playmat (coords
  directas) y la del board compuesto (centro = path + translate del grupo).
- **Fuera de alcance de este ciclo**: marcadores de dominio
  (`controlledBy`/`controlMarkers`), unidades y config de partida. `BoardNode`
  solo modela geometría + base de inicio; el resto llega en ciclos 2–3 según
  la spec. La clasificación de terrenos vive hoy en el script de assets; un
  ciclo posterior podrá llevarla al dominio (`BoardNode.terrain`).