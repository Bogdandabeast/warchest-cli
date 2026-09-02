/**
 * Tablero (spec §3.2.1–3.2.2): casillas con terreno, control y el registro de
 * unidades desplegadas.
 *
 * Cambios del ciclo 2 respecto al ciclo 1 (ver DECISIONS.md):
 *  - `BoardNode` ahora lleva `terrain` (tipo en el dominio) en lugar del flag
 *    `startZone`; la base de inicio de un jugador se deriva del terreno.
 *  - Solo las bases son *localizaciones* (`isLocation`): las 10 bases pueden
 *    recibir fichas de dominio y despliegues; las casillas verdes normales
 *    solo son de movimiento.
 *  - El control se modela con UNA ficha de dominio por casilla (regla real):
 *    al conquistar una localización enemiga se devuelve su ficha y se coloca
 *    la propia (`addControlMarker` reemplaza).
 */
import type { PlayerId, Position } from "./types.ts";
import { startZoneOf } from "./terrain.ts";
import type { Terrain } from "./terrain.ts";
import type { UnitType } from "./units.ts";
import { Unit } from "./unit.ts";

export interface BoardNodeOptions {
  id: Position;
  x: number;
  y: number;
  neighbors?: readonly Position[];
  /** Terreno de la casilla (ver `src/domain/terrain.ts`). Por defecto normal. */
  terrain?: Terrain;
}

/**
 * Celda del tablero (spec §3.2.1).
 *
 * Una localización (base) puede contener como mucho UNA ficha de dominio; el
 * dueño de esa ficha controla la localización. `addControlMarker` reemplaza
 * cualquier ficha previa (conquista) y devuelve al anterior dueño la suya.
 */
export class BoardNode {
  readonly id: Position;
  readonly x: number;
  readonly y: number;
  readonly neighbors: readonly Position[];
  readonly terrain: Terrain;

  /** Dueño de la ficha de dominio colocada aquí (undefined = sin controlar). */
  private controlMarker?: PlayerId;

  constructor(options: BoardNodeOptions) {
    if (options.neighbors?.includes(options.id)) {
      throw new Error(`Una casilla no puede ser vecina de sí misma: ${options.id}`);
    }
    this.id = options.id;
    this.x = options.x;
    this.y = options.y;
    this.neighbors = (options.neighbors ?? []).slice();
    this.terrain = options.terrain ?? "normal";
  }

  /** ¿Es una base (localización de inicio) de algún jugador? Se deriva del terreno. */
  isStartZone(): boolean {
    return this.startZone !== undefined;
  }

  /** Jugador cuya base de inicio es esta casilla, según su terreno. */
  get startZone(): PlayerId | undefined {
    return startZoneOf(this.terrain);
  }

  /** ¿Puede recibir fichas de dominio y unidades (solo las bases)? */
  isLocation(): boolean {
    return this.terrain !== "normal";
  }

  /** Ficha de dominio colocada: número (0 o 1 por la regla real). */
  get controlMarkers(): number {
    return this.controlMarker === undefined ? 0 : 1;
  }

  /** Jugador que controla la localización (undefined si está neutral). */
  get controlledBy(): PlayerId | undefined {
    return this.controlMarker;
  }

  /**
   * Coloca una ficha de dominio del jugador. Si la localización ya estaba
   * controlada por otro, devuelve a ese jugador su ficha (conquista) y pone
   * la nueva.
   */
  addControlMarker(playerId: PlayerId): PlayerId | undefined {
    const previous = this.controlMarker;
    this.controlMarker = playerId;
    return previous;
  }

  /** Retira la ficha de dominio; devuelve al dueño anterior (si lo había). */
  removeControlMarker(): PlayerId | undefined {
    const previous = this.controlMarker;
    this.controlMarker = undefined;
    return previous;
  }

  /** ¿Esta localización está controlada por el jugador? */
  isControlledBy(playerId: PlayerId): boolean {
    return this.controlMarker === playerId;
  }

  /** ¿Es una localización sin ninguna ficha de dominio? */
  isNeutral(): boolean {
    return this.isLocation() && this.controlMarker === undefined;
  }
}

/**
 * Tablero: agregado con todas las casillas indexadas por `Position` y el
 * registro de unidades desplegadas (spec §3.2.2).
 */
export class Board {
  private readonly nodes: Map<Position, BoardNode>;
  private readonly units: Map<Unit, Unit> = new Map();

  constructor(nodes: Iterable<BoardNode>) {
    this.nodes = new Map();
    for (const node of nodes) {
      if (this.nodes.has(node.id)) {
        throw new Error(`Casilla duplicada en el tablero: ${node.id}`);
      }
      this.nodes.set(node.id, node);
    }
    // Integridad del grafo: cada vecino debe existir y la relación debe ser
    // bidireccional, para que `areAdjacent` solo refleje conexiones válidas.
    for (const node of this.nodes.values()) {
      for (const neighborId of node.neighbors) {
        const neighbor = this.nodes.get(neighborId);
        if (neighbor === undefined) {
          throw new Error(`La casilla ${node.id} referencia un vecino inexistente: ${neighborId}`);
        }
        if (!neighbor.neighbors.includes(node.id)) {
          throw new Error(`Vecindad no bidireccional: ${node.id} → ${neighborId} (falta la relación inversa)`);
        }
      }
    }
  }

  get size(): number {
    return this.nodes.size;
  }

  has(position: Position): boolean {
    return this.nodes.has(position);
  }

  getNode(position: Position): BoardNode | undefined {
    return this.nodes.get(position);
  }

  getAllNodes(): BoardNode[] {
    return [...this.nodes.values()];
  }

  /**
   * Posiciones vecinas de una casilla. Devuelve una copia (inmutable) y
   * una lista vacía si la posición no existe.
   */
  getNeighbors(position: Position): Position[] {
    return this.nodes.get(position)?.neighbors.slice() ?? [];
  }

  /** ¿`a` y `b` son casillas distintas y adyacentes? */
  areAdjacent(a: Position, b: Position): boolean {
    return a !== b && (this.nodes.get(a)?.neighbors.includes(b) ?? false);
  }

  /**
   * Bases de inicio de un jugador (según el terreno), ordenadas por id. Son
   * las casillas donde el setup coloca las fichas de dominio iniciales.
   */
  getStartLocations(player: PlayerId): Position[] {
    return this.getAllNodes()
      .filter((node) => node.startZone === player)
      .map((node) => node.id)
      .sort();
  }

  // ── Control ──────────────────────────────────────────────────────────────

  /** Todas las localizaciones (bases) del tablero. */
  getLocations(): BoardNode[] {
    return this.getAllNodes().filter((node) => node.isLocation());
  }

  /** Localizaciones controladas por el jugador. */
  getControlledLocations(player: PlayerId): BoardNode[] {
    return this.getLocations().filter((node) => node.isControlledBy(player));
  }

  /** Número de fichas de dominio que el jugador tiene colocadas. */
  countControlMarkers(player: PlayerId): number {
    return this.getLocations().filter((node) => node.isControlledBy(player)).length;
  }

  /** Coloca una ficha de dominio; devuelve al dueño anterior su ficha, si la había. */
  placeControlMarker(position: Position, player: PlayerId): PlayerId | undefined {
    const node = this.requireNode(position);
    if (!node.isLocation()) {
      throw new Error(`La casilla ${position} no es una localización (solo las bases reciben fichas de dominio).`);
    }
    return node.addControlMarker(player);
  }

  /** Retira la ficha de dominio de una localización; devuelve al dueño anterior. */
  removeControlMarker(position: Position): PlayerId | undefined {
    return this.requireNode(position).removeControlMarker();
  }

  // ── Unidades ─────────────────────────────────────────────────────────────

  /**
   * Coloca una unidad en una casilla vacía del tablero (despliegue o
   * movimiento). No valida reglas de juego (adyacencia, control…), solo la
   * ocupación; las acciones deciden si el movimiento es legal.
   */
  placeUnit(unit: Unit, position: Position): void {
    this.requireNode(position);
    if (this.unitAt(position) !== undefined) {
      throw new Error(`La casilla ${position} ya está ocupada por una unidad.`);
    }
    if (this.units.has(unit)) {
      throw new Error("La unidad ya está en el tablero.");
    }
    unit.position = position;
    this.units.set(unit, unit);
  }

  /** Mueve una unidad ya desplegada a otra casilla vacía. */
  moveUnit(unit: Unit, position: Position): void {
    if (!this.units.has(unit)) {
      throw new Error("La unidad no está en el tablero.");
    }
    this.requireNode(position);
    if (this.unitAt(position) !== undefined) {
      throw new Error(`La casilla ${position} ya está ocupada por una unidad.`);
    }
    unit.position = position;
  }

  /** Retira una unidad del tablero (eliminada tras perder su última moneda). */
  removeUnit(unit: Unit): void {
    this.units.delete(unit);
  }

  /** Unidad en una casilla (normalmente 0 o 1). */
  unitAt(position: Position): Unit | undefined {
    for (const unit of this.units.keys()) {
      if (unit.position === position) return unit;
    }
    return undefined;
  }

  getUnitsAt(position: Position): Unit[] {
    return [...this.units.keys()].filter((unit) => unit.position === position);
  }

  getAllUnits(): Unit[] {
    return [...this.units.keys()];
  }

  getUnitsByPlayer(player: PlayerId): Unit[] {
    return this.getAllUnits().filter((unit) => unit.owner === player);
  }

  /** La unidad desplegada del tipo y jugador indicados (si existe). */
  findUnit(owner: PlayerId, type: UnitType): Unit | undefined {
    return this.getAllUnits().find((unit) => unit.owner === owner && unit.type === type);
  }

  /** Casillas (libres o no) ocupadas por unidades de un jugador. */
  getUnitPositions(player: PlayerId): Position[] {
    return this.getUnitsByPlayer(player).map((unit) => unit.position);
  }

  private requireNode(position: Position): BoardNode {
    const node = this.nodes.get(position);
    if (node === undefined) {
      throw new Error(`La casilla ${position} no existe en el tablero.`);
    }
    return node;
  }
}
