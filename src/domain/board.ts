import type { PlayerId, Position } from "./types.ts";

export interface BoardNodeOptions {
  id: Position;
  x: number;
  y: number;
  neighbors?: readonly Position[];
  /**
   * Si la casilla es una base (localización de inicio) de un jugador
   * (los 4 hexágonos amarillos/morados dentro de la zona verde del playmat).
   */
  startZone?: PlayerId;
}

/**
 * Celda del tablero (spec §3.2.1).
 *
 * Por ahora solo modela geometría: id, coordenadas para UI, vecinos y, si
 * aplica, la base de inicio de un jugador. Los marcadores de dominio
 * (`controlledBy`/`controlMarkers`) y las unidades llegan en ciclos
 * posteriores (ver DECISIONS.md).
 */
export class BoardNode {
  readonly id: Position;
  readonly x: number;
  readonly y: number;
  readonly neighbors: readonly Position[];
  readonly startZone?: PlayerId;

  constructor(options: BoardNodeOptions) {
    if (options.neighbors?.includes(options.id)) {
      throw new Error(`Una casilla no puede ser vecina de sí misma: ${options.id}`);
    }
    this.id = options.id;
    this.x = options.x;
    this.y = options.y;
    this.neighbors = (options.neighbors ?? []).slice();
    this.startZone = options.startZone;
  }

  /** ¿Es una base (localización de inicio) de algún jugador? */
  isStartZone(): boolean {
    return this.startZone !== undefined;
  }
}

/**
 * Tablero: agregado que contiene todas las casillas indexadas por `Position`
 * (spec §3.2.2). Se construye a partir de un `BoardLoader`.
 */
export class Board {
  private readonly nodes: Map<Position, BoardNode>;

  constructor(nodes: Iterable<BoardNode>) {
    this.nodes = new Map();
    for (const node of nodes) {
      if (this.nodes.has(node.id)) {
        throw new Error(`Casilla duplicada en el tablero: ${node.id}`);
      }
      this.nodes.set(node.id, node);
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

  /** Bases (localizaciones de inicio) de un jugador, ordenadas por id. */
  getStartLocations(player: PlayerId): Position[] {
    return this.getAllNodes()
      .filter((node) => node.startZone === player)
      .map((node) => node.id)
      .sort();
  }
}