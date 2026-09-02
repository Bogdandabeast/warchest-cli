/**
 * setup-draft.ts
 *
 * Configuración interactiva de partida 1v1 (spec §4.1, ciclo 2):
 *  1. Reparte 8 cartas de unidad al azar de las 16.
 *  2. Draft en el patrón 1-2-2-2-1 (empieza player1 = Lobos; player2 = Cuervos
 *     elige segundo y recibe la iniciativa de la primera ronda).
 *  3. Tras el draft, monta las bolsas (moneda real + 2 monedas por tipo a la
 *     bolsa; el resto a la reserva), coloca las 2 fichas de dominio iniciales
 *     de cada jugador sobre sus bases, y muestra el resumen.
 *
 * El robo de las 3 monedas iniciales y las rondas de juego llegan en ciclos
 * posteriores (spec §4.2 y §3.5).
 *
 * Uso:
 *   bun run setup-draft
 */

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import type { Interface } from "node:readline";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { DraftSession, configureGame, dealDraftCards } from "../domain/game-setup.ts";
import { UNIT_NAMES, UNIT_TOTAL_COINS } from "../domain/units.ts";
import type { UnitType } from "../domain/units.ts";
import { FACTION_NAMES } from "../domain/player.ts";
import type { PlayerId } from "../domain/types.ts";

/**
 * Lee una línea del usuario desde la terminal (callback API: funciona en TTY
 * y con pipes). Si la interfaz se cierra mientras se espera, resuelve con
 * vacío para no dejar la promesa colgada.
 */
export function prompt(rl: Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    const onClose = () => resolve("");
    rl.once("close", onClose);
    rl.question(question, (answer) => {
      rl.removeListener("close", onClose);
      resolve(answer.trim());
    });
  });
}

/** Muestra las cartas disponibles numeradas y pide la elección. */
async function pickCard(
  rl: Interface,
  draft: DraftSession,
): Promise<UnitType> {
  const playerId = draft.currentPlayer!;
  const lot = draft.currentLot;
  console.log(`\n${FACTION_NAMES[playerId]} (${playerId}) — carta ${lot.picked + 1} de ${lot.total}.`);
  console.log("Cartas disponibles:");
  draft.available.forEach((type, i) => {
    console.log(`  ${i + 1}. ${UNIT_NAMES[type]}  (${UNIT_TOTAL_COINS[type]} monedas)`);
  });

  for (;;) {
    const input = await prompt(rl, `Elige una carta (1-${draft.available.length}): `);
    const index = Number.parseInt(input, 10) - 1;
    const type = draft.available[index];
    if (type === undefined) {
      console.log("Número inválido. Intenta de nuevo.");
      continue;
    }
    try {
      draft.pick(playerId, type);
      return type;
    } catch (error) {
      console.log(error instanceof Error ? error.message : String(error));
    }
  }
}

/**
 * Ejecuta el draft interactivo completo (patrón 1-2-2-2-1) sobre la interfaz
 * dada y devuelve las cartas elegidas por cada jugador (4 por jugador).
 */
export async function runDraft(rl: Interface): Promise<Record<PlayerId, readonly UnitType[]>> {
  const draft = new DraftSession(dealDraftCards());
  console.log(`\nSe reparten ${draft.available.length} cartas de unidad al azar (draft 1-2-2-2-1, empieza ${FACTION_NAMES.player1}).`);

  while (!draft.isComplete) {
    const type = await pickCard(rl, draft);
    console.log(`  ✓ ${UNIT_NAMES[type]} elegida.`);
  }
  return draft.results;
}

/** Ejecuta la configuración interactiva completa y muestra el resumen. */
export async function runSetupDraft(): Promise<void> {
  const board = await new SVGBoardLoader().load();
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("── War Chest 1v1 — configuración de partida ──");
  console.log(
    `Tablero cargado: ${board.size} casillas, ${board.getLocations().length} localizaciones`
    + ` (bases de ${FACTION_NAMES.player1}: ${board.getStartLocations("player1").join(", ")}; `
    + `bases de ${FACTION_NAMES.player2}: ${board.getStartLocations("player2").join(", ")}).`,
  );

  try {
    const chosen = await runDraft(rl);
    const config = configureGame(board, chosen);

    console.log("\n── Resumen de la partida ──");
    for (const player of [config.player1, config.player2]) {
      console.log(`\n${player.factionName} (${player.id})`);
      console.log(`  Unidades: ${player.unitCards.map((t) => UNIT_NAMES[t]).join(", ")}`);
      console.log(`  Bolsa (${player.bag.total()} monedas): moneda real + 2 por tipo.`);
      console.log(
        `  Reserva: ${player.unitCards
          .map((t) => `${UNIT_NAMES[t]} ×${player.reserve.countUnit(t)}`)
          .join(", ")}`,
      );
      console.log(`  Fichas de dominio iniciales sobre: ${board.getStartLocations(player.id).join(", ")}`);
    }
    console.log(`\nIniciativa de la primera ronda: ${FACTION_NAMES[config.initiative]}.`);
    console.log("\n¡Configuración lista!");
  } finally {
    rl.close();
  }
}

// Ejecución directa como script: `bun run setup-draft`.
if (import.meta.main) {
  await runSetupDraft();
}