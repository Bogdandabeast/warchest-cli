# Changelog

## Unreleased — Ciclo 3: cliente TUI

- **Se resaltan las tropas que el jugador PUEDE jugar este turno** (pedido
  del usuario: "no se distinguen bien las tropas que podemos hacer"): en la
  pantalla de elegir moneda (`coin`) el tablero marca con un halo de acento
  alrededor del hexágono y un chip de apodo en color de acento con `✦` todas
  las unidades propias cuyo tipo está en la mano; al pasar al menú de
  acciones (`action`) el resalte se estrecha a la moneda elegida. El resto
  de tropas (propias no jugables y enemigas) queda con su aspecto normal,
  sin confundirse con las jugables. Nuevo prop `playableTypes` en
  `BoardView`/`HexBoardView`; fuera del señalamiento se recalcula el tablero
  con `hexLineRuns` para pintar el halo (y un ligero brillo en la casilla).

- **Registro de eventos de la partida** (pedido del usuario: "cuervos han
  desplegado un arquero, lobos han atacado al arquero…"): nuevo
  `src/client/log.ts` + `LogView` — cada acción con éxito y cada evento del
  motor (destrucción, moneda perdida, robo, victoria…) se etiqueta con su
  facción y se muestra como una línea coloreada (`LOBOS: Lancero ataca a
  Caballería.`). Los mensajes del motor se limpian (ids → facción, se quita
  el dueño redundante, se recortan a 90 caracteres). Se abre con la tecla
  **L** durante la partida.
- **El descarte distingue boca arriba / boca abajo** (pedido del usuario):
  - `DiscardPile` registra la orientación de cada moneda (`addFaceUp` /
    `addFaceDown`; las lecturas de la colección siguen igual). El motor
    descarta boca ARRIBA las maniobras (mover/atacar/dominar), boca ABAJO
    pasar, reclamar iniciativa, reclutar y la moneda Real — el token Real
    nunca controla tropa, así que siempre boca abajo (igual que la Guardia
    Real cuando paga la moneda Real).
  - `PlayerView.discard` proyecta la orientación y `DiscardView` pinta cada
    moneda con su PNG (cara) o con la ficha de control en miniatura
    (`controltokenwhite/black.png`) si está boca abajo; la moneda Real
    boca abajo usa también su token. Contadores intactos.
- **Bug Lancero en la TUI — el asistente ofrecía embestidas imposibles**
  (reportado: "no ha matado al enemigo que tenía delante, solo se ha
  movido"): verificado por fuerza bruta que el motor embiste y mata
  correctamente en TODA casilla ofrecida — el problema es que el asistente
  ofrecía cargar contra un **Caballero sin reforzar** (regla: un Lancero no
  reforzado no puede atacar a un Caballero), la carga se rechazaba en el
  motor y parecía "solo moverse". Ahora el asistente (y la viabilidad del
  menú) filtra esas cargas y no las ofrece. El bug visual de la carga
  rechazada también desaparece.

- **Zona de descarte por jugador** (pedido del usuario: ver las monedas que
  se han jugado al pasar de turno). El motor ya descartaba boca abajo al
  pasar (`Game.pass` → `discardFaceDown`); ahora la TUI lo muestra:
  - `engine-view` proyecta el descarte de AMBOS jugadores boca arriba
    (`PlayerView.discard`, en orden de juego, la última la más reciente).
  - Nueva `DiscardView` en la pantalla de partida (entre el tablero y la
    mano/menú): dos columnas (LOBOS/CUERVOS) con el contador de monedas
    jugadas y cada moneda como su PNG en pequeño (glifo mientras carga; ⟡
    para la moneda Real), las más recientes primero (máx. 12 visibles + "+n").
  - El lienzo del tablero reserva filas para la zona (`RESERVED_ROWS` 12 → 18).

- **La selección sobre el tablero llega a los casos restantes** (pedido del
  usuario: atacar, Alférez/Mariscal, Arquero/Ballestero a distancia, etc.):
  - Al **atacar** (o apuntar con Arquero/Ballestero/Lancero/Infantería) el
    pie de la selección muestra ahora a QUIÉN apuntas: `▶ B10 · Piquero`
    (el apodo de la unidad bajo el cursor; las casillas vacías no añaden
    nombre).
  - La pantalla de **maniobras gratis** (Mercenario/Espadachín/Guerrero)
    resalta sobre el tablero oscurecido la UNIDAD que puede actuar al
    recorrer las concesiones con ← →, igual que el resto de selecciones.
  - Alférez/Mariscal (con quién usar la habilidad), Arquero/Ballestero
    (blanco a distancia), Caballería, Caballería ligera, Lancero, Guardia
    Real y los blancos de la Infantería ya se elegían sobre el tablero
    (paso anterior); con esto TODA elección de casilla/unidad de la TUI usa
    el modo oscurecido + brillo + cursor.

- **Las tácticas que mueven se eligen SOBRE EL TABLERO** (pedido del
  usuario: una selección como la de desplegar/mover para Caballería,
  Caballería ligera, Lancero y demás): cuando el paso del asistente de
  tácticas solo pide blancos de casilla, la TUI muestra el tablero oscurecido
  con esas casillas brillando y el cursor saltando con ← → (Enter confirma,
  Esc retrocede token a token) en lugar de la lista de texto. Aplica a
  Caballería (casilla de carga + objetivo de la carga), Caballería ligera
  (destino a ≤2 en cualquier dirección), Lancero (embestida en línea recta a
  2-3), Alférez, Arquero, Ballestero, Guardia Real, Mariscal e Infantería
  (blanco de la maniobra). Los pasos no-posicionales (qué maniobra hace la
  Infantería, omitir/ejecutar) conservan el menú de texto. Nuevo helper
  `abilityStepPositions` (devuelve las casillas o `null`) y prop `title` en
  `TargetingView` para mostrar el paso sin perder el contexto.

- **El tablero se invierte para jugar siempre desde tu perspectiva** (pedido
  del usuario: "el jugador rival arriba siempre"): `hexBoardLayout` acepta un
  `flip` vertical (muestras, anillo y centros espejados en Y) y `BoardView`
  lo activa cuando juega player1 — las bases del jugador actual quedan
  SIEMPRE abajo y las del rival arriba, en partida y en señalamiento.
- **Pantalla de cambio de turno / revelación** (pedido del usuario): entre
  turnos (fin de acción, pase/retirada, cierre de ronda e inicio de partida)
  la app muestra `TurnView` — la ficha de control EN GRANDE (`
  controltokenwhite.png` para Lobos, `controltokenblack.png` para Cuervos)
  con la ronda, el marcador de iniciativa y "TURNO DE …"; Enter pasa a la
  elección de moneda. El tablero queda oculto, dando privacidad en hot-seat.
- **El draft muestra EN GRANDE las tropas ya elegidas** (pedido del
  usuario): `DraftView` recibe las cartas elegidas de ambos jugadores y, bajo
  la cabecera, pinta un panel por facción con el PNG de cada tropa ya
  escogida (con su apodo debajo) y ▶ en la facción que está eligiendo.
- **Apodo de cada unidad debajo de su moneda en el tablero** (pedido del
  usuario): las unidades desplegadas muestran un nombre corto y legible
  (los de dos palabras se reducen a una: `Guardia Real → Guardia`,
  `Caballería ligera → CabLig.`; los largos se recortan: `Explorador →
  Explora`) en una etiqueta con fondo de mesa bajo la moneda, siempre
  visible aunque no haya imagen cargada.
- **`explorador.png` y `ballestero.png` ya existen y se usan** (pedido del
  usuario): las 16 tropas tienen SU PNG propio en `assets/troops/` — se
  conectan en `troop-images.ts`, el tablero, la mano, el draft y la galería.
  Ninguna tropa usa ya placeholder de caballero (tests y textos actualizados).

- **La TUI implementa TODAS las mecánicas del motor** (revisión de paridad
  mecánica dominio → TUI). Tres huecos detectados y cerrados:
  1. **Tácticas ("Usar habilidad")**: el menú ofrecía la acción para las 9
     unidades activables pero `app.tsx` nunca la ejecutaba (error genérico).
     Nuevo `src/client/ability-flow.ts`: asistente guiado por pasos (← → +
     Enter, Esc retrocede token a token) que construye la `AbilityRequest` de
     cada táctica — Alférez (aliado→destino), Arquero (blanco a exactamente 2),
     Ballestero (línea recta), Caballería (carga→objetivo), Caballería ligera
     (≤2), Guardia Real (localización propia a ≤2, paga la moneda Real),
     Infantería (una maniobra por Infantería, atómico, con saltos), Lancero
     (embestida 2-3 con camino libre) y Mariscal (aliado→objetivo) — igual que
     `bun run play`.
  2. **Retirarse**: con la mano vacía la única jugada legal es retirarse
     (pase sin descarte) y la TUI no ofrecía la acción. `MenuAction` gana
     `retire`, `viableActions` la ofrece solo con la mano vacía y
     `executeAction` la ejecuta con el mismo cierre de ronda que Pasar.
  3. **Bolster ofrecido sin moneda** (bug de viabilidad): `viableActions`
     mostraba "Reforzar" con la unidad en el tablero aunque la moneda ya
     estuviera gastada; ahora exige también la moneda del tipo en la mano.
- **El menú solo muestra acciones EJECUTABLES ahora** (bug reportado: aparecía
  "Usar habilidad" del Lancero sin ningún blanco válido). `viableActions`
  recibe el `Game` y, para cada táctica, comprueba con el asistente que exista
  AL MENOS una secuencia completa de pasos (línea recta/2 casillas exactas de
  Arquero/alcance del Caballero ligero/localización dominada del Guardia…),
  que la moneda del tipo esté en la mano (o la moneda Real en la Guardia Real)
  antes de ofrecer la acción. Además **Atacar** ya no se ofrece contra un
  Caballero sin atacante reforzado (2+ monedas), tanto en el menú como en la
  lista de objetivos (`targetPositions`); con la mano vacía la pantalla de
  acciones muestra **Retirarse** en vez de quedarse en blanco.
- **Pruebas TUI automatizadas por mecánica**: `ability-flow.test.ts` (10 tests:
  pasos y peticiones de las 9 tácticas + saltos de Infantería) y
  `mechanics-flow.test.ts` (7 tests por acción con partida real: desplegar,
  reforzar, ataque solo-por-habilidad vs normal, iniciativa, reclutar,
  dominio/victoria y pase/retirada/cierre de ronda con robo).

- **Imágenes de las tropas dentro del juego, tal cual (sin transformaciones)**
  (pedido del usuario): nuevo `src/client/troop-images.ts` mapea cada tipo de
  unidad a su PNG de `assets/troops/` (una imagen por tropa; las 16 tienen
  PNG propio, incl. ballestero y explorador). El tablero de la partida y la
  vista PNG (`BoardView`/`ImageBoardView`) dibujan el PNG de CADA unidad
  sobre su hexágono (tamaño casilla 1:1); la mano muestra el PNG de cada
  tropa (la moneda Real, que no es una tropa, se muestra solo con su símbolo
  ⟡, sin imagen); el draft sustituye el ASCII art por el PNG de la tropa en
  cada carta (tamaño adaptado al ancho/alto reales del terminal). La galería
  gana una 3.ª sección (`← →` desde la galería) con los 16 PNG de
  `assets/troops` y el nombre de cada unidad.

- **Corregido: la moneda Real ya no "hereda" acciones de unidad** (bug
  reportado): en `viableActions`, al seleccionar la moneda real la UI usaba
  el tipo de la PRIMERA moneda de tropa de la mano (fallback), así que el
  menú ofrecía Desplegar/Mover/… con la real y el motor las rechazaba. Ahora
  una moneda sin tipo (royal) solo ofrece descartes boca abajo
  (iniciativa/reclutar/pasar); la Guardia Real paga su táctica con la real
  cuando se actúa con su moneda de unidad.

- **Corregido el despliegue del Explorador adyacente a un aliado** (bug
  reportado): `Game.deploy` exigía `node.isLocation()` para TODA unidad, así
  que el Explorador no podía ocupar una casilla de movimiento (verde) aunque
  estuviera adyacente a un aliado — la regla real (y la lista de objetivos de
  la TUI, que ya ofrecía esas casillas) permite desplegarlo en CUALQUIER
  casilla vacía adyacente a una unidad amiga. Ahora la restricción de
  localización se salta cuando hay un aliado adyacente; `bun run play`
  también ofrece esas casillas al desplegar el Explorador.

- **Modo señalamiento con oscurecido y brillo** (pedido del usuario): al
  elegir dónde desplegar/mover/atacar/dominar (`TargetingView` con `dim`), el
  tablero se oscurece (cada casilla no jugable se mezcla hacia el color de la
  mesa con `dimHex`) y SOLO las casillas donde se puede actuar "brillan" con
  su color real aclarado hacia el blanco (`glowHex`) y sus overlays (unidad,
  ficha, id de base neutral). El cursor sobre el objetivo seleccionado se
  marca con ◆ y los demás objetivos con ◇. `hex-board.ts` guarda ahora la
  muestra por píxel lógico (`layout.samples`/`layout.locations`) y expone
  `hexLineRuns(layout, colorOf)` para recolorear un layout cacheado sin
  recalcular la geometría; helpers `dimHex`/`glowHex` cubiertos por tests.
- **El hexágono seleccionado SIEMPRE se ve** (pedido del usuario): además de
  la ◆, el hexágono bajo el cursor se rodea de un **anillo en color de acento**
  (máscara de mesa a distancia Chebyshev ≤ 2 de su borde, `hexRingMask`, sin
  depender del vecino más cercano) y su interior se aclara más que los otros
  objetivos (glow 0.55), de modo que al moverse con ← → queda claramente
  resaltado sobre el resto del tablero oscurecido.

- **El tablero de la partida se reimplementa como hexágonos de color nativos,
  igual que `bun run render`** (`src/client/hex-board.ts` + `BoardView`): se
  acabó el PNG del playmat en el tablero de juego. El render reconstruye la
  geometría flat-sided de cada una de las 37 casillas (la misma
  clasificación `classifyComposedBoardLocations` del script de terminal),
  contraídas al 88 % para dejar visible la mesa entre hexágonos, y pinta
  medio-bloques `▀` (fg = mitad superior, bg = inferior) con los colores
  reales del playmat (verde `#8fff91`, base neutral atenuada, amarillo de
  lobos, morado de cuervos). A diferencia del PNG (que se estiraba con
  `fit="fill"`), la escala es UNIFORME y el lienzo se calcula para llenar
  el área disponible (`hexBoardCanvas`, filas de terminal − reserva de
  mano/menú): las casillas conservan su proporción real. El render queda
  cacheado por tamaño (`hexBoardLayout`).
- **Overlays sobre los hexágonos**: las unidades se dibujan como la MONEDA
  del caballero con diámetro = círculo inscrito en el hexágono (√3·r2,
  ancho par para dejarla redonda 1:1 a media altura de caja) — con su
  marcador de pila/facción sobre la moneda, o como marcador de texto en el
  centro mientras la imagen carga o si falla. Las fichas de control
  blanca/negra van en la esquina de la base, los ids en bases neutrales, y
  el cursor/objetivos con ◆/◇ en el centro.
- **Los loaders se dividen**: `loadOverlayImages()` (moneda + fichas, lo que
  usa la partida) y `loadBoardImages()` (lo anterior + el PNG del playmat,
  solo para la vista previa de resoluciones `B`). `board-images.ts` cachea
  cada recurso con single-flight; la vista previa (PNG) y sus tests siguen
  igual con `ImageBoardView` en `src/client/views/board-image.tsx`.

- **5 resoluciones más arriba del tablero** (`bun run board-png
  [escalas…]`): además del canónico `board-1v1.png` (2×), el script genera
  ahora 12 escalas de 5× a 0.3× (490×541 a 8160×9010 px) rasterizando el
  mismo viewBox recortado. **Límite del cliente**: el decodificador nativo
  de OpenTUI no carga imágenes con más de ~4096 px por lado, así que en la
  TUI solo se pueden ver hasta 2.5× (4080×4505); 3×, 3.5×, 4× y 5× existen
  como PNG pero se marcan con ✕ y un aviso en la UI.
- **Página 2 de la galería — RESOLUCIONES DEL TABLERO 1V1**: con `← →`
  desde la galería se alterna entre la página de imágenes y la de los 12
  tableros (preview pequeño a 3 por fila + nombre de archivo + píxeles;
  ✕ = excede el límite del cliente). Los loaders de `board-images.ts`
  (imágenes base y variantes) ahora están cacheados y cargan cada variante
  UNA sola vez (`loadBoardImages`/`loadBoardVariant`), y la vista previa
  carga cada resolución bajo demanda según el índice para no decodificar los
  PNG grandes todos a la vez.
- **Vista previa del tablero por resolución** (`BoardPreviewView`, nueva
  pantalla de la app): con `B` desde la galería se entra a una vista que
  dibuja CADA variante al tamaño real del tablero (`BOARD_CANVAS` 80×33, 1:1)
  con una partida de ejemplo encima (monedas del caballero sobre las
  casillas, fichas de base blanca/negras, ids en bases neutrales, cursor y
  objetivos); `← →` cambian de resolución (nombre de archivo + píxeles en la
  cabecera; las no decodificables muestran su nombre con el aviso del
  límite) y `Esc`/`Enter` vuelve a la galería. `board-images.ts` carga
  todas las variantes compartidas (`loadBoardVariants`).
- **La vista previa abre SIEMPRE en una resolución visible** (`B` inicia en
  2.5×, la mayor que el cliente puede decodificar): antes abría en 5× y
  mostraba el tablero "en blanco" (las escalas 3×–5× exceden el límite del
  decodificador). La galería además carga las variantes SOLO al abrir la
  página 2 (no al arrancar la app), y `loadBoardImages`/`loadBoardVariant`
  están cacheadas para no re-decodificar los PNG grandes.

- **Tablero más grande (user)**: el lienzo del tablero pasa de 40×22 a
  **80×33 celdas** (100 % más ancho y 50 % más alto); las casillas, las
  fichas, las monedas y los textos de los overlays se escalan con la misma
  proyección SVG→celdas.
- **Todas las monedas (tropas y real) usan la imagen del caballero**
  (`assets/troops/caballero-coin-grande.png`): en el tablero cada unidad se
  dibuja como esa MONEDA del tamaño del hexágono 1:1 (`hexSize()` en
  `board-geometry.ts`), cubriendo la casilla; sobre ella se sobreescribe el
  marcador de pila (`L×3`, `C×2`). En la mano (`HandView`), todas las
  monedas —tropas y moneda real— se muestran también con la imagen del
  caballero, con su nombre al lado. El loader queda preparado para
  entidades con PNG propio por tipo (`coinImages`/`coinImageFor`).

- **El tablero del juego es la imagen PNG del playmat completo**
  (`bun run board-png`, script `src/scripts/board-to-png.ts` con
  `@resvg/resvg-js`): rasteriza `assets/board/board-1v1.svg` a
  `assets/board/board-1v1.png` recortando la región de las 37 casillas
  (viewBox 984 149 1632 1802) al doble de resolución, con el arte real de
  las bases (lobos y cuervos) y los hexágonos de trazo del playmat. El
  cliente dibuja esa imagen única con `fit="fill"` en un lienzo de
  `BOARD_CANVAS` (40×22 celdas) y posiciona las fichas, unidades, cursor y
  objetivos con `hexCenter` — proyección lineal SVG→celdas del reticulado
  (col A x=1130.42 paso 223.19 · fila 0 y=276.84 paso 128.86), verificada en
  tests. Sustituye al render de tiles sueltos (`casilla.png`), que se cae al
  mapa de píxeles ASCII solo como fallback mientras cargan el PNG.

- **Galería de imágenes al inicio de la app** (`GalleryView`, primera
  pantalla del TUI antes del título): muestra las **10 imágenes** de
  `assets/troops/` con su nombre de archivo y dimensiones — la moneda del
  caballero en sus 3 tamaños y 2 variantes (sin aro `caballero-coin-*` y
  con el aro original `caballero-*`), más `caballero.png` (original),
  `casilla.png`, `controltokenwhite.png` y `controltokenblack.png`. Enter
  pasa al título y `q` sale.

- **El tablero se dibuja con las imágenes PNG reales** (`<image>` de
  OpenTUI): cada casilla es `assets/troops/casilla.png` colocada por
  geometría hex (`src/client/board-geometry.ts`, reticulado regular con paso
  de medio tile y paridad de columna alterna); las bases de jugador muestran
  la ficha de control encima (blanca para Lobos, negra para Cuervos, PNGs
  `assets/troops/controltoken*.png`) y las bases neutrales muestran su id de
  rejilla (p. ej. `A7`) como texto sobre el tile. Las unidades, el cursor y
  los objetivos válidos se superponen como texto en la propia casilla. El
  render cae al mapa de píxeles ASCII mientras cargan las imágenes o si
  fallan, y comparte las tres NativeImage entre todos los tiles.
  `protocol="auto"` usa Kitty/Sixel donde existe y bloques Unicode en el
  resto, así que el arte se ve en cualquier terminal. La moneda del caballero
  del título se limpia y reduce por script (`bun run trim-caballero`): quita
  el aro oscuro que rodea la moneda (flood-fill desde los bordes sobre el
  azul del disco) y la escala al 25 % → `assets/troops/caballero-coin.png`
  (80×80, sin tocar el `caballero.png` original); el badge del título pasa a
  usar esa moneda a 8×4 celdas.
- **La moneda del caballero en 3 tamaños y 2 variantes** (`bun run
  trim-caballero [tamaños…]`, por defecto 256/128/64): cada tamaño se escala
  directamente desde el master 320×320 con el kernel `area` (máximo detalle,
  sin escalados encadenados) y produce `caballero-coin-<tamaño>.png` (limpia,
  sin el aro oscuro) y `caballero-<tamaño>.png` (con el aro original,
  sin el script de limpieza). Nombres: `grande`/`mediano`/`pequeno`. El
  título usa `caballero-coin-mediano.png`.

- El robo de ronda completa hasta 3 monedas por jugador: cuando la bolsa se
  agota, el descarte se baraja y vuelve a la bolsa antes de continuar. Si no
  quedan monedas en ninguna colección, se roban únicamente las disponibles.

- Simplificada la interacción principal: primero se elige una moneda de la
  mano y después una acción contextual; `Esc` vuelve a escoger moneda sin
  mostrar todos los datos de la partida a la vez.
- El tablero ocupa casi todo el espacio de juego y la mano/acciones quedan
  debajo. El arte de terrenos y tropas se dibuja directamente dentro de las
  celdas, sin tarjetas separadas.
- El draft usa toda la pantalla con una parrilla 4×2 de cartas grandes,
  mostrando solo el jugador activo, el progreso y la carta enfocada. La
  parrilla se adapta a terminales estrechas reduciendo columnas.

- Añadido el cliente OpenTUI React (`bun run tui`) con pantalla de título,
  draft por tarjetas, tablero compacto, paneles de facción, mano rival oculta,
  menú de acciones viable-only y ventana de mensajes.
- Añadida la proyección inmutable `GameStateView` y helpers puros de mapa y
  viabilidad para mantener la TUI desacoplada del dominio.
- El cliente usa el motor en el mismo proceso y no mezcla `readline` con el
  renderer; `q` y Ctrl+C restauran la terminal mediante `renderer.destroy()`.

## v0.3.1 — Rondas y partida jugable en terminal (ampliación del ciclo 2)

- **Flujo de rondas en el dominio (spec §3.5 / §4.2)**: `Game` gana la máquina
  de fases `phase` (`setup | playing | round-over | finished`) y el estado
  `passed` por jugador. Métodos: `startRound` (pasa a `playing`: roba 3
  monedas a cada jugador, fija al jugador con iniciativa y resetea la
  reclamación; sube `round` solo si la fase previa era `round-over`),
  `endRound` (pasa a `round-over`: descarta las manos), `nextTurn`
  (alternancia) y `retire` (pase sin descarte cuando la mano queda vacía).
  `pass` ahora marca al jugador como pasado de la ronda; la iniciativa
  reclamada se aplica en la ronda siguiente. `GamePhase` y `coin-spent` como
  tipos nuevos.
- **Revisión de código (CodeRabbit)**: táctica de la Infantería ATÓMICA (todas
  las maniobras se validan antes de ejecutar ninguna) y control centralizado
  (`Game.controlLocation`) que detecta la victoria también en el dominio de la
  Infantería; `RandomSource` validada en [0, 1) (draw/shuffle); la reserva
  rechaza la moneda real por cualquier vía; `configureGame` valida las bases de
  ambos jugadores antes de colocar fichas; `Unit` con pila encapsulada (solo
  lectura) e id por instancia (las dos Infanterías se distinguen); eventos
  `coin-lost` diferenciados de `unit-destroyed`; concesiones free-maneuver sin
  duplicados (Espadachín) y con unidad correcta (unitPos); la Caballería ligera
  comprueba la ocupación en su atajo de 1 casilla; el Ballestero rechaza
  disparar a través de aliados.
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
