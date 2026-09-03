import type { Game, GameEvent } from "../domain/game.ts";
import type { Player } from "../domain/player.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import type { Terrain } from "../domain/terrain.ts";
import type { UnitType } from "../domain/units.ts";
import { UnitCoin } from "../domain/coins.ts";

export interface UnitView {
  type: UnitType;
  owner: PlayerId;
  coins: number;
}

export interface PlayerView {
  id: PlayerId;
  faction: string;
  unitCards: readonly UnitType[];
  markersPlaced: number;
  markersTotal: number;
  handHidden?: { count: number };
  reserveHidden?: { count: number };
  hand?: readonly { type: UnitType }[];
  reserve?: Readonly<Partial<Record<UnitType, number>>>;
  /**
   * Monedas DESCARTADAS (jugadas/pasadas), en orden, la última la más
   * reciente. `faceUp` distingue la moneda jugada BOCA ARRIBA (maniobra con
   * su tropa; se ve la cara) de la BOCA ABAJO (pase/iniciativa/reclutar/fin
   * de ronda y moneda Real; se ve el dorso).
   */
  discard?: readonly { type?: UnitType; royal?: true; faceUp: boolean }[];
}

export interface GameStateView {
  board: Readonly<Record<Position, { terrain: Terrain; controlledBy?: PlayerId; unit?: UnitView; neighbors?: readonly Position[] }>>;
  players: { player1: PlayerView; player2: PlayerView };
  localPlayer: PlayerId;
  currentPlayer: PlayerId;
  initiative: PlayerId;
  round: number;
  phase: string;
  hand: readonly { type?: UnitType; royal?: true }[];
  reserve: Readonly<Partial<Record<UnitType, number>>>;
  markers: Readonly<Record<PlayerId, number>>;
  pendingFreeManeuvers: readonly { unitType: UnitType; kind: string }[];
  lastEvents: readonly string[];
  winner?: PlayerId;
}

const UNIT_TYPES: readonly UnitType[] = [
  "alferez", "arquero", "ballestero", "caballeria", "caballeria-ligera", "caballero",
  "clerigo", "espadachin", "explorador", "guardia-real", "guerrero", "infanteria",
  "lancero", "mariscal", "mercenario", "piquero",
];

function reserveView(game: Game, playerId: PlayerId): Record<UnitType, number> {
  const reserve = {} as Record<UnitType, number>;
  for (const type of UNIT_TYPES) reserve[type] = game.player(playerId).reserve.countUnit(type);
  return reserve;
}

/** Monedas del descarte con su orientación (cara visible o dorso). */
function discardView(player: Player): readonly { type?: UnitType; royal?: true; faceUp: boolean }[] {
  return player.discard.entries().map((record): { type?: UnitType; royal?: true; faceUp: boolean } =>
    record.royal === true ? { royal: true, faceUp: record.faceUp } : { type: record.type, faceUp: record.faceUp },
  );
}

function playerView(game: Game, id: PlayerId, localPlayer: PlayerId): PlayerView {
  const player = game.player(id);
  const view: PlayerView = {
    id,
    faction: player.factionName,
    unitCards: [...player.unitCards],
    markersPlaced: game.countPlacedMarkers(id),
    markersTotal: player.controlMarkers,
    // El descarte se ve boca arriba para AMBOS jugadores (decisión del
    // usuario: zona donde se ven las monedas que se han jugado).
    discard: discardView(player),
  };
  if (id === localPlayer) {
    view.hand = player.hand.toArray().flatMap((coin) => coin instanceof UnitCoin ? [{ type: coin.type }] : []);
    view.reserve = reserveView(game, id);
  } else {
    view.handHidden = { count: player.hand.total() };
    view.reserveHidden = { count: player.reserve.total() };
  }
  return view;
}

export function projectGame(game: Game, localPlayer: PlayerId = game.currentPlayer, events: readonly GameEvent[] = []): GameStateView {
  const board: Record<Position, { terrain: Terrain; controlledBy?: PlayerId; unit?: UnitView; neighbors?: readonly Position[] }> = {};
  for (const node of game.board.getAllNodes()) {
    const unit = game.board.unitAt(node.id);
    board[node.id] = {
      terrain: node.terrain,
      ...(node.controlledBy === undefined ? {} : { controlledBy: node.controlledBy }),
      ...(unit === undefined ? {} : { unit: { type: unit.type, owner: unit.owner, coins: unit.coins } }),
      neighbors: node.neighbors,
    };
  }
  const local = game.player(localPlayer);
  const hand = local.hand.toArray().map((coin) => coin instanceof UnitCoin ? { type: coin.type } : { royal: true as const });
  return {
    board,
    players: { player1: playerView(game, "player1", localPlayer), player2: playerView(game, "player2", localPlayer) },
    localPlayer,
    currentPlayer: game.currentPlayer,
    initiative: game.initiative,
    round: game.round,
    phase: game.phase,
    hand,
    reserve: reserveView(game, localPlayer),
    markers: { player1: game.countPlacedMarkers("player1"), player2: game.countPlacedMarkers("player2") },
    pendingFreeManeuvers: game.pendingFreeManeuvers.map((maneuver) => ({ unitType: maneuver.unit.type, kind: maneuver.kind })),
    lastEvents: events.map((event) => event.message),
    ...(game.winner === undefined ? {} : { winner: game.winner }),
  };
}
