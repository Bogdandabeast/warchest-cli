# Changelog

## v0.3.1 — Rondas y partida jugable en terminal (ampliación del ciclo 2)

- **Flujo de rondas en el dominio (spec §3.5 / §4.2)**: `Game` gana la máquina
  de fases `phase` (`setup | playing | round-over | finished`) y el estado
  `passed` por jugador. Métodos: `startRound` (RobandoFase: roba 3 monedas a
  cada jugador, fija al jugador con iniciativa, resetea la reclamación e
  incrementa `round`), `endRound` (FinRondaFase: descarta las manos),
  `nextTurn` (alternancia) y `retire` (pase sin descarte cuando la mano queda
  vacía). `pass` ahora marca al jugador como pasado de la ronda; la iniciativa
  reclamada se aplica en la ronda siguiente. `GamePhase` y `coin-spent` como
  tipos nuevos.
- **Reglas finales de las unidades (correcciones del usuario)**:
  - *Ballestero*: ataca a la **primera unidad en línea recta** — si la casilla
    intermedia está ocupada, esa es el objetivo (no la de detrás).
  - *Caballería*: su táctica **exige objetivo de ataque** (no vale solo
    moverse) y prevalida la regla del Caballero antes de moverse.
  - *Lancero*: la embestida también prevalidada contra el Caballero (no
    avanza ni gasta si la rechaza) — ambos cargadores dejan de mutar el
    tablero en acciones fallidas.
  - *Clérigo (I)*: tras **Atacar o Dominar** con éxito roba 1 moneda de su
    bolsa a la mano (evento `drawn`); la UI mantiene el turno del jugador
    para usarla de inmediato.
  - *Guerrero (I)*: **encadena maniobras las veces que quiera**, pagando cada
    una con una moneda de su propia pila (que sale del juego, como un ataque)
    y **nunca la última** (pila ≥ 2; evento `coin-spent`).
  - *Espadachín (I)* y *Mercenario (I)*: la concesión era solo un evento en
    v0.3.0; ahora hay una **cola real de maniobras gratis**
    (`grantFreeManeuver`/`executeFreeManeuver`, tipos `FreeManeuverKind`
    `move | maneuver | guerrero`) que el flujo de turnos ejecuta sin gastar
    moneda, con limpieza de concesiones obsoletas al salir la unidad del
    tablero (`pruneFreeManeuvers`).
- **Partida jugable 1v1 en la terminal**: `src/scripts/play.ts`
  (`bun run play`) — hot-seat (dos jugadores comparten terminal): draft
  interactivo (reutiliza `runDraft` exportado por `setup-draft.ts`) → rondas
  completas con robo, alternancia y fin de ronda → las 9 acciones con
  **blancos guiados por listas de opciones válidas** (nunca coordenadas a
  ciegas) → maniobras gratis ofrecidas antes de pasar el turno → victoria al
  colocar las 6 fichas. Render por turno de un **mapa ASCII del tablero**
  (celdas `A0`–`G12` con facciones, unidades y pilas) más paneles de mano,
  reserva y fichas. Mapa/decisiones: ver DECISIONS.md.
- **Pruebas**: 91 tests verdes — 5 nuevos de rondas (robo de 3, pase y fin de
  ronda con reciclaje de descarte, `retire` con mano vacía, iniciativa
  aplicada en la siguiente ronda, bloqueos de fase) y los de las reglas
  finales (Ballestero con intermedia ocupada, Caballería sin objetivo y
  contra Caballero, Lancero contra Caballero, Clérigo×2, cadena del
  Guerrero). `bun run check:all` en verde.

## v0.3.0 — Ciclo 2: Configuración de partida (draft + bolsas + control)

- **Terreno movido al dominio**: nuevo `src/domain/terrain.ts` con el tipo
  `Terrain` (`normal | base-neutral | base-lobos | base-cuervos`) y helpers
  (`isLocationTerrain`, `startZoneOf`). `BoardNode` ahora tiene `terrain`
  (por defecto `normal`) en lugar del flag `startZone` — la base de inicio
  del jugador se deriva del terreno. `src/infrastructure/terrain.ts` reutiliza
  el tipo del dominio (`TerrainName = Terrain`); los scripts de assets siguen
  funcionando igual.
- **Solo las bases son localizaciones**: `BoardNode.isLocation()` devuelve
  true solo para los 10 terrenos de base (6 neutrales + 2 de cada jugador);
  las 27 casillas verdes normales son solo de movimiento (no reciben fichas
  ni despliegues).
- **Control con fichas (spec §3.2.1)**: `BoardNode` gestiona UNA ficha de
  dominio por localización — `addControlMarker` reemplaza la ficha enemiga
  (conquista) y devuelve la suya, `removeControlMarker`, `controlledBy`,
  `controlMarkers`, `isControlledBy`, `isNeutral`. `Board` añade
  `placeControlMarker`/`removeControlMarker` (solo localizaciones),
  `getControlledLocations`, `countControlMarkers` y la condición de victoria
  (colocar las 6 fichas).
- **Unidad como pila de monedas (spec §3.2.3)**: `src/domain/unit.ts` con
  `Unit` (tipo, dueño, posición, `coins` como vida): `addCoin` (Reforzar),
  `removeCoin` (retira la moneda de arriba; `false` si la pila queda vacía),
  `isReinforced()` (2+ monedas). `Board` mantiene el registro de unidades
  (`placeUnit`, `moveUnit`, `removeUnit`, `unitAt`, `findUnit`,
  `getUnitsByPlayer`…).
- **Jerarquía de monedas (aprobada por el usuario)**: `Coin` (abstracta) →
  `UnitCoin(tipo)` + `RoyalCoin` en `src/domain/coins.ts`. La moneda real SÍ
  vive dentro de la bolsa (`addRoyal` en la colección), se roba y se descarta
  como una más; nunca va a la reserva. Las colecciones (`CoinCollection`
  abstracta + `Bag`/`Hand`/`DiscardPile`/`Reserve`) guardan objetos `Coin`.
- **Player (spec §3.2.4)**: `src/domain/player.ts` con `bag`, `hand`,
  `discard`, `reserve`, `unitCards`, facción (Lobos = player1, Cuervos =
  player2), 6 fichas de dominio, `drawCoins` (baraja el descarte si la bolsa
  se agota), `discardHand` y `canRecruit`.
- **Configuración de partida (spec §4.1)**: `src/domain/game-setup.ts` —
  `dealDraftCards` (8 al azar de las 16), `DraftSession` con el patrón
  1-2-2-2-1 expandido a 8 elecciones (player1 elige primero), y
  `configureGame` que tras el draft monta la bolsa (moneda real + 2 por tipo)
  y la reserva (total − 2 por tipo), coloca 2 fichas de dominio iniciales
  sobre las bases de cada jugador (C1/F2 y B10/E11, vacías de tropas) y
  otorga la iniciativa al segundo en elegir (player2).
- **`SVGBoardLoader` lee el board compuesto**: ya no usa los playmats como
  fuente del tablero (decisión del usuario) — carga
  `assets/board/board-1v1.svg` (generado por `bun run board-terrain`),
  clasifica terrenos con `classifyComposedBoardLocations` (los ids de rejilla
  salen de los `cell-*`), valida los conteos 27/6/2/2 y calcula la adyacencia
  por geometría. `board.ts` y los tests se actualizaron (37 casillas, D6 con
  sus 6 vecinos, bases C1/F2 y B10/E11).
- **Geometría de hexágonos**: `src/domain/geometry.ts` con `distanceInHexes`
  (BFS), `hexesInStraightLine` (para Ballestero/Lancero), `hexesAtRange` y
  `reachableWithin` (movimientos de 2 de Caballería ligera y Guardia Real).
- **`Game` + nueve acciones (spec §3.4 y §4.3)**: `src/domain/game.ts` con
  `deploy`, `bolster`, `executeManeuver` (move/attack/control/ability),
  `claimInitiative`, `recruit` y `pass`. Reglas aplicadas:
  - Desplegar: localización vacía controlada, una unidad por tipo (2 para
    Infantería), Explorador puede desplegar adyacente a un aliado.
  - Maniobras: descartan boca arriba una moneda del tipo de la unidad (la
    moneda Real en la táctica de la Guardia Real), solo si tiene éxito.
  - Atacar: retira la moneda de arriba de la pila enemiga y esa moneda sale
    del juego (a la caja). Caballero solo atacable por unidades reforzadas;
    Piquero contraataca en el mismo instante; Guardia Real puede sacrificar
    moneda de reserva; Arquero/Lancero (X) no pueden usar la acción Atacar.
  - Dominar: una ficha por localización; al colocar la última se gana
    (`winner`).
- **Habilidades de las 16 unidades (tabla del usuario)**:
  `src/domain/abilities.ts` con las tácticas activables (Alférez, Arquero,
  Ballestero, Caballería, Caballería ligera, Guardia Real, Infantería,
  Lancero, Mariscal) y los atributos (I) aplicados en el motor de acciones
  (Caballero, Piquero, Guardia Real, Espadachín — evento free-maneuver,
  Explorador, Infantería — 2 unidades, Mercenario — evento al reclutar).
- **Draft interactivo por terminal**: `src/scripts/setup-draft.ts`
  (`bun run setup-draft`) reparte 8 cartas, alterna jugadores (1-2-2-2-1),
  muestra las disponibles, y al terminar imprime el resumen de bolsa/reserva/
  fichas/iniciativa. Se añadieron los aliases de scripts (`board`, `terrain`,
  `board-terrain`, `render`, `setup-draft`) en `package.json`.
- **Pruebas**: 76 tests verdes (coins, player, game-setup, board con control
  y unidades, loader del board compuesto —incluidos SVG inválidos—, `Game` y
  habilidades). `bun run check:all` en verde.

## v0.2.0 — Ciclo 1.5: Herramientas de desarrollo (ESLint, Husky, commitlint)

- **TypeScript 7.0.2 (última versión)** como compilador único
  (`typescript@^7.0.2`): el compilador nativo nuevo (10× más rápido).
  **typescript-eslint fue retirado** (no soporta TS 7; se descartó también
  el setup oficial de compatibilidad con la API de TS 6 en paralelo por
  simplicidad — requiere aliases + postinstall). La validación del `.ts`
  queda en `tsc --noEmit` (tipos) + `bun test`.
- **ESLint 10 queda solo para `.js/.mjs/.cjs`** (`eslint.config.js`, flat
  config): `@eslint/js` recomendado + globals de Node + **ESLint Stylistic**
  como formateador estilo-Prettier (indent 2, comillas dobles, semi, 1tbs,
  trailing commas, max-len 110). ESLint no puede parsear TypeScript sin
  typescript-eslint, así que el lint de TS quedó fuera; **Prettier sigue
  desinstalado**.
- **Husky + lint-staged**: hook `pre-commit` que corre `lint-staged`
  (eslint --fix solo sobre `.js/.mjs/.cjs` staged) + `bun run check` (tsc 7)
  + `bun test`; y hook `commit-msg` que valida el mensaje con **commitlint**
  (conventional commits: `feat:`, `fix:`, `chore:`, …).
- **Verificaciones TS + tests**: scripts `lint`, `lint:fix` y `check:all`
  (typecheck + lint + tests); el hook pre-commit ya las ejecuta en cada
  commit. Se eliminan los aliases `format`/`format:check` (duplicados de
  lint) y el postinstall de reparación de layout.
- El código del repo fue reformateado automáticamente por ESLint Stylistic
  (solo cambios de estilo; sin cambios de comportamiento) — 22 tests verdes.
- **Correcciones de revisión de código (CodeRabbit)**: el agregado `Board`
  ahora valida la integridad del grafo al construirse (rechaza vecinos
  inexistentes y relaciones no bidireccionales; `areAdjacent` solo refleja
  conexiones válidas), `SVGBoardLoader.load()` rechaza playmats con
  cantidades inválidas de casillas o bases (nuevos tests con fixtures
  mínimos), el límite de filas de la rejilla es A0–G12 (`row > 12` se
  rechaza, también en `terrain.ts`) y `build-board-from-terrain.ts` valida
  los conteos 27/6/2/2 **antes** de escribir el SVG (el log de casillas usa
  los conteos validados, no valores fijos).
- **`bun run start` dibuja el tablero**: `index.ts` (punto de entrada real de
  la spec §13) ahora invoca `renderBoardTerminal()` — la misma función que
  el script `render-board-terminal.ts` (que se mantiene ejecutable en
  directo vía `import.meta.main`). Al arrancar el proyecto se pinta el
  tablero 1v1 en la terminal, igual que antes con `bun run render`.
- **Config de CodeRabbit**: `tools` (ast-grep, markdownlint) vivía a nivel
  raíz del YAML, clave inválida en el esquema vigente (validación fallaba);
  se movió bajo `reviews.tools` (documentado en el propio archivo).

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
