/**
 * Registro de eventos de la TUI: una línea legible por cada acción con éxito
 * y por cada evento del motor (p. ej. "CUERVOS: Arquero desplegada en E5.",
 * "LOBOS: Lancero ataca a Caballería.", "CUERVOS: Caballería destruida…").
 *
 * El motor emite mensajes con ids de jugador ("de player2"); aquí se
 * convierten a nombres de facción y se etiqueta cada línea con la facción
 * protagonista para colorearla en la UI.
 */
import type { GameEvent, GameResult } from "../domain/game.ts";
import type { PlayerId } from "../domain/types.ts";
import { FACTION_NAMES } from "../domain/player.ts";

export interface LogEntry {
  /** Facción protagonista de la línea (para colorearla). */
  faction?: PlayerId;
  text: string;
}

/** Límite de caracteres por línea (las muy largas se recortan). */
const MAX_TEXT = 90;

/** Limpia un mensaje del motor: ids de jugador → facción y espacios normales. */
export function cleanLogText(text: string): string {
  const faction = (id: string): string => FACTION_NAMES[id as PlayerId] ?? id;
  return text
    .replace(/\bplayer1\b|\bplayer2\b/g, (id) => faction(id))
    // Tras etiquetar la línea con su facción, "de Lobos"/"de Cuervos"
    // (que venía de "de player1") sobra: "Caballería de Cuervos destruida"
    // → "Caballería destruida" bajo la etiqueta CUERVOS.
    .replace(/ de (Lobos|Cuervos)\b/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_TEXT);
}

/** Convierte un resultado (mensaje + eventos) en líneas del registro. */
export function entriesFromResult(result: GameResult, actor: PlayerId): LogEntry[] {
  const entries: LogEntry[] = [];
  if (result.message.length > 0) entries.push({ faction: actor, text: cleanLogText(result.message) });
  for (const event of result.events) {
    if (event.message.length > 0) entries.push({ faction: event.player, text: cleanLogText(event.message) });
  }
  return entries;
}

/** Etiqueta de facción de una entrada (para el texto plano). */
export function logEntryLabel(entry: LogEntry): string {
  return entry.faction === undefined ? entry.text : `${FACTION_NAMES[entry.faction].toUpperCase()}: ${entry.text}`;
}

export type { GameEvent };
