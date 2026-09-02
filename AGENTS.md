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
```

## Estado actual y próximos pasos

- Hecho:
  - Proyecto inicializado (bun init), spec.md presente.
  - `warchest_playmat_1v1.svg` generado y validado (XML válido, 47 hexágonos).
  - Repositorio remoto creado (`warchest-cli`, público) y flujo GitHub Flow
    documentado aquí.
- Siguiente ciclo (ciclo 1): implementar el tablero del juego leyendo
  `warchest_playmat_1v1.svg` — nodos, adyacencias por distancia entre centros
  (espaciado de rejilla ~257.7 px), IDs tipo `A0`–`G12` (columna letra, fila
  número), y las 4 bases marcadas como localizaciones de inicio. Seguir la
  estructura de directorios de la spec: `src/domain/`, `src/infrastructure/`,
  `src/shared/`, `src/server/`, `src/client/`.