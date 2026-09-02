# Spec del agente — Cliente TUI de War Chest 1v1 con OpenTUI

> Documento de trabajo para el agente que IMPLEMENTA el cliente de terminal.
> El QUÉ y el CÓMO se juega están en `docs/tui-design.md` (autoridad de
> diseño, estilo Final Fantasy + ASCII art). Este documento es el encargo:
> stack, arquitectura, contrato con el motor, orden, aceptación y trampas.

## 0. Objetivo

Implementar, en ESTE repositorio (Bun + TypeScript estricto), un cliente TUI
de pantalla completa para jugar War Chest 1v1 en hot-seat siguiendo
`docs/tui-design.md`: navegación 100 % por teclado (nada de escribir texto),
menú de acciones estilo batalla de Final Fantasy, cursor de casilla con
resaltado de blancos válidos, paneles de jugador (mano del rival OCCULTA),
ventanas de fase (título, draft, rondas, victoria) y arte ASCII (logo,
emblemas de facción, glifos de unidad).

## 1. Lecturas obligatorias (en este orden)

1. `AGENTS.md` — convenciones de trabajo: hooks de commit (PROHIBIDO
   `--no-verify`), commits convencionales, `check:all`, flujo de ramas/PR.
2. `docs/tui-design.md` — el diseño de UI/UX (paleta, layout, canvas del
   mapa, cursor, menú, fases, arte, límites §10, mapeo OpenTUI §9).
3. `spec.md` — las reglas del juego (el motor TS ya las implementa; este
   cliente NO decide reglas).
4. La skill `opentui` (instalada en `.agents/skills/opentui/`): cárgala con
   la herramienta de skills y lee, en este orden:
   `docs/getting-started/quickstart.mdx` (API mínima: `createCliRenderer`,
   `BoxRenderable`, `TextRenderable`, `keyInput`),
   `docs/core-concepts/renderer.mdx` (ciclo de vida, `destroy()`, eventos,
   render demand-driven vs `start()`),
   `docs/core-concepts/layout.mdx` (flexbox/yoga),
   `docs/core-concepts/keyboard.mdx`,
   `docs/keymap/overview.mdx` (`createDefaultOpenTuiKeymap()`),
   `docs/core-concepts/testing.mdx` (test renderer/snapshots),
   `docs/application-apis/animation.mdx` (máquina de escribir del mensaje).

## 2. Stack (decidido con el usuario)

- **`@opentui/react`** (bindings de React, `createRoot(renderer).render(<App/>)`),
  con **`@opentui/core`** como base (`createCliRenderer`). Instalación:
  `bun add @opentui/react @opentui/core react` (React ≥ 19.2.0 — ver
  `docs/bindings/react.mdx`).
- El **mapa hexagonal** se dibuja como texto por celda dentro de un componente
  (mismas técnicas que `render-board-terminal.ts`, con spans de color por
  celda); los componentes compuestos (`board`, `panel`, `menu`, `modal`) son
  funciones que reciben props/estado del engine-view, sin runtime extra.
- **`@opentui/keymap`** para los atajos: capas por contexto (draft / menú /
  señalar blanco / mano) y comandos con nombre. Para el cursor del tablero
  bastan los eventos `keyInput` directos del renderer.
- **tsconfig**: añadir `"jsx": "react-jsx"` y `"jsxImportSource":
  "@opentui/react"` (ver requisitos en `docs/bindings/react.mdx`).
- Requiere Bun ≥ 1.3.0 (este repo ya usa 1.3.x) y React ≥ 19.2.0. Zig NO es
  necesario: las partes nativas vienen precompiladas (ver
  `docs/getting-started/runtime-support.mdx`).

```
src/client/
  main.tsx          # entry: createCliRenderer + createRoot(renderer).render(<App/>), destroy() en todos los paths
  app.tsx           # máquina de estados de UI (modo actual, cursor, selección, migas del plan) + <App/>
  engine-view.ts    # adaptador Engine → GameStateView (única puerta al dominio; esconde mano rival) — TS puro
  hex-map.ts        # algoritmo de render del mapa (celdas de 6×1, como render-board-terminal.ts) — TS puro
  art.ts            # logo, emblemas lobo/cuervo, glifos de unidad, monedas/fichas, marcos FF — TS puro
  theme.ts          # paleta del §2 de tui-design — TS puro
  keymap.ts         # capas de @opentui/keymap (draft | menu | targeting | hand) — TS puro
  views/
    title.tsx       # pantalla de título con logo (Enter)
    draft.tsx       # parrilla de 8 cartas + cursor + descripción de la carta enfocada
    board.tsx       # mapa + cursor de casilla + resaltado contextual + leyenda
    panels.tsx      # cabecera (①) y columna derecha (③): paneles de jugador + INFO
    menu.tsx        # menú de acciones (④) con filtrado de viabilidad + sub-menús
    hand.tsx        # mano interactiva (elegir moneda con flechas) para descartes
    message.tsx     # ventana FF de mensajes con máquina de escribir
    victory.ts      # pantalla de victoria con emblema grande de la facción
  *.test.ts         # tests de helpers PUROS (hex-map, engine-view, viabilidad del menú)
```

- `engine-view.ts` produce `GameStateView` (definido en tui-design §11) con
  copias, no referencias mutables del dominio. La mano/reserva del rival van
  OCCULTAS (`handHidden: { count }`).
- La TUI importa del dominio SOLO lo necesario: `SVGBoardLoader`,
  `dealDraftCards`/`DraftSession` (draft), `configureGame`, `Game` y los
  tipos (`UnitType`, `PlayerId`, `Position`). NO mezclar con el flujo
  readline de `src/scripts/setup-draft.ts` / `play.ts`: esos scripts leen
  stdin con readline y PELARÍAN con el renderer (dos lecturas de la misma
  terminal). El draft de la TUI usa `DraftSession.pick()` directamente con
  su propio UI de cartas; el turno usa `game.startRound()/endRound()/
  retire()/nextTurn()` y las acciones según la tabla del §4.

## 4. Contrato con el motor (acciones)

La TUI emite intenciones al motor y redibuja con el snapshot devuelto:

| Intención de la UI        | Llamada al motor                               |
| ------------------------- | ---------------------------------------------- |
| Desplegar                 | `game.deploy(id, type, pos)`                   |
| Reforzar                  | `game.bolster(id, type)`                       |
| Mover                     | `game.executeManeuver(id, {kind:"move", …})`   |
| Atacar                    | `game.executeManeuver(id, {kind:"attack", …})` |
| Dominar                   | `game.executeManeuver(id, {kind:"control", …})`|
| Usar habilidad            | `game.executeManeuver(id, {kind:"ability", params})` |
| Reclamar iniciativa       | `game.claimInitiative(id, discard)`            |
| Reclutar                  | `game.recruit(id, discard, type)`              |
| Pasar                     | `game.pass(id, discard)` / `game.retire(id)` (mano vacía) |
| Maniobra gratis           | `game.executeFreeManeuver(id, req)`            |
| Inicio/fin de ronda       | `game.startRound()` / `game.endRound()`        |
| Turno                     | `game.nextTurn()` (o leer `game.currentPlayer`)|

- Tras cada intención, si `result.success === false`, el mensaje de error va
  a la ventana de mensajes (línea roja) y la UI NO cambia de turno; si es
  éxito, se re-proyecta `GameStateView` y se redibuja.
- Los eventos del resultado (`unit-destroyed`, `coin-lost`, `drawn`,
  `free-maneuver`, `victory`) alimentan el panel INFO y la ventana de
  mensajes; `winner`/`phase` = `finished` disparan la pantalla de victoria.
- El resaltado de blancos válidos puede reusar los predicados del dominio
  (`board.getNeighbors`, `areAdjacent`, `adjacentEnemies` del propio motor
  o el helper de `play.ts`) o duplicarlos de forma aislada — nunca validar
  aquí la regla: el motor es la autoridad.

## 5. UX obligatoria (no negociable, resumido de tui-design §10)

1. Cero texto tecleado en partida (ni coordenadas, ni monedas).
2. Menú de acciones SOLO con opciones viables (filtrar por mano, unidades,
   enemigos, reserva, iniciativa, `attackOnlyByAbility`… — igual que hace
   `buildOptions()` en `play.ts`, que es la referencia correcta del
   negocio).
3. Blancos con cursor de casilla + resaltado de válidas; `Esc` retrocede,
   `Tab` alterna pasos del plan (Caballería/Alférez/Mariscal), migas del
   plan sobre el mapa.
4. Una sola modal a la vez; la mano rival SIEMPRE oculta.
5. Densidad de terminal: SIN gaps entre paneles adyacentes ni padding
   decorativo (regla explícita de la skill OpenTUI); los marcos dorados FF
   dan la identidad, el aire no.

## 6. Teclado (mapa por contexto)

| Contexto    | Flechas/WASD     | Enter   | Esc        | Tab         | Letras                |
| ----------- | ---------------- | ------- | ---------- | ----------- | --------------------- |
| Título      | —                | jugar    | q = salir  | —           | —                     |
| Draft       | ←→ por tarjeta   | elegir  | (no hay vuelta atrás) | —  | —           |
| Menú        | ↑↓ fila          | rodar   | Pasar (con confirmación) | —  | D R M A C H I P (atajos) |
| Señalar     | mover cursor     | confirma | paso atrás  | alternar paso | (nada)                |
| Mano        | ←→ moneda        | confirma | cancela    | —           | (nada)                |
| Mensaje/Modal | —              | avanza/sí | no         | —           | s / n                  |

## 7. Orden de implementación y aceptación por paso

1. **Esqueleto** — `bun add @opentui/react @opentui/core react` (+ `@opentui/keymap`);
   `main.tsx` con `createCliRenderer({ exitOnCtrlC: true, backgroundColor:
   "#0d1526" })` + `createRoot(renderer).render(<App/>)` (ver quick start en
   `docs/bindings/react.mdx`), caja raíz con las 4 regiones (flexbox),
   `renderer.destroy()` en todos los paths. ✅ corre y sale limpiamente
   (terminal restaurada).
2. **Mapa** — `hex-map.ts` reusa el algoritmo de `render-board-terminal.ts`
   (37 casillas, medio-bloques, ~88 % de escala) y produce filas de spans
   coloreados; `board.ts` pinta mapa + cursor `┌┐└┘` + leyenda. ✅ unit test
   de las líneas (37 casillas visibles, coordenadas A0–G12).
3. **Paneles** — cabecera (ronda, iniciativa, turno) y columna derecha
   (fichas ▨, mano oculta del rival, reserva, INFO). ✅ proyectado desde un
   `GameStateView` construido con una partida de prueba.
4. **Menú de acciones** — filtrado de viabilidad (referencia: `buildOptions`
   de `play.ts`), cursor de fila, atajos, ayuda contextual por fila,
   sub-menús (unidades, habilidad, reclutar) y mano interactiva para
   descartes. ✅ `Esc` = Pasar con confirmación; sin opciones viables el
   menú se reduce a Pasar.
5. **Señalar blancos** — modo targeting con resaltado de válidas por acción,
   multi-paso (Caballería, Alférez, Mariscal), migas, `Tab`/`Esc`. ✅ un
   ataque y un movimiento completos sin escribir texto.
6. **Fases** — título (logo), draft (parrilla + lote "carta 1 de 2"),
   apertura/fin de ronda, victoria (emblema grande), máquina de escribir en
   mensajes (timeline de OpenTUI si está disponible; si no, `setInterval`
   corto saltable con Enter). ✅ una partida completa jugable de principio
   a fin (o hasta quedar sin monedas).
7. **Afinado** — errores del motor a la línea roja sin perder el turno;
   redimensionar (evento `resize`); menú recalcula tras cada acción.
   ✅ `bun run check:all` en verde (tsc + eslint de js + bun test).

## 8. Criterios de aceptación finales

- `bun run check:all` verde (typecheck TS 7, eslint `.js/.mjs/.cjs`, tests
  bun:test). El cliente usa TS del repo: sin typescript-eslint ni Prettier
  (no reintroducirlos).
- Tests de los helpers PUROS (`hex-map`, `engine-view`, filtrado del menú,
  proyección del draft) — sin terminal real (si se testea OpenTUI, usar su
  test renderer; nunca `createCliRenderer` en bun:test).
- Smoke manual: draft completo → ronda 1 → desplegar, mover, atacar (o
  habilidad), dominar, reclamar iniciativa, reclutar, pasar → fin de ronda
  → ronda 2. Toda la interacción por teclado, cero escritura.
- El motor NO se modifica salvo bugs de reglas (que se reportan aparte);
  el cliente solo usa API pública.
- Docs: `CHANGELOG.md`, `DECISIONS.md` y `AGENTS.md` actualizados con la
  entrada del cliente TUI (qué y por qué).
- Commit convencional (p. ej. `feat(tui): …`) SIN `--no-verify`; rama y PR
  según el flujo de `AGENTS.md` (pregunta al usuario la rama base: la PR de
  `ciclo-2-configuracion` aún está abierta).

## 9. Trampas y recomendaciones del implementador

- **Lee la skill**: los docs de OpenTUI están en `.agents/skills/opentui/
  docs/` (canonical). No uses nombres de API de memoria; usa
  `docs/reference/api-index.mdx` y `package-entrypoints` para los imports
  públicos correctos.
- **`createCliRenderer` es asíncrono**; el árbol se muta y OpenTUI programa
  el frame solo (render demand-driven). No uses `setTimeout` de bucle para
  redibujar; para animaciones usa el API de timeline; para la máquina de
  escribir, un timer corto que muta `content` está bien.
- **`renderer.destroy()` en TODOS los paths de salida** (q, Ctrl+C,
  victoria→título, errores) o la terminal queda corrupta.
- **Dos lecturas de stdin = desastre**: nada de readline/prompt en el
  cliente; el draft y los menús van con el UI de OpenTUI y `@opentui/keymap`.
- **Densidad**: la skill lo exige; los paneles FF con borde dorado pero sin
  aire muerto. El mapa ocupa ~13 filas × ~50 columnas; verifica que cabe en
  80×24 mínimo (si no, colapsa INFO a la barra de atajos — tui-design §1).
- **Glifos**: comprueba cobertura de ▀▄█▓╔╗┌┐◉⟡▨ (ANCHO-1 y renderizado en
  xterm/alacritty); si faltan, cae a los códigos de 2 letras (tui-design §8).
- **Verbosidad del plan**: las migas del modo señalar (ej.
  `Caballería: ⇒ D3 ⇢ ataca X`) deben derivar del estado de targeting, no
  hardcodearse.
- **No toques el dominio**: si encuentras un bug de reglas, apúntalo; los
  cambios de motor van en commit aparte tras confirmarlo con el usuario.
- **Skill del agente original**: ya instalada (`.agents/skills/opentui`).
  `npx skills add anomalyco/opentui --skill opentui --yes` la reinstala o
  actualiza cuando haga falta.

## 10. Decisión de stack (cerrada)

- **`@opentui/react`** (con `@opentui/core` como base y `@opentui/keymap` para
  atajos) — elegido por el usuario. No reabrir esta decisión salvo que la
  implementación encuentre un bloqueo real.