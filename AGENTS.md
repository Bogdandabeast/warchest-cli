# AGENTS.md — Notas para la próxima sesión del agente

> Lee este archivo completo al iniciar una nueva sesión. Registra el flujo de
> trabajo acordado con el usuario y el estado actual del proyecto.

## Flujo de trabajo (IMPORTANTE — acordado con el usuario)

- Repositorio remoto: `https://github.com/Bogdandabeast/warchest-cli` (público).
- Rama por defecto: **`main`**.
- **Cada ciclo de la spec (`spec.md`) es una rama nueva desde `main`** — se usa
  **GitHub Flow**:

  ```bash
  git checkout main && git pull
  git checkout -b ciclo-N-breve-descripcion   # p. ej. ciclo-1-board
  # ... implementar y commitear en la rama ...
  git push -u origin ciclo-N-breve-descripcion
  gh pr create --title "Ciclo N: ..." --body "..."   # PR hacia main
  ```

- **Nunca** hacer push directo a `main`: todo entra vía PR.
- CodeRabbit revisa automáticamente cada PR (config en `.coderabbit.yaml`,
  revisiones en español, perfil `assertive`). Resolver sus comentarios antes
  de mergear.
- **Nunca mergear automáticamente**: mientras haya una rama de ciclo activa
  (con trabajo sin terminar o sin aprobar), NO se mergea a `main` ni se abre
  PR sin que el usuario lo pida. Se continúa trabajando en esa rama hasta
  que todo esté bien (checks verdes, hooks pasando, docs actualizadas) y el
  usuario autorice el merge explícitamente.
- **PROHIBIDO saltarse los hooks de commit**: `--no-verify` (o cualquier
  forma de evadirlos) está prohibido sin excepción. Si un hook falla, se
  arregla el problema; nunca se omite.
- Definición de "done" por ciclo (spec §12):
  1. `bun run check:all` en verde (tsc + eslint + tests) o, mínimo,
     `bun run check` + `bun run lint` + `bun test`.
  2. Mensaje de commit **conventional** (feat/fix/chore/docs/… — lo valida
     commitlint en el hook `commit-msg`).
  3. `CHANGELOG.md` y `DECISIONS.md` actualizados (por qué, no solo qué).
  4. Commit atómico en la rama con solo los cambios del ciclo.

- **Hooks de git (Husky v9)**: en cada commit se ejecutan automáticamente
  `.husky/pre-commit` (lint-staged: eslint --fix sobre archivos staged +
  `bun run check` + `bun test`) y `.husky/commit-msg` (commitlint). Si el
  commit falla, es por estos hooks — se corrige el problema y se reintenta;
  jamás se saltan (ver prohibición arriba).

## Contexto del proyecto

- **War Chest 1vs1 en terminal**: Bun + TypeScript estricto, arquitectura por
  capas (dominio puro / aplicación / infraestructura / cliente TUI). La spec
  completa vive en `spec.md` y manda sobre las decisiones de diseño.
- **Tablero 1v1 (definido con el usuario)**:
  - Los hexágonos verdes (`#8fff91`) del playmat son las casillas del tablero.
  - Dentro de la zona verde hay **4 bases de jugadores**: 2 amarillas
    (`#ffff00`, arriba) y 2 moradas (`#9696ff`, abajo). Forman parte del
    tablero y serán las localizaciones de inicio en la configuración de partida.
  - Los hexágonos cian/naranja/azul oscuro son de otras configuraciones
    (más jugadores) y se ignoran.
  - **Tipos de terreno**: el hexágono pequeño interior de una casilla la
    marca como *base*. `assets/terrain/` contiene un SVG por tipo
    (`bun run terrain`): `terrain-normal` (27 casillas de movimiento),
    `terrain-base-neutral` (6 bases sin conquistar: A7, B4, C7, E5, F8, G5),
    `terrain-base-lobos` (amarillas C1/F2) y `terrain-base-cuervos`
    (moradas B10/E11).
- **Assets de SVG**:
  - `warchest_playmat_base.svg` — playmat original completo (61 hexágonos).
  - `warchest_playmat_1v1.svg` — playmat limpio para 1v1 (47 hexágonos:
    39 verdes + 4 bases + sus duplicados decorativos; sin hexágonos de otras
    configuraciones y sin los íconos de unidades huérfanos).
  - Regenerable con: `bun run board` (script `src/scripts/build-playmat-1v1.ts`,
    con aserciones que fallan si el SVG base cambia). Los íconos de unidades
    sobre las bases se conservan; los huérfanos se eliminan.

## Comandos

```bash
bun install              # instalar dependencias (corre el prepare → husky)
bun run start            # dibuja el tablero 1v1 en la terminal (index.ts)
bun run dev              # igual que start pero con --watch
bun run setup-draft      # configuración interactiva de partida (draft 1-2-2-2-1)
bun run play             # partida completa por terminal (hot-seat: draft → rondas → victoria)
bun run check            # typecheck (tsc --noEmit, TypeScript 7.0.2)
bun run lint             # eslint . (SOLO .js/.mjs/.cjs; sin lint de TS)
bun run lint:fix         # eslint . --fix
bun test                 # pruebas (bun:test)
bun run check:all        # typecheck + lint + tests en un comando
# Scripts de assets (alias en package.json):
bun run board            # regenerar warchest_playmat_1v1.svg
bun run terrain          # regenerar assets/terrain/*.svg
bun run board-terrain    # reconstruir assets/board/board-1v1.svg
bun run render           # render hexágonos en terminal (--playmat, --build)
```

> **Nota sobre lint**: typescript-eslint está fuera del toolchain (no soporta
> TypeScript 7). ESLint solo lintea/formatea `.js/.mjs/.cjs` (config y
> scripts); los `.ts` se validan con `tsc --noEmit` (tipos) y `bun test`.
> No reintroducir typescript-eslint ni Prettier sin consultar al usuario.

## Estado actual y próximos pasos

- Hecho:
  - Proyecto inicializado (bun init), spec.md presente.
  - `warchest_playmat_1v1.svg` generado y validado (XML válido, 47 hexágonos).
  - Repositorio remoto creado (`warchest-cli`, público) y flujo GitHub Flow
    documentado aquí.
  - **Ciclo 1 (rama `ciclo-1-board`)**: tablero 1v1 implementado — dominio
    (`BoardNode`, `Board`, `Position`, `PlayerId`), `SVGBoardLoader` que
    carga las 37 casillas del playmat con ids A0–G12, adyacencia por
    geometría, 4 bases mapeadas (amarillo→player1, morado→player2) y 17
    tests verdes. Terrenos extraídos a `assets/terrain/` (`bun run terrain`),
    board compuesto desde tiles en `assets/board/board-1v1.svg`
    (`bun run board-terrain`) y render hexágonos en terminal
    (`bun run render`). La clasificación de terrenos vive en
    `src/infrastructure/terrain.ts`.
  - **Ciclo 1.5 — Tooling (rama `ciclo-1-linting`)**: TypeScript 7.0.2
    (última versión) como compilador, ESLint 10 solo para `.js/.mjs/.cjs`
    (ESLint Stylistic como formateador estilo-Prettier, **sin Prettier** y
    **sin typescript-eslint**), Husky v9 (pre-commit con lint-staged +
    tsc + tests, commit-msg con commitlint conventional commits) y scripts
    `lint`/`lint:fix`/`check:all`. Además `bun run start` dibuja el tablero:
    `index.ts` llama a `renderBoardTerminal()` (exportada por el renderer,
    que sigue ejecutable como script con `import.meta.main`).
  - **Ciclo 2 (rama `ciclo-2-configuracion`, EN CURSO)**: configuración de
    partida completa implementada:
    - `src/domain/units.ts`: 16 unidades, `UNIT_TOTAL_COINS` (totales reales
      por tipo), flags X/I (`attackOnlyByAbility`, `hasInnateAbility`).
    - `src/domain/coins.ts`: jerarquía `Coin` → `UnitCoin`/`RoyalCoin` y
      colecciones (`CoinCollection`, `Bag`, `Hand`, `DiscardPile`, `Reserve`)
      sobre objetos `Coin`; la moneda real vive en la bolsa.
    - `src/domain/terrain.ts`: tipo `Terrain` en dominio + helpers
      (`isLocationTerrain`, `startZoneOf`); `BoardNode.terrain` sustituye a
      `startZone`.
    - `src/domain/board.ts`: `BoardNode` con control de fichas (una por
      localización, `addControlMarker` reemplaza en la conquista) y `Board`
      con registro de unidades (`Unit`/pilas en `src/domain/unit.ts`),
      localizaciones y `countControlMarkers`.
    - `src/domain/player.ts`: `Player` con colecciones, facción
      (Lobos/Cuervos) y 6 fichas.
    - `src/domain/game-setup.ts`: draft 1-2-2-2-1 sobre 8 cartas
      (`DraftSession`) y `configureGame` (bolsa = real + 2 por tipo, reserva
      = total − 2, 2 fichas iniciales sobre las bases, iniciativa → player2).
    - `src/domain/game.ts`: `Game` con las 9 acciones (deploy, bolster,
      move/attack/control/ability + claimInitiative/recruit/pass), reglas
      (ataque → moneda a la caja; Caballero solo atacable reforzado; Piquero
      contraataca; Guardia Real de reserva; Arquero/Lancero X…) y el **flujo
      de rondas** (spec §3.5/§4.2): `phase` (setup/playing/round-over/
      finished), `passed`, `startRound` (roba 3 a cada uno), `endRound`,
      `nextTurn`, `retire` (pase sin descarte con mano vacía) y la cola de
      **maniobras gratis** (`grantFreeManeuver`/`executeFreeManeuver` +
      `pruneFreeManeuvers` de concesiones obsoletas). Los cargadores
      (Caballería/Lancero) prevalidan la regla del Caballero ANTES de mover.
    - `src/domain/abilities.ts`: tácticas de las 16 unidades (9 activables;
      atributos (I) integrados): Ballestero ataca a la primera unidad de la
      línea, Caballería exige objetivo, Clérigo roba tras atacar/dominar
      (evento `drawn`), Guerrero encadena pagando monedas de su pila (nunca
      la última, evento `coin-spent`), Espadachín/Mercenario conceden
      maniobra gratis.
    - `src/domain/geometry.ts`: distancia BFS, líneas rectas, rangos y
      `reachableWithin`.
    - `src/infrastructure/svg-board-loader.ts`: **ya NO usa los playmats** —
      lee `assets/board/board-1v1.svg` (board compuesto del script), valida
      conteos 27/6/2/2 y calcula adyacencias.
    - `src/scripts/setup-draft.ts` (`bun run setup-draft`): draft interactivo
      por terminal con resumen final.
    - `src/scripts/play.ts` (`bun run play`): **partida completa hot-seat**
      por terminal — draft → rondas (robo, alternancia, fin de ronda) → las
      9 acciones con blancos guiados por listas de opciones válidas →
      maniobras gratis → victoria. Mapa ASCII del tablero + paneles de mano/
      reserva/fichas por turno. El Clérigo que roba mantiene el turno.
    - 91 tests verdes (`bun run check:all`).
  - **Ciclo 3 — cliente TUI (rama `ciclo-3-tui`)**: el cliente YA ESTÁ
    IMPLEMENTADO (commit `d13f557` y siguientes de la rama) siguiendo
    `docs/tui-design.md` (diseño UI/UX estilo Final Fantasy + ASCII art:
    layout de 4 regiones, cursor de casilla con resaltado, menú de acciones
    viable-only, mano rival oculta, screens de título/draft/cambio de
    turno/victoria) y `docs/client-tui-spec.md` (contrato
    engine→`GameStateView`, teclado por contexto, aceptación).
    - **Stack**: `@opentui/react` sobre `@opentui/core` + `@opentui/keymap`;
      TUI en TypeScript sobre Bun en el MISMO proceso que el motor — sin Rust
      ni transporte. La TUI NO mezcla readline (`setup-draft.ts`/`play.ts`)
      con el renderer OpenTUI (dos lecturas de stdin): usa `DraftSession` y
      `Game` directamente (single-fuente: `DraftSession.pick()` y las
      acciones/rounds de `Game`).
    - **Estructura `src/client/`**: `app.tsx` (máquina de estados de UI con
      `Game`/`DraftSession` en refs de componente, no módulo-global),
      `engine-view.ts` (única puerta al dominio; esconde mano/reserva del
      rival), helpers puros (`hex-map`, `hex-board`, `board-render`,
      `ability-flow`, `free-maneuver`, `menu-viability`, `targeting`, `log`,
      `art`, `theme`, `keymap`, `board-geometry`, `troop-images`) y vistas en
      `src/client/views/` (title, draft, board, hand, discard, menu, message,
      targeting, turn, victory, log, gallery, board-preview). Cada helper
      tiene tests puros (`bun test`, sin terminal real).
    - **Estado**: `bun run check:all` en verde (typecheck + eslint de
      `.js/.mjs/.cjs` + tests bun:test); la interacción completa (draft →
      rondas → 9 acciones → maniobras gratis → victoria) está implementada y
      se ejecuta con `bun run tui` (entry `src/client/main.tsx`, que hace
      `renderer.destroy()` en todos los paths de salida). Pendiente de cierre:
      resolver los comentarios de CodeRabbit de la rama, validar el smoke
      final y, cuando el usuario lo autorice, abrir/actualizar el PR a `main`.
    - **Skill de OpenTUI instalada** en `.agents/skills/opentui/`
      (framework: `anomalyco/opentui`). NO se versiona (`.gitignore`):
      reinstalar/actualizar con
      `npx skills add anomalyco/opentui --skill opentui --yes`.
    - Los PNG de assets (`assets/troops/*.png`, `assets/board/*.png`) tampoco
      se versionan (`.gitignore`); se generan con `bun run board-png` /
      `bun run trim-caballero` (o se añaden en local). La TUI degrada a
      texto/glifos cuando faltan o fallan las imágenes (logo ASCII,
      marcadores ◉/glifos, fichas ◯/●).
  - Siguiente paso de la spec (NO hacerlo sin el usuario): cerrar la rama
    actual (PR a `main` cuando el usuario lo autorice — nunca push directo) y
    después servidor/DTOs (`src/shared/`, `src/server/`, `src/shared/dto.ts`)
    y la parte online (opcional IA). `reglas.md` sigue pendiente de crear
    desde la conversación (las reglas confirmadas están en `DECISIONS.md` y
    los comentarios del código).
