# Especificación Completa: War Chest 1vs1 en Terminal (Bun + TypeScript)

---

## 1. Introducción y Objetivos

Desarrollaremos una implementación digital del juego de mesa **War Chest** para dos jugadores en red local. El sistema constará de:

- **Servidor**: proceso central que mantiene el estado del juego, valida las acciones según las reglas y comunica a los clientes mediante WebSockets.
- **Cliente**: interfaz de terminal (TUI) que se conecta al servidor, muestra el estado del juego y envía las acciones del jugador.
- **Dominio**: núcleo de reglas y entidades, completamente desacoplado de la red y la presentación, lo que permitirá en el futuro reutilizarlo para una versión web.

**Objetivos principales**:
- Fidelidad a las reglas oficiales (resumidas en `reglas.md`).
- Arquitectura limpia orientada a objetos (OOP), aplicando principios SOLID y patrones de diseño.
- Separación estricta de responsabilidades entre dominio, aplicación, infraestructura y presentación.
- Cobertura de pruebas unitarias y de integración (end-to-end) que aseguren el correcto funcionamiento.
- Desarrollo iterativo con commits atómicos y documentación de decisiones.

**Tecnologías**:
- **Bun** como runtime y gestor de paquetes.
- **TypeScript** en modo estricto.
- **WebSockets nativos de Bun** para la comunicación.
- **bun:test** para pruebas.
- Opcionalmente **tuix** para una TUI más interactiva (en fases avanzadas).

---

## 2. Arquitectura General

Se adopta una arquitectura en capas inspirada en Domain-Driven Design (DDD) y principios SOLID.

```
┌─────────────────────────────────────────────┐
│                  Cliente (TUI)              │
│  - Renderizado del estado                   │
│  - Captura de entrada y envío de comandos   │
└───────────────┬─────────────────────────────┘
                │ WebSocket (JSON)
┌───────────────▼─────────────────────────────┐
│               Servidor                      │
│  - Gestión de sesiones y conexiones         │
│  - Orquestación de casos de uso             │
│  - Validación y ejecución de acciones       │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│            Dominio (Núcleo)                 │
│  - Entidades: Board, Unit, Player, etc.     │
│  - Reglas del juego y habilidades           │
│  - Patrones: Command, State, Observer       │
└───────────────┬─────────────────────────────┘
                │
┌───────────────▼─────────────────────────────┐
│          Infraestructura                    │
│  - Carga del tablero (SVG)                  │
│  - Persistencia (opcional)                  │
└─────────────────────────────────────────────┘
```

**Separación Cliente/Servidor**:
- El dominio no conoce ni el servidor ni el cliente; solo expone APIs puras.
- El servidor traduce mensajes de red a comandos del dominio y viceversa.
- El cliente solo consume DTOs (Data Transfer Objects) y envía DTOs de acciones.
- Esta separación permite reutilizar el dominio y el servidor con un futuro frontend web.

---

## 3. Modelo de Dominio (OOP)

Todas las clases se ubicarán en `src/domain/`. Se sigue el patrón **Aggregate Root** para `Game`, que encapsula `Board`, `Player`, `Unit` y las reglas.

### 3.1. Value Objects

- **`Position`**: identificador inmutable de una celda (string). Método `equals`.
- **`PlayerId`**: unión `'player1' | 'player2'`.
- **`UnitType`**: enum de los 16 tipos de unidades (Alférez, Arquero, Ballestero, Caballería, Caballería ligera, Caballero, Clérigo, Espadachín, Explorador, Guardia Real, Guerrero, Infantería, Lancero, Mariscal, Mercenario, Piquero).
- **`ActionType`**: enum de acciones posibles.

### 3.2. Entidades

#### 3.2.1. `BoardNode` (celda del tablero)

- Atributos: `id: string`, `x: number`, `y: number` (coordenadas para UI), `neighbors: Position[]`, `controlledBy?: PlayerId`, `controlMarkers: number`.
- Métodos:
  - `addControlMarker(playerId)`: añade una ficha de dominio y actualiza `controlledBy`.
  - `removeControlMarker()`: elimina una ficha.
  - `isControlledBy(playerId)`: boolean.
  - `isNeutral()`: boolean.

#### 3.2.2. `Board` (agregado)

- Contiene un mapa de `BoardNode` indexado por `Position`.
- Métodos:
  - `getNode(pos)`, `areAdjacent(a, b)`, `getNeighbors(pos)`.
  - `placeUnit(unit, pos)`, `removeUnit(unitId)`, `getUnitsAt(pos)`.
  - `getAllUnits()`, `getUnitsByPlayer(playerId)`.
- Se construye a partir de un `BoardLoader`.

#### 3.2.3. `Unit` (pila de monedas en el tablero)

- Atributos: `id: string`, `type: UnitType`, `owner: PlayerId`, `position: Position`, `coins: number` (vida, empieza en 1).
- Métodos:
  - `addCoin()`: incrementa `coins`.
  - `removeCoin(): boolean`: decrementa, devuelve `false` si la pila queda vacía (para eliminarla).
  - `isReinforced()`: `coins > 1`.

#### 3.2.4. `Player`

- Atributos:
  - `id: PlayerId`
  - `factionName: string`
  - `bag: Bag`
  - `hand: Hand`
  - `discard: DiscardPile`
  - `reserve: Reserve`
  - `royalCoin: boolean` (indica si la moneda real está disponible en mano/bolsa/descarte)
  - `controlMarkers: number` (inicial 6, se van colocando)
  - `unitCards: UnitType[]` (cartas de unidad elegidas en el draft)
- Métodos principales:
  - `drawCoins(count)`: roba de la bolsa a la mano, barajando el descarte si es necesario.
  - `discardHand()`: descarta todas las monedas de la mano al final de la ronda.
  - `canRecruit()`: verifica si hay monedas en reserva y mano.

#### 3.2.5. `CoinCollection` (clase abstracta) y subclases

Base para todas las colecciones de monedas. Implementa operaciones comunes:
- `add(type, count = 1)`
- `remove(type, count = 1): boolean`
- `count(type): number`
- `total(): number`
- `toArray(): UnitType[]`
- `clear()`

Subclases:

| Clase        | Propósito                                                                 | Métodos adicionales                                  |
|--------------|---------------------------------------------------------------------------|------------------------------------------------------|
| `Bag`        | Bolsa de robo, orden aleatorio.                                           | `shuffle()`, `draw(count): UnitType[]`               |
| `Hand`       | Monedas robadas disponibles para el turno.                                | `has(type): boolean`, `play(type): boolean`          |
| `DiscardPile`| Pila de descarte, se barajará para formar nueva bolsa.                    | `shuffleInto(bag: Bag)`                              |
| `Reserve`    | Monedas de reserva, no entran en juego salvo por reclutamiento.           | `recruit(type): boolean`                             |

**Nota sobre la moneda real**: No se modela como `UnitType`. Se controla con el flag `royalCoin` en `Player` y un atributo booleano `hasRoyalCoin` en `DiscardPile` (o se agrega un marcador especial). Al descartarse la moneda real, se activa `hasRoyalCoin = true` en el descarte y `royalCoin = false` en el jugador. Al barajar el descarte a la bolsa, la moneda real vuelve a estar disponible (`royalCoin = true`).

### 3.3. Habilidades de Unidades (Strategy Pattern)

- **`Ability`** (interfaz):
  ```typescript
  interface Ability {
    name: string;
    description: string;
    canActivate(game: Game, unit: Unit, target?: Position): boolean;
    execute(game: Game, unit: Unit, target?: Position): void;
  }
  ```
- **`UnitDefinition`**: clase con los datos estáticos de una unidad: tipo, coste, habilidad, flags `attackOnlyByAbility` (X) y `hasInnate` (I).
- Implementaciones concretas: `ArcherAbility`, `CavalryAbility`, `ClericAbility`, etc. Se instancian según el `UnitType` mediante una `UnitFactory` o registro.
- La habilidad puede necesitar interactuar con el `Game` (por ejemplo, mover otras unidades, robar monedas, etc.), por lo que recibe el `Game` completo en `execute`.

### 3.4. Acciones del Juego (Command Pattern)

Cada acción del jugador será un comando que encapsula la validación y ejecución.

- **Interfaz `GameAction`**:
  ```typescript
  interface GameAction {
    readonly type: ActionType;
    execute(game: Game, player: Player): ActionResult;
  }
  ```
- **`ActionResult`**: objeto con `success: boolean`, `message?: string`, y posibles datos adicionales (por ejemplo, cartas robadas).
- Clases concretas: `DeployAction`, `ReinforceAction`, `MoveAction`, `AttackAction`, `ControlAction`, `UseAbilityAction`, `ClaimInitiativeAction`, `RecruitAction`, `PassAction`.
- Cada comando valida:
  - Que el jugador tenga las monedas necesarias (en mano o para descarte).
  - Que la unidad objetivo exista y pertenezca al jugador.
  - Que la casilla destino sea válida según las reglas (adyacencia, ocupación, dominio, etc.).
  - Reglas especiales de la unidad (por ejemplo, el Arquero solo ataca con habilidad).
- Si la validación falla, devuelve `ActionResult` con error y no modifica el estado.
- Si es exitoso, aplica los cambios y devuelve éxito.

### 3.5. Fases del Juego (State Pattern)

El flujo de una ronda se modela con estados:

- **`GamePhase`** (interfaz):
  ```typescript
  interface GamePhase {
    onEnter(game: Game): void;
    handleAction(game: Game, player: Player, action: GameAction): ActionResult;
    onExit(game: Game): void;
  }
  ```
- **`RobandoFase`**: al inicio de la ronda, ambos jugadores roban 3 monedas.
- **`UsandoMonedasFase`**: los jugadores se alternan realizando acciones hasta que ambos pasan o se quedan sin monedas.
- **`FinRondaFase`**: se descartan las monedas restantes, se baraja la bolsa si es necesario, se cambia la iniciativa si fue reclamada, se incrementa el número de ronda.
- El `Game` tiene una propiedad `phase: GamePhase` y delega `handleAction` a la fase actual. Cada fase puede cambiar la fase al terminar.

### 3.6. Notificación de Cambios (Observer Pattern)

- **`GameObserver`** (interfaz): `update(state: GameStateDTO): void`.
- `Game` mantiene una lista de observadores y los notifica después de cada cambio de estado (acción exitosa, fase cambiada, etc.).
- El servidor implementará un observador que serializa el estado y lo envía a los clientes.

### 3.7. DTOs y Serialización

Para no exponer las clases internas, se definen DTOs en `src/shared/dto.ts`. El `Game` tiene un método `toDTO(): GameStateDTO` que devuelve un objeto plano con toda la información necesaria para que el cliente renderice.

Ejemplo de `GameStateDTO`:
```typescript
interface GameStateDTO {
  board: Record<string, { id: string; x: number; y: number; controlledBy?: string; controlMarkers: number; neighbors: string[] }>;
  units: Array<{ id: string; type: string; owner: string; position: string; coins: number }>;
  players: {
    player1: PlayerDTO;
    player2: PlayerDTO;
  };
  currentPlayer: string;
  phase: string;
  initiative: string;
  roundNumber: number;
  turnNumber: number;
  winner?: string;
}
```

---

## 4. Reglas del Juego (Resumen para Implementación)

Las reglas completas están en `reglas.md`. A continuación se resumen los puntos clave para la implementación.

### 4.1. Preparación

1. Se cargan 8 cartas de unidad aleatorias.
2. Los jugadores eligen cartas alternadamente: el jugador 1 elige 1, el jugador 2 elige 2, jugador 1 elige 2, jugador 2 elige 2, jugador 1 elige 1.
3. Cada jugador recibe:
   - 1 moneda real.
   - 2 monedas de cada tipo de unidad que seleccionó → van a su bolsa.
   - El resto de monedas de esos tipos van a su reserva.
   - 6 fichas de dominio (2 se colocan en sus localizaciones iniciales).
4. El jugador que eligió segundo recibe la iniciativa (jugará primero en la primera ronda).

### 4.2. Desarrollo de una ronda

1. **Robo**: ambos jugadores roban 3 monedas de su bolsa.
2. **Uso de monedas**: empezando por el jugador con iniciativa, se alternan turnos para realizar una acción.
   - Si un jugador pasa, no puede volver a actuar en esa ronda (a menos que el oponente también pase, lo que finaliza la ronda).
3. **Fin de ronda**: cuando ambos han pasado o se han quedado sin monedas en mano, se descartan las monedas restantes de la mano y comienza una nueva ronda.

### 4.3. Acciones

#### Colocación (usan monedas de la mano, se colocan en el tablero)
- **Desplegar**: gasta 1 moneda del tipo a desplegar y coloca una pila de 1 moneda en una localización vacía que domines. Solo puede haber una unidad de cada tipo por jugador en el tablero (a menos que la habilidad diga lo contrario).
- **Reforzar**: gasta 1 moneda del mismo tipo que una unidad propia en el tablero y añade esa moneda a la pila (aumenta la vida en 1).

#### Descarte boca abajo (cualquier moneda de la mano)
- **Reclamar la Iniciativa**: descarta 1 moneda y toma la iniciativa para la siguiente ronda.
- **Reclutar**: descarta 1 moneda y mueve 1 moneda de tu reserva a tu pila de descarte (boca arriba).
- **Pasar**: descarta 1 moneda y no hace nada más.

#### Maniobras (descartan una moneda del mismo tipo que la unidad que actúa)
- **Mover**: mueve una unidad propia 1 casilla adyacente (o según su habilidad).
- **Dominar**: si la unidad está en localización neutral o enemiga, coloca 1 ficha de dominio.
- **Atacar**: elimina 1 moneda de una unidad enemiga adyacente.
- **Usar Habilidad**: ejecuta la habilidad especial de la unidad.

**Restricciones**:
- La moneda real solo puede usarse para acciones de descarte boca abajo.
- Unidades con **(X)** solo pueden atacar mediante su habilidad (no con la acción Atacar normal).
- Unidades con **(I)** poseen habilidades innatas que se aplican automáticamente o como parte de otra acción.

### 4.4. Bag Building (Sistema de monedas)

El sistema de bag building es el núcleo económico. Detalles:

#### Composición inicial
- Bolsa = 1 moneda real + 2 monedas de cada tipo seleccionado.
- Reserva = resto de monedas de esos tipos.
- Pila de descarte y mano vacías.

#### Robo de monedas
- Al inicio de cada ronda, se roban 3 monedas.
- Si la bolsa se agota, se baraja la pila de descarte y se convierte en la nueva bolsa.
- Si no hay suficientes monedas ni en bolsa ni en descarte, se roba lo que haya.

#### Uso y descarte
- Las acciones de colocación no descartan, colocan la moneda en el tablero.
- Las maniobras descartan una moneda del tipo de la unidad que actúa (la moneda va a la pila de descarte).
- Las acciones de descarte boca abajo descartan cualquier moneda (incluida la real).

#### Reclutamiento
- Al reclutar, se descarta una moneda cualquiera de la mano y se toma una moneda de la reserva (del tipo deseado) y se coloca en la pila de descarte.

#### Eliminación de unidades
- Cuando una unidad enemiga es atacada, se elimina una moneda de su pila. Esa moneda regresa a la reserva del propietario.
- Si la pila pierde su última moneda, la unidad desaparece.

#### Reciclaje
- Al barajar el descarte para formar nueva bolsa, se incluye la moneda real si estaba en el descarte.

### 4.5. Condición de victoria

Gana el primer jugador que coloque sus 6 fichas de dominio en el tablero.

---

## 5. Protocolo de Comunicación (JSON sobre WebSocket)

Se define en `src/shared/protocol.ts`.

**Mensajes Cliente → Servidor**:
```typescript
type ClientMessage =
  | { type: 'join', playerName: string }
  | { type: 'action', action: ActionDTO }
  | { type: 'chat', text: string };
```

**Mensajes Servidor → Cliente**:
```typescript
type ServerMessage =
  | { type: 'welcome', playerId: PlayerId, state: GameStateDTO }
  | { type: 'state_update', state: GameStateDTO }
  | { type: 'action_result', success: boolean, message?: string }
  | { type: 'error', message: string }
  | { type: 'chat', from: string, text: string };
```

`ActionDTO` es una versión serializable de `GameAction` (por ejemplo, `{ type: 'move', from: 'A1', to: 'B2' }`). El servidor lo transformará en un comando concreto usando un `ActionFactory`.

---

## 6. Servidor

- **`WarChestServer`**: se encarga de aceptar conexiones WebSocket, gestionar sesiones de jugadores, crear y manejar el `Game`.
- Flujo:
  1. Espera conexiones.
  2. Cuando dos jugadores se conectan, crea una nueva partida (o espera si ya hay una en curso).
  3. Envía `welcome` a cada jugador con su `playerId` y el estado inicial.
  4. Recibe mensajes `action`, los traduce a comandos del dominio y los ejecuta a través del `GameService`.
  5. Envía `action_result` al jugador que actuó y `state_update` a ambos jugadores (si la acción fue exitosa).
  6. Maneja desconexiones y reconexiones (opcional).

El servidor se inicia con `bun run src/server/index.ts` y escucha en un puerto configurable (por defecto 3000).

**Inyección de dependencias**: El `GameService` recibe el `BoardLoader` y crea el `Game` con sus observadores. El servidor implementa `GameObserver` para enviar actualizaciones.

---

## 7. Cliente (TUI)

- El cliente se conecta al servidor proporcionando la IP y puerto.
- Recibe el estado y lo renderiza en la terminal.
- Captura la entrada del usuario (mediante `readline` o `tuix`) y envía las acciones correspondientes.
- La interfaz no contiene lógica de negocio; solo traduce la entrada a `ActionDTO` y muestra el estado.

**Opciones de UI**:
- **Modo texto simple**: imprimir tablero en ASCII, mostrar mano y comandos textuales. Fácil de implementar.
- **Interfaz con `tuix`**: más interactiva, permite selección con teclas. Se puede implementar en un ciclo posterior.

Inicialmente se implementará el modo texto simple para asegurar la funcionalidad, y luego se puede mejorar con `tuix`.

---

## 8. Carga del Tablero desde SVG

Se define una interfaz **`BoardLoader`** en la capa de infraestructura:

```typescript
export interface BoardLoader {
  load(): Promise<Board>;
}
```

La implementación **`SVGBoardLoader`** leerá un archivo SVG (cuya estructura se definirá cuando se adjunte) y construirá un `Board` con sus nodos y adyacencias. Este loader se inyectará en el `Game` al iniciar el servidor.

**Nota**: Mientras no se disponga del SVG, se usará un **`MockBoardLoader`** que genere un tablero de ejemplo (por ejemplo, un hexágono simple) para pruebas y desarrollo. Esto permite avanzar sin depender del SVG real.

---

## 9. Estrategia de Pruebas

### 9.1. Pruebas Unitarias (`bun:test`)

- **Dominio**: Cada clase, método y regla de validación.
  - `Position`, `BoardNode`, `Board` (adyacencia, control, colocación de unidades).
  - `CoinCollection` y subclases (draw, shuffle, add/remove, reclutamiento).
  - `Player` (gestión de monedas, control markers).
  - Cada `GameAction` (casos válidos e inválidos).
  - Habilidades concretas.
  - Fases del juego (transiciones).
- **Utilidades**: serialización, parsing de comandos.

### 9.2. Pruebas de Integración

- Simulación de una partida completa con dos jugadores (sin red, usando llamadas directas al `Game`).
- Verificar que se pueden realizar acciones en secuencia correcta.
- Probar condiciones de victoria (colocar 6 fichas de dominio).
- Probar efectos de habilidades (por ejemplo, Clérigo roba moneda extra, Caballería se mueve y ataca).
- Probar el sistema de bag building completo: robo, descarte, barajado, reclutamiento, retorno a reserva.

### 9.3. Pruebas End-to-End (E2E)

- Levantar servidor y conectar dos clientes simulados (pueden ser funciones que envían mensajes WebSocket).
- Verificar flujo completo: conexión, selección de unidades, rondas, acciones, fin de partida.
- Usar `bun:test` con un servidor en un puerto aleatorio.
- También se pueden hacer pruebas de red local real, pero para CI se simulará.

### 9.4. Cobertura

Se buscará una cobertura superior al 80% en el dominio y 70% en integración.

---

## 10. Ciclos de Desarrollo y Commits

Cada ciclo terminará con un commit que incluya:
- Código funcional y probado.
- Documentación actualizada (`CHANGELOG.md` y `DECISIONS.md`).
- Pruebas unitarias y/o de integración.

**Regla**: Al inicio de cada ciclo, el contexto se reinicia (borrado de caché mental). Por lo tanto, es obligatorio mantener un historial de decisiones y cambios en archivos markdown.

### 10.1. Archivos de Documentación

- **`CHANGELOG.md`**: registro de cambios por versión/ciclo.
- **`DECISIONS.md`**: registro de decisiones arquitectónicas y técnicas, con fecha y justificación.
- **`docs/`**: documentación adicional (diagramas, explicaciones).

### 10.2. Lista de Ciclos Propuestos

1. **Ciclo 0 – Configuración del proyecto**
   - Crear estructura de carpetas, `package.json`, `tsconfig.json`, configuración de Bun.
   - Definir tipos básicos y enums (`UnitType`, `PlayerId`).
   - Implementar `Position` y pruebas unitarias.
   - Crear `MockBoardLoader` para pruebas.
   - Documentar decisiones iniciales.
   - Commit.

2. **Ciclo 1 – Entidades básicas del dominio**
   - Implementar `BoardNode`, `Board`.
   - Implementar `CoinCollection` y subclases (`Bag`, `Hand`, etc.).
   - Implementar `Player` con sus colecciones.
   - Implementar `Unit`.
   - Pruebas unitarias para todas las entidades.
   - Commit.

3. **Ciclo 2 – Configuración de la partida**
   - Implementar selección de cartas de unidad (reparto aleatorio).
   - Crear bolsas iniciales (moneda real + 2 de cada tipo).
   - Colocar fichas de dominio iniciales.
   - Asignar iniciativa.
   - Probar flujo de preparación.
   - Commit.

4. **Ciclo 3 – Acciones básicas (sin habilidades)**
   - Implementar `GameAction` y comandos: `Deploy`, `Reinforce`, `Move`, `Attack`, `Control`.
   - Integrar con `Game` y `Board`.
   - Validaciones según reglas (sin habilidades especiales).
   - Pruebas unitarias por comando.
   - Commit.

5. **Ciclo 4 – Habilidades de unidades**
   - Definir `Ability` y `UnitDefinition`.
   - Implementar habilidades de todas las unidades (o al menos las más comunes).
   - Integrar con `UseAbilityAction`.
   - Modificar comandos existentes para respetar restricciones (X, I).
   - Pruebas para cada habilidad.
   - Commit.

6. **Ciclo 5 – Flujo de turnos y rondas (State Pattern)**
   - Implementar fases `Robando`, `UsandoMonedas`, `FinRonda`.
   - Lógica de iniciativa y pase.
   - Robo de 3 monedas, descarte al final.
   - Condición de victoria (6 fichas de dominio).
   - Pruebas de integración del flujo completo.
   - Commit.

7. **Ciclo 6 – Servidor WebSocket**
   - Implementar `WarChestServer` con `Bun.serve`.
   - Gestión de conexiones y sesiones.
   - Protocolo de mensajes.
   - Inyección del `Game` y `GameService`.
   - Pruebas con clientes simulados (WebSocket).
   - Commit.

8. **Ciclo 7 – Cliente TUI básico**
   - Implementar cliente con `readline`.
   - Conexión al servidor.
   - Renderizado ASCII del tablero y estado del jugador.
   - Envío de acciones.
   - Pruebas end-to-end (cliente simulado + servidor).
   - Commit.

9. **Ciclo 8 – Integración y pulido**
   - Mejorar la interfaz (opcional: `tuix`).
   - Manejo de reconexiones.
   - Documentación final.
   - Pruebas E2E completas.
   - Commit final.

Cada ciclo puede ajustarse según el avance y la complejidad, pero el orden garantiza una base sólida antes de agregar complejidad.

---

## 11. Consideraciones para Futura Versión Web

- El protocolo WebSocket ya es independiente de la plataforma.
- El servidor expone solo DTOs; un cliente web puede conectarse usando la misma API.
- El dominio es completamente agnóstico de la interfaz.
- Se puede reutilizar `GameService` y `WarChestServer` sin cambios.
- Solo habría que implementar un nuevo cliente (React, por ejemplo) que consuma el mismo WebSocket.

---

## 12. Definición de "Done" para cada Ciclo

- Todo el código compila sin errores (`bun run check`).
- Las pruebas unitarias y de integración pasan (`bun test`).
- Se ha actualizado `CHANGELOG.md` y `DECISIONS.md`.
- El commit es atómico y contiene solo cambios relacionados con el ciclo.
- No hay dependencias rotas.

---

## 13. Herramientas y Scripts

En `package.json`:

```json
{
  "scripts": {
    "dev": "bun run --watch src/server/index.ts",
    "start": "bun src/server/index.ts",
    "client": "bun src/client/index.ts",
    "test": "bun test",
    "check": "bun tsc --noEmit"
  }
}
```

---
