# Decisiones de diseño

## Unreleased — Cliente TUI (2026-09-02)

- **Resalte de las tropas jugables en el tablero** (pedido del usuario:
  accesibilidad — distinguir de un vistazo qué tropas se pueden usar): el
  tablero en modo `coin`/`action` resalta con halo de acento + chip de apodo
  `✦` las unidades propias jugables (tipo en la mano / moneda elegida). Se
  usa el halo exterior (`ring`) que ya existía para la selección, no se
  oscurece el resto del tablero: lo jugable brilla y lo demás conserva su
  color real, para no perder de vista el estado completo del campo (a
  diferencia del modo de señalamiento, donde sí se oscurece).

- **El descarte muestra la orientación real de cada moneda** (pedido del
  usuario: distinguir boca arriba de boca abajo): `DiscardPile` guarda la
  orientación (`addFaceUp`/`addFaceDown`) que decide el motor — maniobras
  boca arriba (la tropa actúa y se ve la cara), pasar/reclamar/reclutar y
  la moneda Real boca abajo (el token Real no controla ninguna tropa). En
  la `DiscardView` una moneda boca abajo se dibuja con la ficha de control
  en miniatura y una boca arriba con su PNG. Se sigue mostrando el descarte
  de AMBOS jugadores (hot-seat comparte pantalla).
- **Registro de eventos con la facción protagonista** (pedido del usuario:
  "cuervos han desplegado…, lobos han atacado…"): los mensajes del motor
  hablan de `player1/player2`; `log.ts` los traduce a facciones y etiqueta
  cada línea con la facción que la protagoniza (color en la UI). El actor de
  la acción etiqueta el mensaje principal; cada evento del resultado lleva
  su propia facción.
- **El asistente de tácticas no ofrece acciones que el motor rechaza**
  (bug Lancero): la embestida contra un Caballero sin reforzar es ilegal en
  el motor, pero el asistente la ofrecía y la carga fallaba silenciosamente
  ("solo se movió"). Regla: una táctica solo se ofrece si existe al menos
  una secuencia completa de pasos VÁLIDA en el motor — el Lancero (y la
  Caballería) filtran los blancos que son Caballero sin atacante reforzado.

- **El descarte se ve boca arriba para AMBOS jugadores** (pedido del
  usuario: "zona de descarte de cada jugador donde se pueden ver las monedas
  que se han jugado"): aunque en el juego físico los descartes boca abajo son
  privados, en hot-seat ambos comparten pantalla y el usuario quiere ver las
  monedas jugadas. `PlayerView.discard` proyecta las monedas de cada jugador
  en orden; la `DiscardView` las muestra como caras (PNG pequeño / ⟡ real),
  con las más recientes primero. Si en el futuro se quiere ocultar el del
  rival, basta con proyectar solo el propio.
- **La zona de descarte vive en la pantalla principal de partida** (entre el
  tablero y la mano/menú): el tablero nativo cede filas (`RESERVED_ROWS`
  12 → 18) para que el descarte no se solape con la mano; en los modos de
  señalamiento (targeting/tácticas/maniobras gratis) no se muestra para no
  encoger el tablero durante la elección de blancos.

- **Toda elección de casilla/unidad usa la selección sobre el tablero**
  (pedido del usuario: "piensa en qué más casos puede ser útil"): el modo
  oscurecido + brillo + cursor ← → cubre atacar (pie con el apodo de la
  unidad bajo el cursor: `▶ B10 · Piquero`), desplegar/mover/dominar,
  maniobras gratis (paso de blanco Y paso de concesión, que resalta la
  unidad que puede actuar), y TODOS los pasos posicionales del asistente de
  tácticas (Alférez/Mariscal "con quién", Arquero/Ballestero/Lancero a
  distancia, Caballería, Caballería ligera, Guardia Real, blancos de
  Infantería). Solo quedan como menú de texto las elecciones NO posicionales
  (qué maniobra hace la Infantería, tipo de la reserva al reclutar, de dónde
  quita la moneda la Guardia Real).

- **Las tácticas con blancos de casilla se eligen sobre el tablero** (pedido
  del usuario: "una selección parecida" a desplegar/mover para Caballería,
  Caballería ligera y Lancero — cualquier táctica que mueve): si TODAS las
  opciones del paso actual del asistente son posiciones (`abilityStepPositions`
  ≠ `null`), la TUI reutiliza `TargetingView` (tablero oscurecido + casillas
  válidas brillando + cursor ← →) con el título del paso en vez del menú de
  texto. Los pasos con opciones no-posicionales (Infantería: maniobra/omitir/
  ejecutar) siguen con el menú. Esc mantiene su semántica (quitar token),
  solo cambia el render del paso.

- **El tablero se espeja verticalmente según el jugador actual** (pedido del
  usuario: "invierte el tablero para que el jugador rival esté arriba
  siempre"): en hot-seat ambos comparten pantalla, así que la perspectiva
  rota al jugador que actúa — cuando juega player1 (amarillo, que el SVG
  dibuja arriba) se hace flip en Y; cuando juega player2 no hace falta
  (morado ya abajo). Resultado: tus bases SIEMPRE abajo, el rival arriba, en
  partida y en los modos de señalamiento. El flip se aplica en la misma
  construcción del layout (`hexBoardLayout(cols, rows, flip)`), espejando
  muestras, anillo de selección y centros, así todo el overlay lo hereda.
- **Pantalla de cambio de turno / revelación con la ficha de control**
  (pedido del usuario): entre turnos se muestra la ficha blanca/negra en
  grande (Lobos/Cuervos) y "TURNO DE …"; Enter continúa. Oculta el tablero
  para que el siguiente jugador no vea el estado del rival antes de su turno
  (privacidad hot-seat). Se muestra tras cada acción exitosa, pase,
  retirada, cierre de ronda y al iniciar la partida tras el draft.
- **Apodo de la unidad bajo la moneda en el tablero** (pedido del usuario):
  nombres cortos y legibles (los de dos palabras se reducen a una;
  `UNIT_NICKNAME` en `art.ts`) en una etiqueta con fondo de mesa debajo de
  la moneda, independiente de que el PNG esté cargado. Se prioriza legibilidad
  sobre ortografía completa (nickname de juego, p. ej. `CabLig.`).
- **Todas las tropas tienen PNG propio** (pedido del usuario): el usuario
  añadió `explorador.png` y `ballestero.png`, así que ninguna unidad usa
  placeholder; el caballero ya no se comparte por caché.
- **El draft muestra las elegidas de ambos jugadores en grande**: panel por
  facción bajo la cabecera con el PNG de cada tropa ya escogida (+ apodo) y
  ▶ en la facción activa. La altura del panel se descuenta del área de
  cartas para que todo quepa en el terminal.

- **El tablero de la partida vuelve a ser render nativo, no PNG** (pedido del
  usuario: "igual que cuando corro `bun run render`"): el PNG del playmat
  (que OpenTUI muestra como bloques Unicode o Kitty/Sixel según la terminal)
  se queda SOLO para la vista previa de resoluciones; el tablero de juego
  dibuja las casillas como hexágonos de color con medio-bloques `▀`, con la
  misma geometría, contracción (0.88) y paleta que
  `render-board-terminal.ts`. La escala es uniforme (proporción real, sin
  estirar) y el lienzo llena el área disponible: filas = terminal − 12
  (mano/menú, cabecera y ayudas), ancho = filas × 2 × 1632/1802 recortado a
  la terminal. El usuario eligió casillas GRANDES llenando el área, no los
  márgenes laterales del SVG completo.
- **Las monedas siguen siendo la imagen del caballero encima de los
  hexágonos** (decisión del usuario: "hexágonos coloreados + monedas PNG
  encima"): diámetro = círculo inscrito en el hexágono (√3·r2 ≈ 205 px SVG,
  ancho par → media altura = redonda 1:1), para que la moneda llene la
  casilla sin invadir las vecinas. Mientras la imagen no está lista se
  muestra el marcador de texto (L/C + glifo ×pila) en el centro.
- **La geometría vive en `src/client/hex-board.ts` y se cachea por tamaño**;
  el SVG se lee UNA vez por módulo vía `node:fs/promises` (no `readFileSync`
  de `node:fs`, que los tests de `build-board-from-terrain` mockean a nivel
  de proceso y romperían el render).
- `BoardView` (juego, reclutar, señalamiento) usa `HexBoardView`;
  `ImageBoardView` (PNG 80×33) se mueve a `views/board-image.tsx` solo para
  la vista previa de resoluciones.

- Se confirma que cada ronda roba hasta 3 monedas por jugador. Si la bolsa se
  queda corta, se recicla y baraja el descarte inmediatamente para completar
  el robo; cuando no queda ninguna moneda, se continúa con las disponibles.

- La UX se simplifica a una secuencia de divulgación progresiva: tablero
  grande → selección de una de las tres monedas → acciones válidas para esa
  moneda → confirmación. `Esc` retrocede un nivel para poder cambiar de
  moneda; no se presentan paneles completos ni acciones irrelevantes de golpe.
- El tablero es la región dominante de la pantalla: los símbolos de terreno,
  control y tropas se dibujan dentro de cada celda. Se mantienen fuera del
  tablero solo las monedas y las acciones guiadas.
- **El tablero del juego es un único PNG del playmat** (`assets/board/
  board-1v1.png`, `bun run board-png`): se rasteriza el board compuesto con
  `@resvg/resvg-js` recortando el viewBox a la región de las 37 casillas
  (984 149 1632 1802) al doble de resolución, manteniendo el arte real de
  las bases (lobos y cuervos) y las líneas de hexágono. El cliente dibuja la
  imagen con `fit="fill"` en `BOARD_CANVAS` (40×22 celdas) y superpone
  fichas (blanca/negra), id de base neutral, unidades, cursor y objetivos en
  `hexCenter` — proyección lineal exacta SVG→celdas del reticulado (col A
  x=1130.42, paso 223.19; fila 0 y=276.84, paso 128.86). Sustituye al
  render de tiles sueltos (`casilla.png`), que queda solo como fallback de
  carga; la geometría se extrae del propio SVG, no aproximada a mano.
- Se añade `@resvg/resvg-js` como devDependency solo para el script de
  assets (`board-png`); el runtime del cliente sigue sin dependencias nuevas.
- **El tablero se agrandó a 80×33 celdas** (100 % más ancho y 50 % más
  alto respecto a 40×22, pedido del usuario). La proyección SVG→celdas es
  lineal e independiente del tamaño, así que solo cambia `BOARD_CANVAS`;
  los overlays se escalan solos.
- **Todas las monedas usan la imagen del caballero** (decisión del usuario
  mientras no haya arte por entidad): en el tablero las unidades son
  MONEDAS de tamaño = hexágono 1:1 (`hexSize()`: misma escala que la
  casilla), y en la mano tropas y moneda real muestran la misma moneda. El
  marcador de pila y facción (L/C ×N) se sobreescribe sobre la moneda para
  conservar la info de juego. Se dejó `coinImageFor(type)` como punto de
  extensión para imágenes por entidad futuras.
- **`protocol="auto"` en todos los `<image>`**: el mismo protocol efectivo en
  todas las imágenes solapadas (requisito de OpenTUI) y degradación a bloques
  Unicode cuando no hay Kitty/Sixel. Un solo cargador
  (`board-images.ts`) comparte las 3 NativeImage entre todos los tiles;
  si alguna falla, `BoardView` cae al mapa de píxeles ASCII anterior
  (que se mantiene como fallback y está cubierto por tests).

- Se adopta `@opentui/react` sobre `@opentui/core`, con React 19 y
  `@opentui/keymap` disponible para las capas de atajos. La TUI se ejecuta en
  el mismo proceso Bun que `Game`; no usa transporte ni un segundo lector de
  stdin.
- `src/client/engine-view.ts` es la única frontera hacia el dominio: produce
  snapshots copiados y oculta completamente las monedas de la mano y reserva
  del rival. Los helpers de mapa y menú son funciones puras y tienen pruebas
  unitarias sin terminal real.
- La primera entrega mantiene la pantalla densa y los cuatro bloques FF
  siempre visibles; las acciones viables se calculan desde el snapshot y los
  errores del motor se muestran como mensajes, sin mutar reglas en la capa de
  cliente. Las acciones que requieren blancos complejos quedan preparadas para
  el modo de señalamiento con cursor del siguiente afinado.

## v0.3.1 — Rondas, reglas finales y partida jugable (2026-09-02)

- **El Clérigo "roba y usa de inmediato" se implementa reteniendo el turno**:
  tras Atacar/Dominar con éxito, roba 1 moneda de la bolsa a la mano (evento
  `drawn`) y la UI lo deja actuar otra vez antes de pasar el turno al rival.
  Como las monedas de la mano son fungibles, no se persigue "gastar ESA
  moneda" (imposible de rastrear fielmente); la simplificación es que el
  jugador no pierde el turno y debe jugar la siguiente acción con la mano
  aumentada.
- **El Guerrero encadena pagando monedas de su propia pila**: cada maniobra
  encadenada (`FreeManeuverKind "guerrero"`) quita UNA moneda de la pila del
  Guerrero (sale del juego, como en un ataque) y nunca la última (se necesita
  pila ≥ 2). La concesión NO se consume al usarla: queda disponible mientras
  el Guerrero tenga monedas, así puede encadenar indefinidamente. Si cae en
  una maniobra encadenada (p. ej. contra el Piquero), la cadena termina.
- **Las concesiones free-maneuver ya no son solo eventos**: v0.3.0 dejaba
  `free-maneuver` para el ciclo de rondas; ahora `Game` tiene una **cola real**
  (`grantFreeManeuver`/`executeFreeManeuver`) que el flujo de turnos ejecuta
  sin gastar moneda (Espadachín solo mueve; Mercenario/Guerrero hacen
  mover/atacar/dominar). Las concesiones de unidades que salen del tablero se
  limpian (`pruneFreeManeuvers`, eventos `unit-destroyed` y fallos de
  re-localización).
- **Caballería y Lancero se prevalidan antes de moverse**: sus tácticas
  exigen objetivo de ataque (la Caballería no vale solo para moverse) y
  comprueban la regla del Caballero (solo atacable por unidades reforzadas)
  ANTES de mover, porque `resolveAttack` la rechaza después y mutaría el
  tablero sin gastar moneda — una acción fallida no puede cambiar el estado.
- **El Ballestero ataca a la primera unidad en línea recta** (corrección del
  usuario): si la casilla intermedia está ocupada, esa es el objetivo, no la
  de detrás. La especificación inicial ("intermedia libre o falla") era
  incorrecta.
- **Flujo de rondas como máquina de fases en `Game`** (spec §3.5
  simplificada): `phase setup → playing → round-over → finished` y `passed`
  por jugador. `startRound` roba 3 a ambos y fija la iniciativa (la reclamada
  se aplica a la ronda siguiente); `pass` marca fuera de ronda; `retire` es el
  pase sin descarte cuando la mano queda vacía (spec §4.2.3); `endRound`
  descarta las manos. El robo con bolsa/descarte vacíos recicla el descarte
  (`Player.drawCoins`), así que las rondas pueden continuar indefinidamente
  mientras queden monedas en circulación.
- **Partida jugable en hot-seat**: `bun run play` es para DOS jugadores en la
  misma terminal (sin IA). El render por turno es un **mapa ASCII** de celdas
  `A0`–`G12` (facciones, unidades y pilas) en vez del render SVG de
  `bun run render` (que no muestra unidades); los blancos de cada acción se
  ofrecen como **listas de opciones válidas** para no escribir coordenadas a
  ciegas. La cola free-maneuver se muestra antes de pasar el turno.
- **Ajustes de la revisión de código (CodeRabbit)**: la táctica de la
  Infantería es **atómica** (todas las maniobras se validan antes de aplicar
  ninguna: sin efectos parciales ni moneda gastada si algo falla) y comparte la
  colocación de fichas con la acción Dominar (`Game.controlLocation`), así el
  dominio con Infantería también detecta la victoria. `Unit` encapsula la pila
  (solo lectura, validada) y su `id` es por INSTANCIA (las dos Infanterías del
  mismo jugador se distinguen; no deriva de la posición). `RandomSource` se
  valida en [0, 1) en `Bag.draw` y `shuffle` (un 1 devolvía índices fuera de
  rango); la reserva rechaza la moneda real por cualquier vía; `configureGame`
  valida las bases de ambos jugadores antes de colocar fichas; y los eventos
  diferencian `coin-lost` (pila dañada) de `unit-destroyed` (unidad fuera).

## v0.3.0 — Ciclo 2: Configuración de partida (2026-09-02)

- **El tablero de juego sale de `assets/board/board-1v1.svg`, no de los
  playmats** (decisión explícita del usuario): el board compuesto por
  `build-board-from-terrain.ts` es la fuente de verdad del dominio. El
  `SVGBoardLoader` lo lee, clasifica terrenos (color + marcador interior),
  toma los ids de rejilla de los `cell-*` y recalcula la adyacencia por
  geometría. Los playmats quedan solo como insumos de los scripts de assets.
  (En mitad del ciclo el usuario borró los playmats del working tree; se
  restauraron desde git porque los scripts de assets y sus tests los
  necesitan.)
- **Terreno en el dominio**: el tipo `Terrain` y sus helpers viven en
  `src/domain/terrain.ts` (`BoardNode.terrain`, default `normal`). La
  *clasificación* (qué color del SVG + marcador interior → qué terreno)
  sigue en infraestructura (depende del arte); el *tipo* es dominio. La base
  de inicio se deriva del terreno (`startZoneOf`), eliminando el flag
  `startZone` del ciclo 1.
- **Solo las bases son localizaciones**: las 27 casillas verdes normales son
  de movimiento puro; los 10 terrenos de base (6 neutrales + 2 de cada
  jugador) son localizaciones: reciben fichas de dominio y despliegues. Esto
  matiza la spec: “localización” no es cualquier celda, sino una base.
- **Una ficha de dominio por localización** (regla real): conquistar = el
  `addControlMarker` reemplaza la ficha enemiga y devuelve la suya a su
  dueño; no puede haber dos fichas en la misma base. La spec habla de
  `controlMarkers: number`; aquí se modela con dueño único (1 ficha por
  ubicación), más simple y fiel al juego físico.
- **La moneda real entra en la bolsa** (decisión del usuario): es un objeto
  `RoyalCoin` dentro de las colecciones (`Bag`/`Hand`/`DiscardPile`); al
  robarse solo sirve para descartes boca abajo (reclamar iniciativa, reclutar,
  pasar) o la táctica de la Guardia Real. Nunca está en la reserva. Esto
  difiere de la nota de la spec (flag `royalCoin` en `Player`), que se
  descartó para usar el modelo OOP de monedas aprobado.
- **Jerarquía de monedas OOP** (aprobada): `Coin` abstracta → `UnitCoin(tipo)`
  y `RoyalCoin`. `Hand.play`/`playRoyal` consumen; las colecciones guardan
  instancias, así el robo al azar puede sacar la real.
- **Draft primero, bolsas después** (regla real + usuario): el draft elige los
  EJÉRCITOS (4 unidades por jugador, patrón 1-2-2-2-1 sobre 8 cartas
  repartidas); solo al terminar se montan las bolsas (moneda real + 2 por
  tipo) y las reservas (total − 2 por tipo). `DraftSession` valida turno,
  disponibilidad y repetición con un generador aleatorio inyectable.
- **Iniciativa al segundo en elegir** (spec §4.1.4): en 1v1 player1 (Lobos)
  elige primero y player2 (Cuervos) recibe la iniciativa de la primera ronda.
- **Fichas de dominio iniciales**: 6 por jugador, 2 colocadas al inicio sobre
  sus bases (C1/F2 para Lobos, B10/E11 para Cuervos); las bases empiezan
  VACÍAS de tropas. El robo de 3 monedas por ronda queda para el ciclo de
  rondas (spec §4.2).
- **Regla del ataque**: la moneda de arriba de la pila objetivo sale del
  juego (a la caja), no vuelve a reserva ni a descarte (regla real
  confirmada; la spec §4.4 decía “a la reserva” y se corrigió).
- **Restricciones (X) e innatas (I)**: `ATTACK_ONLY_BY_ABILITY` y
  `INNATE_ABILITY_UNITS` en `units.ts`; el Caballero solo es atacable por
  unidades reforzadas (2+), el Piquero contraataca en el mismo instante
  (incluso si muere) y la Guardia Real puede sacrificar moneda de reserva.
  El encadenado de Espadachín/Mercenario/Guerrero/Clérigo se implementó en
  v0.3.1 (cola real de maniobras gratis; ver arriba).
- **Monedas por unidad (tabla del usuario)**: `UNIT_TOTAL_COINS` con los
  totales reales por tipo (Alférez 5, Arquero 4, Ballestero 5, Caballería 4,
  Caballería ligera 5, Caballero 4, Clérigo 4, Espadachín 5, Explorador 5,
  Guardia Real 5, Guerrero 5, Infantería 5, Lancero 4, Mariscal 5, Mercenario
  5, Piquero 4); 2 a la bolsa, el resto a la reserva.
- **El flujo de rondas/turnos entró en v0.3.1** (spec §3.5 / §4.2):
  alternancia, robo de 3, fin de ronda con descarte de manos, iniciativa
  reclamada para la ronda siguiente y encadenado de maniobras gratis — ver
  la sección v0.3.1 de este documento. En v0.3.0 quedó el `Game` con las 9
  acciones validadas y el estado que el flujo consume (jugador actual,
  iniciativa, ronda); las tácticas de unidades con solo atributos (I) no son
  accionables (se avisa al llamar `ability` sin táctica).

## v0.2.0 — Herramientas de desarrollo (2026-09-02)

- **TypeScript 7.0.2 (última versión) como compilador** y **typescript-eslint
  retirado del toolchain**: la 7 es el compilador nativo nuevo y no trae API
  JS, así que typescript-eslint (que la necesita) no la soporta aún (peer
  `<6.1.0`). Se probó el setup oficial de compatibilidad (alias
  `typescript → @typescript/typescript6` + `@typescript/native` para el bin
  `tsc` + postinstall para un bug de hoisting de Bun con el shim circular),
  pero el usuario prefirió simplificar: **quitar typescript-eslint**. Queda
  `typescript@^7.0.2` como devDependency única, sin aliases ni parches.
  La calidad del `.ts` se garantiza con `tsc --noEmit` (tipos, TS 7) y
  `bun test`; no hay lint de TS.
- **ESLint queda solo para `.js/.mjs/.cjs`** (config del proyecto y scripts):
  ESLint 10 no tiene parser nativo de TypeScript (ver discusión
  eslint/eslint#18830) y sin typescript-eslint no puede parsear `.ts`
  (daría errores de parseo en cada archivo). `eslint .` aplica `@eslint/js`
  recomendado + globals de Node + **ESLint Stylistic** (`@stylistic/eslint-
  plugin`, preset `customize` estilo-Prettier: indent 2, comillas dobles,
  semi, 1tbs, trailing commas, max-len 110). Prettier sigue desinstalado.
  El formato de los `.ts` queda a cargo del editor/manual (sin linter).
- **Tsconfig**: se mantiene `"types": ["bun"]` (necesario tanto en TS 6
  como en TS 7, donde `types` por defecto es `[]`).
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