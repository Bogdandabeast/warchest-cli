# TUI — Diseño de la interfaz (estilo Final Fantasy, ASCII art)

> Especificación de UI/UX para el cliente de terminal del War Chest 1v1.
> La implementará otro agente con **OpenTUI** (`anomalyco/opentui`,
> @opentui/core + @opentui/keymap; ver §9 para el mapeo a sus primitivas).
> Este documento define QUÉ se ve y CÓMO se juega; el agente decide el CÓMO
> técnico.
>
> Principio rector: **nada de escribir acciones en diálogos de texto**. El
> jugador nunca teclea posiciones ni frases: todo se elige con el teclado
> (flechas + Enter + atajos) sobre componentes persistentes de la pantalla.
>
> Contexto de investigación: `sst/opentui` redirige a `anomalyco/opentui`.
> Es una librería TUI nativa en Zig con bindings de TypeScript que se
> desarrolla y ejecuta CONTRA BUN (requiere Bun ≥ 1.3.0; este repo usa Bun
> 1.3.x): flexbox, cajas/textos estilados celda a celda, selects/inputs/
> scroll, teclado y ratón, solapas/modales por cajas posicionadas, y emisión
> de sonido/imágenes/3D opcionales (fuera de alcance). Permite que el cliente
> viva EN ESTE REPO y llame al motor TS en el mismo proceso (§11), sin Rust.
> El agente implementador puede instalar los docs como skill:
> `npx skills add anomalyco/opentui --skill opentui`.

---

## 1. Pantalla o "escena"

El juego es una escena única de pantalla completa que cambia de *modo*.
Cuatro regiones fijas, siempre visibles (proporciones sobre el total):

```
┌────────────────────────────────────────────────────────────────────┐
│ ① CABECERA (4 filas)                                               │
│   mini-logo · ronda · iniciativa · turno · avisos de fase          │
├──────────────────────────────────┬─────────────────────────────────┤
│ ② TABLERO (canvas, 45–60%)       │ ③ COLUMNA DERECHA (25–30%)      │
│   hexágonos + unidades + cursor  │   ▷ panel LOBOS (jugador actual)│
│   + leyenda compacta             │   ▷ panel CUERVOS               │
│                                  │   ▷ panel INFO (eventos)        │
├──────────────────────────────────┴─────────────────────────────────┤
│ ④ ZONA INFERIOR (18–22%)                                           │
│   menú de acciones / sub-menús / selección de moneda               │
│   + línea de mensajes estilo ventana FF (2 filas)                  │
└────────────────────────────────────┬───────────────────────────────┘
                                     └─ barra de atajos (1 fila, tenue)
```

- Terminar con menos que ~70×24: se oculta la leyenda del mapa y el panel
  INFO pasa a pestaña tras la barra de atajos; nunca se corta el mapa.
- Toda la escena se redibuja SOLO ante eventos (estado nuevo o entrada);
  sin animaciones de bucle (ver límites en §9).

## 2. Identidad visual (estilo FF / épico)

### Paleta
| Uso | Color |
| --- | --- |
| Fondo general | azul noche profundo `#0d1526` |
| Fondo de paneles | azul marino `#12203a` con borde dorado `#c9a227` |
| Acento principal (marcos, logo, resaltes) | dorado `#ffd75e` |
| Texto normal | blanco hueso `#e8e6df` |
| Texto tenue / leyenda | gris azulado `#6e7f96` |
| Lobos (player1) | amarillo `#ffff00` (identidad existente del juego) |
| Cuervos (player2) | morado `#9696ff` (identidad existente) |
| Bases neutrales | verde `#8fff91` atenuado (identidad existente) |
| Éxito / OK | verde `#3fdd7f` |
| Error / muerte | rojo `#ff4d4d` |
| Reclutar / oro | dorado `#ffd75e` |

### Tipografía
- **Monoespaciada con glifos de bloques** (▀ ▄ █ ▓ ░ ▒ ● ◉ ◆ ▲ ▼ ═ ║ ╔ ╗ ╚ ╝
  » · …): es la que produce el "arte ASCII". Fuente monoespaciada de la
  terminal (OpenTUI pinta celdas); no usar proporcional en el mapa.
  una monoespaciada incluida (p. ej. DejaVu Sans Mono / Fira Code);
  NUNCA usar fuente proporcional en el canvas del mapa.
- Títulos en MAYÚSCULAS con letras de bloque (ver §7 arte).

### Marco de ventana de mensaje (estilo FF)
```
╔══════════════════════════════════════════════╗
║  » Ronda 3 · es el turno de los LOBOS.       ║
║  « El Cérigo roba 1 moneda y debe usarla ya. ║
╚══════════════════════════════════════════════╝
```
- La línea de mensajes de la zona ④ es SIEMPRE visible (2 filas, última
  notificación en "máquina de escribir" rápida: 1 carácter por tick de
  refresco de eventos, saltable con Enter).

## 3. Cabecera (①)

- Izquierda: mini-logo `⚔ WAR CHEST` en dorado.
- Centro: `RONDA 3` (marcos `═══ ≫ RONDA 3 ≪ ═══`), ficha de iniciativa
  (`iniciativa: CUERVOS` con el color de la facción).
- Derecha: indicador de turno alternando colores:
  `≫ TURNO: LOBOS ≪` parpadea (o subrayado animado vía estilo) SOLO en el
  cambio de turno; resto del tiempo estático.
- Fase extra (draft / fin de ronda): texto corto centrado, p. ej.
  `— DRAFT · carta 1 de 2 —`.

## 4. Tablero (②) — el corazón de la UX

### Render
- Reutilizar la geometría y el algoritmo de `render-board-terminal.ts`
  (hexágonos flat-sided, medio-bloques `▀`/`▄` por celda, ~88 % de escala):
  es la fuente de verdad visual ya validada (37 casillas, terrenos
  coloreados por identidad).
- Por casilla, en orden de prioridad:
  1. **Unidad**: glifo de facción + código de unidad + pila, p. ej.
     `L·Pi2` (Lobo-Piquero-2) o `C·GR1` (Cuervo-GuardiaReal-1). La pila ≥2
     se muestra `»` reforzada + texto dorado.
  2. **Ficha de control** (base controlada sin unidad): `▓` del color de la
     facción + nombre breve de facción.
  3. **Base neutral**: `▣` verde atenuado.
  4. **Casilla de movimiento**: `·` verde.
- Leyenda de 1 fila bajo el mapa: `L=Lobos C=Cuervos · Pi=Piquero … ·
  refuerzo=» · base controlada=▓`.

### Cursor de casilla (anti-diálogos #1)
- El cursor (marco blanco del tamaño de la celda, con esquinas `┌┐└┘`) es el
  mecanismo de blancos. Se mueve con **flechas / WASD** por la rejilla de
  13×7 celdas (A0–G12); salta/ignora celdas sin casilla (wrap al borde).
- **Resaltado contextual**: solo las casillas VÁLIDAS para el paso actual
  brillan (p. ej. atacar → los enemigos adyacentes atacables se dibujan con
  marco rojo tenue; mover → las casillas destino con marco verde tenue).
  Las inválidas se atenúan, no se ocultan (el jugador aprende dónde puede ir).
- `Enter` confirma la casilla; `Esc` vuelve al paso anterior (destino →
  unidad → menú de acciones).

### Modo "señalar" (targeting en secuencia)
- Acciones con varios blancos (Caballería `moveTo` → `attackTarget`,
  Alférez aliado → destino, Mariscal aliado → objetivo, reclutar
  descarte → tipo): al confirmar un blanco el cursor pasa al siguiente paso
  con su resaltado propio; una **migaja** arriba del mapa muestra el plan
  pendiente: `Caballería: ⇒ D3 ⇢ ataca X`. `Tab` alterna entre pasos ya
  respondidos; `Esc` retrocede uno.

## 5. Columna derecha (③)

### Paneles de jugador (dos bloques idénticos, encima el que tiene el turno)
```
┌─ ▓ LOBOS ────────────────┐        ┌─ ▓ CUERVOS ────────────────┐
│ fichas  ▨▨▨▨░░  (4/6)     │ (el activo lleva borde dorado + ▷) │
│ mano    ◉Pi ◉Aq ⟡R        │        │ mano    ◉La ◉Es            │
│ reserva Pi×3 Aq×1         │        │ reserva La×2               │
│ tablero Pi@D3(2) Aq@C1    │        │ tablero —                  │
└───────────────────────────┘        └────────────────────────────┘
```
- **Mano interactiva**: las monedas de la mano son objetos seleccionables
  cuando la acción lo pide (descartar para Pasar / Reclamar / Reclutar /
  Guardia Real). Tras activarla, las monedas se numeran `1..n` en el panel y
  se eligen con flechas + Enter; la Moneda Real se muestra `⟡` dorada y el
  menú permite descartarla.
- **Reserva** en texto (nunca se elige moneda a ciegas: el menú Reclutar ya
  filtra por reserva > 0).
- **Control markers**: los 6 huecos `▨▨▨▨░░` (ficha = ▨ del color de la
  facción).
- **Tablero**: unidades propias en el mapa (sin duplicar texto si aprieta el
  espacio: se omite esta línea y solo queda el mapa).

### Panel INFO (eventos recientes, 4–6 filas)
```
» Cuervos pasa (ronda 1).
» LOBOS domina A7.
» El Piquero de Cuervos es destruido.
```
- Último evento ARRIBA para que el jugador lo vea sin mover el ojo; se
  truncan con `…` las líneas largas. Es un REGISTRO, no un diálogo.

## 6. Zona inferior (④) — el menú de acciones (anti-diálogos #2)

### Menú principal (siempre visible durante el turno)
```
┌─ ACCIÓN ────────────────────────────────┐
│ ▸ Desplegar             (D)             │
│   Reforzar              (R)             │
│   Mover                 (M)             │
│   Atacar                (A)             │
│   Dominar               (C)             │
│   Usar habilidad        (H)             │
│   Reclamar iniciativa   (I)             │
│   Reclutar              (P)             │
│   Pasar                 (Esc·P ⏎)       │
└─────────────────────────────────────────┘
```
- Una COLUMNA, cursor de fila `▸` dorado, flechas ↑↓ + `Enter` para rodar;
  atajos de una letra; la fila enfocada muestra su **ayuda contextual** en la
  barra de tenue (p. ej. `D · coloca una unidad en una base que domines —
  necesitas 1 moneda en mano`).
- **Solo aparecen opciones viables** (como el menú de play.ts): sin moneda
  del tipo en mano, sin unidades, etc. se ocultan — el menú nunca ofrece un
  callejón sin salida. Si no hay ninguna acción posible salvo Pasar, el menú
  se reduce a `Pasar` y se avisa en la línea de mensajes.
- `Esc` EN el menú con monedas en mano = `Pasar` (tras confirmación única en
  la ventana de mensaje: `¿Pasar y salir de la ronda? s/n`). `Esc` sin
  monedas = retiro inmediato (regla de la mano vacía).

### Sub-menús (misma mecánica, misma caja)
- **Unidades**: al elegir Mover/Atacar/Dominar/Habilidad aparece `ELIGE
  UNIDAD` con las unidades del tablero (`L·Pi2 @ D3`, `L·Aq @ C1`); las que
  no pueden actuar se atenúan (sin moneda, sin enemigos, (X) sin habilidad…).
  Con 2 Infanterías, ambas aparecen listadas por posición y se distinguen.
- **Habilidad**: sub-menú con la táctica + descripción de 2 líneas
  (`H · Arquero (X) — ataca a una unidad a 2 casillas`); después el modo
  señalar del mapa. La Guardia Real exige la moneda real: se marca
  `necesita ⟡` y al confirmar se abre la mano interactiva.
- **Reclutar**: dos pasos — 1) elegir moneda a descartar (mano interactiva),
  2) elegir tipo (sub-menú solo con reserva > 0). Todo visible, cero texto.
- **Maniobra gratis / Clérigo**: ventana FF modal corta con opciones
  (`El Guerrero puede encadenar — ¿maniobra?  s · mover  a · atacar  c ·
  dominar  Esc · no`). NO es un diálogo de escritura: botones de una letra.

### Alternancia de turnos
- Tras confirmar una acción: flash dorado en el borde del panel del nuevo
  jugador, el menú se recalcula y el cursor vuelve a la fila 1. La mano del
  otro jugador se oculta a medias (`???`, solo cuenta de monedas) para no
  delatar cartas — EL PANEL DEL OPONENTE MUESTRA LA MANO TAPADA
  (`mano ◉◉⟡ (3)`): los datos de mano/reserva del rival no son información
  pública en el juego físico.

## 7. Flujo por fases (con sus artes)

### 7.1 Arranque (pantalla de título)
```
  ╔══════════════════════════════════════════════════════╗
  ║                                                      ║
  ║      ██╗   ██╗ █████╗ ██████╗      ██████╗██╗  ██╗   ║
  ║      ██║   ██║██╔══██╗██╔══██╗    ██╔════╝██║  ██║   ║
  ║      ██║   ██║███████║██████╔╝    ██║     ███████║   ║
  ║      ╚██╗ ██╔╝██╔══██║██╔══██╗    ██║     ██╔══██║   ║
  ║       ╚████╔╝ ██║  ██║██║  ██║    ╚██████╗██║  ██║   ║
  ║        ╚═══╝  ╚═╝  ╚═╝╚═╝  ╚═╝     ╚═════╝╚═╝  ╚═╝   ║
  ║                                                      ║
  ║            ≫ UNA GUERRA DE CLANES, UNA BARAJADA ≪    ║
  ║                                                      ║
  ║              [ Enter — EMPEZAR ]                     ║
  ╚══════════════════════════════════════════════════════╝
```
- `Enter` entra; `q` sale. Arte de logotipo en ASCII monocromático dorado.

### 7.2 Draft (modal de cartas)
- El tablero de fondo queda atenuado; encima un panel con las 8 cartas en
  parrilla de 2 filas × 4:
```
┌─ DRAFT ───────── carta 1 de 2 · LOBOS ─────────────────┐
│ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │
│ │ ▛════▜ │ │ ▛════▜ │ │ ▛════▜ │ │ ▛════▜ │            │
│ │ Alférez│ │ Arquero│ │Ballest.│ │Caballer│ … (4 más)   │
│ │  5 ◉   │ │ 4 ◉  ✕ │ │ 5 ◉    │ │ 4 ◉    │            │
│ │ Lobo 🜏 │ │  Flecha│ │  ✔     │ │ ✔      │ (mini-arte) │
│ └────────┘ └────────┘ └────────┘ └────────┘            │
└───────────────────────────────────────────────────────┘
```
- Cursor de tarjeta con flechas horizontales; `Enter` elige; debajo se ve la
  descripción de la carta enfocada (2 líneas) y su total de monedas. La carta
  elegida "vuela" hacia el panel del jugador (efecto simple: la tarjeta se
  pinta en el panel del color de la facción) y se repone el patrón
  1-2-2-2-1. `Esc` no cancela (no hay vuelta atrás en el draft).
- Al terminar: ventana `✦ EJÉRCITO DE LOBOS ✦` con sus 4 unidades.

### 7.3 Ronda
- Ventana FF de apertura: `≫ RONDA 1 ≪  «Todos roban 3 monedas.»` — las
  monedas robadas aparecen brevemente en cada panel (flash) y luego quedan
  en la mano.
- Fin de ronda: `≫ FIN DE LA RONDA ≪ «Se descartan las manos.»` y el recuento
  de fichas se actualiza con animación de contador (si el framework lo
  permite por estilos; si no, cambio directo).

### 7.4 Victoria
- Pantalla de desenlace con el arte de la facción ganadora (lobo o cuervo
  grande, §8), fanfarria textual:
```
      ≫ ¡LOS LOBOS VENCEN EN LA RONDA 5! ≪
```
- `Enter` → pantalla de título (nueva partida), `q` → salir.

## 8. Arte ASCII por facción y unidades

### Emblemas de facción (para título, victoria y cabecera de paneles)
- **Lobo (amarillo)`** — silueta pequeña de 9 líneas:
```
     /\      /\
    /  \____/  \
   /   /    \   \
  /__/  LOBOS  \__\
```
  (el equipo de arte define una silueta reconocible de ~9×20; aquí queda la
  plantilla de 3 piezas: cabeza, cuerpo, cola.)
- **Cuervo (morado)** — silueta de 9 líneas con pico:
```
        ,__,
       (o,o)  ...
```
- Ambas en versiones: **pequeña** (panel, 5×14) y **grande** (victoria,
  12×40, dibujada con bloques `▄█`).

### Glifos de unidad (16, uno por tipo)
- Código de 2 letras ya definido en `play.ts` + **un glifo** corto por
  arquetipo que ayuda a reconocer sin leer: alférez `⚑`, arquero `➶`,
  ballestero `➶+`, caballería `♞`, caballería ligera `♞➶`, caballero `♘`,
  clérigo `†`, espadachín `⚔`, explorador `☍`, guardia real `♛`, guerrero
  `⚔⚔`, infantería `⚔·`, lancero `↗`, mariscal `⚑⚑`, mercenario `₪`, piquero
  `↟`. Si la fuente del terminal no los tiene, se cae al código de 2 letras
  (comprobar cobertura ANCHO-1 con un mapa glifo→glyph disponible).

### Monedas
- Unidad `◉` coloreada por facción; Pila/reforzada `»`; Moneda real `⟡`
  dorada; ficha de dominio `▨` (colocada) / `▢` (disponible) / `░` (en la
  mesa del rival).

## 9. Mapeo a OpenTUI (@opentui/core) y límites asumidos

OpenTUI renderiza CELDAS de terminal con cajas flexbox y texto estilado —
el escenario ideal para este diseño (el arte ASCII y el mapa de medio-
bloques son texto con colores por celda, no píxeles). Mapeo por región:

- **Regiones ①–④**: cajas flexbox anidadas (dirección row/column, flex,
  gap, padding, border). La disposición del §1 se traduce directo:
  `column(header / row(board, right) / bottom / hotkeys)`.
- **Mapa y logo**: caja contenedora con **spans por celda** (colores RGB o
  ANSI por carácter; glifos de bloque ▀▄█▓ y cajas ═║┌┐ son celdas normales).
  El algoritmo de `render-board-terminal.ts` ya produce líneas de celdas
  listas para pintar; solo hay que convertirlas en spans estilados.
- **Menús y selección de moneda**: select/lista (estado enfocado + estilos
  de hover/focus) o cajas con `@opentui/keymap`. NUNCA input de texto.
- **Cursor de casilla**: estado interno `cursor {col,row}` + spans de marco
  `┌┐└┘` sobre la celda; flechas/WASD vía keymap; resaltado = cambiar el
  estilo de las celdas válidas.
- **Modales / ventanas de fase**: cajas posicionadas sobre el fondo
  atenuado (overlay). Máquina de escribir: el texto de la ventana de
  mensajes se actualiza por pasos (setInterval corto) o de golpe; saltable
  con Enter. Los "destellos" de turno son cambios de estilo/color
  directos (re-render reactivo); animaciones largas fuera de alcance.
- **Teclado**: `@opentui/keymap` para bindings globales y por contexto
  (menú ≠ señalar blanco ≠ draft). Ratón opcional (clic en casilla) pero no
  requerido.
- **Límites asumidos**: sin imágenes/3D/audio en la primera versión (aunque
  OpenTUI podría); sin zoom ni scroll del mapa; sin animaciones de bucle —
  el redibujado es reactivo a eventos de estado y entrada.

## 10. Límites de experiencia (UX) que NO se cruzan

1. **Nunca se teclea texto** en partida (ni coordenadas, ni monedas, ni
   frases): 100 % navegación + confirmación.
2. El menú de acciones nunca ofrece lo imposible (filtrado por estado real
   del motor: mano, unidades, enemigos, reserva, iniciativa).
3. Los blancos se dan con el cursor y resaltado de válidas — el error solo
   puede ocurrir si el estado cambió entre render y confirmación (límite
   aceptado: el motor es la autoridad y su mensaje de error va a la línea
   de mensajes en rojo).
4. Una sola ventana modal a la vez, siempre con salida `Esc` explícita; las
   ventanas nunca bloquean la vista del mapa a menos que sea obligatorio
   (draft, victoria).
5. El panel rival oculta mano (¡no es información pública en el juego
   físico!); el nuestro muestra la del jugador local.
6. Feedback < 1 refresco: cada confirmación muta el estado y redibuja la
   escena completa; el evento resultante aparece arriba del panel ③.

## 11. Datos que el cliente necesita (contrato con el motor TS)

El cliente vive en ESTE repo (Bun + TS) y llama al motor en el MISMO
proceso: carga el tablero con `SVGBoardLoader`, `configureGame` tras el
DraftSession interactivo y el `Game` directamente. NO necesita DTOs en el
ciclo local; usar DTOs (spec §3.7, `src/shared/dto.ts`) queda para el modo
remoto (server/client) posterior. Aun así, la vista debe consumir una
proyección limpia del estado para no acoplarse a las clases del dominio:

```ts
interface GameStateView {
  board: Record<Position, { terrain; controlledBy?; unit?: { type; owner; coins } }>;
  players: { player1: PlayerView; player2: PlayerView }; // playerView esconde la mano rival
  currentPlayer: PlayerId; initiative: PlayerId; round: number; phase: string;
  hand: { type /* o royal */ }[];  // solo del jugador local
  reserve: Record<UnitType, number>; markers: Record<PlayerId, number>;
  pendingFreeManeuvers: { unitType; kind }[];
  lastEvents: string[];
  winner?: PlayerId;
}
```

- El layout del §4 (celdas 6 anchas, filas 0..12) consume exactamente esto;
  el cliente no decide reglas: presenta la vista y emite intenciones al
  motor (`game.deploy(...)`, `game.executeManeuver(...)`, etc.). Para el
  resaltado de blancos válidos SÍ puede consultar al motor
  (`board.getNeighbors`, `adjacentEnemies`…) o reusar los predicados que ya
  calculan las tácticas.
- El adaptador `engine → view` es un módulo fino (`src/client/engine-view.ts`)
  que copia el estado relevante tras cada acción; la TUI se re-renderiza
  con ese snapshot reactivo.

## 12. Checklist del implementador (orden sugerido)

1. Esqueleto: proyecto Bun + `@opentui/core` (`bun add @opentui/core
   @opentui/keymap`), paleta del §2, regiones ①–④ fijas con flexbox,
   redibujo reactivo a eventos de estado.
2. Mapa como spans por celda con el algoritmo de
   `render-board-terminal.ts` + cursor de casilla + resaltado contextual
   (mover/atacar).
3. Cabecera + paneles de jugador (mano tapada al rival) + INFO.
4. Menú de acciones con filtrado de viabilidad + sub-menús (unidades,
   habilidad, reclutar) + mano interactiva para descartes, todo con
   `@opentui/keymap`.
5. Modo señalar multi-paso (Caballería, Alférez, Mariscal) con migas.
6. Ventanas de fase: título (con logo), draft, apertura/fin de ronda,
   victoria; máquina de escribir en mensajes.
7. Adaptador `engine → GameStateView` (módulo fino) en
   `src/client/engine-view.ts` + pulido de mensajes de error a la línea
   roja. Instalar la skill de docs si se quiere:
   `npx skills add anomalyco/opentui --skill opentui`.