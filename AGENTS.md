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
- Definición de "done" por ciclo (spec §12):
  1. `bun run check` sin errores (tsc `--noEmit`).
  2. `bun test` en verde.
  3. `CHANGELOG.md` y `DECISIONS.md` actualizados (por qué, no solo qué).
  4. Commit atómico en la rama con solo los cambios del ciclo.

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
bun install              # instalar dependencias
bun run check            # typecheck (tsc --noEmit)
bun test                 # pruebas (bun:test)
bun run board            # regenerar warchest_playmat_1v1.svg desde el base
bun run terrain          # regenerar assets/terrain/*.svg desde el playmat 1v1
bun run board-terrain    # reconstruir assets/board/board-1v1.svg desde los tiles
                         # y mostrar el tablero como mapa ASCII en la terminal
```

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
    tests verdes. Terrenos extraídos a `assets/terrain/` (`bun run terrain`).
- Siguiente ciclo (ciclo 2): configuración de partida — colecciones de
  monedas (`Bag`, `Hand`, `DiscardPile`, `Reserve`), bolsas iniciales,
  colocación de las 2 fichas de dominio iniciales en las bases (y la
  clasificación de terrenos podría moverse del script al dominio como
  `BoardNode.terrain`). Estructura de directorios de la spec:
  `src/domain/`, `src/infrastructure/`, `src/shared/`, `src/server/`,
  `src/client/`.