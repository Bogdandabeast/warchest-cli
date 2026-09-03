import { useKeyboard, useRenderer } from "@opentui/react";
import { useMemo, useRef, useState } from "react";
import { SVGBoardLoader } from "../infrastructure/svg-board-loader.ts";
import { DraftSession, configureGame, dealDraftCards } from "../domain/game-setup.ts";
import { Game } from "../domain/game.ts";
import type { FreeManeuver, GameEvent, GameResult } from "../domain/game.ts";
import type { PlayerId, Position } from "../domain/types.ts";
import type { UnitType } from "../domain/units.ts";
import { projectGame, type GameStateView } from "./engine-view.ts";
import { BOARD_VARIANT_SCALES, PREVIEW_START_INDEX } from "./board-images.ts";
import { viableActions, type MenuAction } from "./menu-viability.ts";
import { freeKindLabel, freeRequest, grantLabel, grantsForPlayer, kindsForFreeGrant, type FreeKind } from "./free-maneuver.ts";
import { abilityStep, abilityStepPositions, popAbilityToken, type AbilityToken } from "./ability-flow.ts";
import type { AbilityRequest } from "../domain/abilities.ts";
import { entriesFromResult, type LogEntry } from "./log.ts";
import { COLORS } from "./theme.ts";
import { BoardView } from "./views/board.tsx";
import { DraftView } from "./views/draft.tsx";
import { MenuView } from "./views/menu.tsx";
import { HandView } from "./views/hand.tsx";
import { DiscardView } from "./views/discard.tsx";
import { MessageView } from "./views/message.tsx";
import { GalleryView } from "./views/gallery.tsx";
import { BoardPreviewView } from "./views/board-preview.tsx";
import { TitleView } from "./views/title.tsx";
import { TurnView } from "./views/turn.tsx";
import { VictoryView } from "./views/victory.tsx";
import { TargetingView } from "./views/targeting.tsx";
import { LogView } from "./views/log.tsx";
import { ownUnitPositions, targetPositions, cursorStep } from "./targeting.ts";

type Mode = "gallery" | "board-preview" | "title" | "draft" | "turn" | "coin" | "action" | "targeting" | "attack-source" | "recruit" | "victory" | "free-maneuver" | "ability" | "log";

/**
 * Contrato de la UI con el motor (estable, por INTENCIÓN): las acciones de
 * dominio reciben un solo objeto de callbacks en vez de reenviar decenas de
 * setters de React, y la UI decide cómo reaccionar (proyectar, loguear,
 * cambiar de pantalla…).
 */
interface DomainCallbacks {
  /** La partida quedó creada (tras el draft): guarda la instancia del motor. */
  onGameStarted: (game: Game) => void;
  /** Proyecta el snapshot del estado actual del motor (events = últimos eventos). */
  refresh: (game: Game, events?: readonly GameEvent[]) => void;
  /** Muestra un mensaje en la ventana de mensajes (`error` = línea roja). */
  onMessage: (message: string, error?: boolean) => void;
  /** Añade líneas al registro de eventos. */
  pushLog: (entries: readonly LogEntry[]) => void;
  /** Cambia el modo de la UI. */
  setMode: (mode: Mode) => void;
  /** Revela el cambio de turno con los datos actuales del motor. */
  onTurnChange: (game: Game) => void;
  /** Error de carga/dominio: mensaje y vuelta a un modo navegable. */
  onError: (message: string) => void;
}

/** Mueve la selección de monedas/acciones con ← →, clavada en los bordes. */
export function moveActionSelection(current: number, direction: "left" | "right", count: number): number {
  if (count === 0) return 0;
  return direction === "left" ? Math.max(0, current - 1) : Math.min(count - 1, current + 1);
}

/**
 * Mensaje de la zona de acciones cuando no hay ninguna opción viable (vacío =
 * se muestra el menú de acciones). Lo usa App; expuesto para los tests.
 */
export function noActionsMessageFor(handLength: number, actionCount: number): string {
  if (handLength === 0) return "No tienes monedas disponibles. Esc para volver o retírate.";
  if (actionCount === 0) return "Esta moneda no permite ninguna acción ahora. Escoge otra moneda.";
  return "";
}

/** Paso del flujo de maniobras gratis (atributos I: Mercenario, Espadachín, Guerrero). */
interface FreeManeuverFlow {
  step: "grants" | "kinds" | "target";
  grants: readonly FreeManeuver[];
  grantIndex: number;
  kinds: readonly FreeKind[];
  kindIndex: number;
  kind?: FreeKind;
  /** Resultado de la acción que concedió la maniobra (para avanzar el turno al terminar). */
  base: GameResult;
  /** Eventos acumulados (acción original + maniobras gratis ejecutadas). */
  events: GameEvent[];
}

function emptyView(): GameStateView {
  return { board: {}, players: { player1: { id: "player1", faction: "Lobos", unitCards: [], markersPlaced: 0, markersTotal: 6, discard: [] }, player2: { id: "player2", faction: "Cuervos", unitCards: [], markersPlaced: 0, markersTotal: 6, discard: [] } }, localPlayer: "player1", currentPlayer: "player1", initiative: "player2", round: 1, phase: "setup", hand: [], reserve: {}, markers: { player1: 0, player2: 0 }, pendingFreeManeuvers: [], lastEvents: [] };
}

function coinLabel(view: GameStateView, index: number): string {
  const coin = view.hand[index];
  return coin?.royal ? "moneda real" : coin?.type ?? "moneda";
}

function actionsForCoin(view: GameStateView, coinIndex: number, game?: Game): MenuAction[] {
  // viableActions decide por sí solo (moneda real, mano vacía → Retirarse, etc.).
  return viableActions(view, coinIndex, game);
}

export function App() {
  const renderer = useRenderer();
  // Referencias al MOTOR (Game/DraftSession) con ciclo de vida por montaje de
  // App — NUNCA módulo-global: cada montaje de <App/> tiene su partida aislada.
  // El estado de React (view/mode/…) es el que dispara los renders; estas
  // refs solo guardan las instancias mutables del dominio.
  const gameRef = useRef<Game | undefined>(undefined);
  const [mode, setMode] = useState<Mode>("gallery");
  const [draft, setDraft] = useState<DraftSession>();
  const [view, setView] = useState<GameStateView>(emptyView);
  const [selected, setSelected] = useState(0);
  const [selectedCoin, setSelectedCoin] = useState(0);
  const [message, setMessage] = useState("Pulsa Enter para comenzar.");
  const [messageError, setMessageError] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [targetAction, setTargetAction] = useState<MenuAction>();
  const [targetUnit, setTargetUnit] = useState<string>();
  const [recruitIndex, setRecruitIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [galleryPage, setGalleryPage] = useState(0);
  const [attackReserve, setAttackReserve] = useState(false);
  // Pantalla de cambio de turno / revelación (ficha de control del siguiente jugador).
  const [turnPlayer, setTurnPlayer] = useState<PlayerId>("player1");
  const [turnRound, setTurnRound] = useState(1);
  const [turnInitiative, setTurnInitiative] = useState(false);
  // Asistente de tácticas (acción "Usar habilidad" de las 9 unidades activables).
  const [abilityUnitPos, setAbilityUnitPos] = useState<Position>();
  const [abilityTokens, setAbilityTokens] = useState<AbilityToken[]>([]);
  const [abilityIndex, setAbilityIndex] = useState(0);
  // Flujo de maniobras gratis (atributos I: Mercenario al reclutar, Espadachín al atacar, cadena del Guerrero).
  const [fmGrants, setFmGrants] = useState<FreeManeuver[]>([]);
  const [fmGrantIndex, setFmGrantIndex] = useState(0);
  const [fmKinds, setFmKinds] = useState<FreeKind[]>([]);
  const [fmKindIndex, setFmKindIndex] = useState(0);
  const [fmKind, setFmKind] = useState<FreeKind>();
  const [fmStep, setFmStep] = useState<"grants" | "kinds" | "target">("grants");
  const [fmBase, setFmBase] = useState<GameResult>();
  const [fmEvents, setFmEvents] = useState<GameEvent[]>([]);
  // Registro de eventos de la partida (acciones con éxito + eventos del motor).
  const [log, setLog] = useState<LogEntry[]>([]);
  const pushLog = (entries: readonly LogEntry[]): void => {
    if (entries.length === 0) return;
    setLog((previous) => [...previous, ...entries].slice(-200));
  };
  const actions = useMemo(() => actionsForCoin(view, selectedCoin, gameRef.current), [view, selectedCoin, gameRef.current]);
  const activeHand = view.hand;
  const noActionsMessage = noActionsMessageFor(activeHand.length, actions.length);

  const currentGame = gameRef.current;
  const recruitPlayerId = currentGame?.currentPlayer;
  // Tipos de tropa de la reserva reclutables AHORA: un único cálculo (memo)
  // compartido entre el handler de teclado y el render de la pantalla de
  // reclutamiento (recruitIndex se resetea al entrar en esa pantalla).
  const reserveTypes = useMemo(() => {
    if (currentGame === undefined || recruitPlayerId === undefined) return [];
    const player = currentGame.player(recruitPlayerId);
    return player.unitCards.filter((type) => player.reserve.countUnit(type) > 0);
  }, [currentGame, recruitPlayerId]);

  /** Callbacks de dominio: cómo reacciona la UI a cada evento del motor. */
  const domainCallbacks: DomainCallbacks = {
    onGameStarted: (game) => { gameRef.current = game; },
    refresh: (game, events = []) => setView(projectGame(game, game.currentPlayer, events)),
    onMessage: (message, error = false) => { setMessageError(error); setMessage(message); },
    pushLog,
    setMode,
    onTurnChange: (game) => {
      setTurnPlayer(game.currentPlayer);
      setTurnRound(game.round);
      setTurnInitiative(game.initiative === game.currentPlayer);
      setMode("turn");
    },
    onError: (message) => { setMessageError(true); setMessage(message); setMode("title"); },
  };

  const refresh = (events: Parameters<typeof projectGame>[2] = []) => { if (gameRef.current) setView(projectGame(gameRef.current, gameRef.current.currentPlayer, events)); };

  /** Muestra la pantalla de cambio de turno con la ficha del siguiente jugador. */
  const showTurnChange = (): void => {
    if (!gameRef.current) { setMode("coin"); return; }
    setTurnPlayer(gameRef.current.currentPlayer);
    setTurnRound(gameRef.current.round);
    setTurnInitiative(gameRef.current.initiative === gameRef.current.currentPlayer);
    setMode("turn");
  };

  const advanceAfterAction = (result: GameResult): void => {
    if (!gameRef.current || !result.success) return;
    if (gameRef.current.winner) {
      setView(projectGame(gameRef.current, gameRef.current.currentPlayer, result.events));
      setMode("victory");
      return;
    }
    if (gameRef.current.player("player1").hand.isEmpty() && gameRef.current.player("player2").hand.isEmpty()) {
      // Ambas manos vacías: no queda ninguna acción posible en la ronda. Se
      // cierra con la API del dominio (retirarse = pasar sin moneda, alterna
      // el turno al rival), SIN escribir `passed` a mano desde la capa de
      // presentación.
      gameRef.current.retire(gameRef.current.currentPlayer);
      gameRef.current.retire(gameRef.current.currentPlayer);
      const ended = gameRef.current.endRound();
      const started = gameRef.current.startRound();
      const actor = gameRef.current.currentPlayer;
      pushLog([...entriesFromResult(ended, actor), ...entriesFromResult(started, actor)]);
      setMessage(started.success ? started.message : ended.message);
      setView(projectGame(gameRef.current, gameRef.current.currentPlayer, started.success ? started.events : result.events));
      showTurnChange();
      return;
    }
    gameRef.current.nextTurn();
    refresh(result.events);
    showTurnChange();
  };

  /**
   * Termina la acción con éxito: victoria, maniobra(s) gratis pendientes o,
   * si no hay ninguna, fin de turno normal. Los atributos (I) conceden la
   * maniobra ANTES de pasar el turno (igual que `bun run play`).
   */
  const afterActionSuccess = (result: GameResult): void => {
    const game = gameRef.current;
    if (!game || !result.success) return;
    pushLog(entriesFromResult(result, game.currentPlayer));
    refresh(result.events);
    if (game.winner) {
      setView(projectGame(game, game.currentPlayer, result.events));
      setMode("victory");
      return;
    }
    // Solo ofrecemos concesiones con alguna maniobra viable AHORA; el resto
    // (p. ej. un Guerrero rodeado) se ignora y el turno avanza igual.
    const freshView = projectGame(game, game.currentPlayer, result.events);
    const grants = grantsForPlayer(game, game.currentPlayer).filter((g) => kindsForFreeGrant(freshView, game.currentPlayer, g).length > 0);
    if (grants.length === 0) {
      advanceAfterAction(result);
      return;
    }
    setFmBase(result);
    setFmEvents([...result.events]);
    setFmGrants(grants);
    setFmGrantIndex(0);
    setFmStep("grants");
    const only = grants[0];
    setMessage(grants.length === 1 && only ? `${grantLabel(only)}: Enter usarla · Esc terminar tu turno.` : "Maniobra gratis: elige una con Enter · Esc terminar tu turno.");
    setMode("free-maneuver");
  };

  /** Cierra el flujo de maniobras gratis y avanza el turno con los eventos acumulados. */
  const endFreeManeuverPhase = (events: GameEvent[] = fmEvents): void => {
    const game = gameRef.current;
    const base = fmBase;
    if (!game || !base) {
      setMode("coin");
      return;
    }
    setFmBase(undefined);
    setFmGrants([]);
    setFmStep("grants");
    setFmGrantIndex(0);
    if (game.winner) {
      setView(projectGame(game, game.currentPlayer, events));
      setMode("victory");
      return;
    }
    advanceAfterAction({ ...base, events });
  };

  useKeyboard((key) => {
    if (key.name === "q") { renderer.destroy(); return; }
    if (mode === "turn" && key.name === "return") { setMode("coin"); return; }
    if (mode === "turn") return;
    if (mode === "log" && (key.name === "return" || key.name === "escape")) { setMode("coin"); setMessage("Elige una de tus monedas."); return; }
    if (mode === "log") return;
    if (mode === "gallery" && key.name === "return") { setMode("title"); return; }
    if (mode === "gallery" && key.name === "escape") { setMode("title"); return; }
    if (mode === "gallery" && (key.name === "left" || key.name === "right")) { setGalleryPage((page: number) => (page + (key.name === "left" ? 2 : 1)) % 3); return; }
    if (mode === "gallery" && key.name === "b") { setPreviewIndex(PREVIEW_START_INDEX); setMode("board-preview"); return; }
    if (mode === "board-preview") {
      if (key.name === "left") setPreviewIndex((index: number) => Math.max(0, index - 1));
      if (key.name === "right") setPreviewIndex((index: number) => Math.min(BOARD_VARIANT_SCALES.length - 1, index + 1));
      if (key.name === "escape" || key.name === "return") setMode("gallery");
      return;
    }
    if (mode === "title" && key.name === "return") { const session = new DraftSession(dealDraftCards()); setDraft(session); setMode("draft"); setSelected(0); return; }
    if (mode === "draft" && draft) {
      if (key.name === "left") setSelected((index: number) => Math.max(0, index - 1));
      if (key.name === "right") setSelected((index: number) => Math.min(draft.available.length - 1, index + 1));
      if (key.name === "return") { const type = draft.available[selected]; const player = draft.currentPlayer; if (!type || !player) return; draft.pick(player, type); setSelected(0); if (draft.isComplete) void finishDraft(draft, domainCallbacks); else { setDraft(draft); setMessage(`Turno de ${draft.currentPlayer === "player1" ? "Lobos" : "Cuervos"}.`); } }
      return;
    }
    if (mode === "victory" && key.name === "return") { setMode("title"); return; }
    if (mode === "free-maneuver" && gameRef.current && fmGrants.length > 0) {
      const player = gameRef.current.currentPlayer;
      const grant = fmGrants[fmGrantIndex];
      if (fmStep === "grants") {
        if (key.name === "left") setFmGrantIndex((i: number) => Math.max(0, i - 1));
        if (key.name === "right") setFmGrantIndex((i: number) => Math.min(Math.max(0, fmGrants.length - 1), i + 1));
        if (key.name === "escape") { endFreeManeuverPhase(); return; }
        if (key.name === "return" && grant) {
          const kinds = kindsForFreeGrant(view, player, grant);
          if (kinds.length === 0) { setMessageError(true); setMessage("La unidad de la maniobra gratis no tiene ningún movimiento posible ahora."); return; }
          if (kinds.length === 1) { setFmKind(kinds[0]); setTargetIndex(0); setFmStep("target"); }
          else { setFmKinds(kinds); setFmKindIndex(0); setFmStep("kinds"); }
        }
        return;
      }
      if (fmStep === "kinds") {
        if (key.name === "left") setFmKindIndex((i: number) => Math.max(0, i - 1));
        if (key.name === "right") setFmKindIndex((i: number) => Math.min(Math.max(0, fmKinds.length - 1), i + 1));
        if (key.name === "escape") { setFmStep("grants"); setMessage("Elige concesión con Enter · Esc terminar tu turno."); return; }
        if (key.name === "return") { const kind = fmKinds[fmKindIndex]; if (kind) { setFmKind(kind); setTargetIndex(0); setFmStep("target"); } }
        return;
      }
      // Paso objetivo: elegir destino/objetivo de la maniobra gratis.
      const kind = fmKind ?? "move";
      const unitPos = grant?.unit.position;
      const targets = unitPos ? targetPositions(view, player, kind, unitPos) : [];
      if (key.name === "left") setTargetIndex((i: number) => cursorStep(targets, i, -1));
      if (key.name === "right") setTargetIndex((i: number) => cursorStep(targets, i, 1));
      if (key.name === "escape") { setFmStep("kinds"); setMessage("Elige qué maniobra gratis hacer · Esc terminar tu turno."); return; }
      if (key.name === "return" && grant) {
        const target = targets[targetIndex];
        if (target === undefined) { setMessageError(true); setMessage("No hay objetivo válido para la maniobra gratis."); return; }
        const request = freeRequest(grant, kind, kind === "control" ? unitPos : target);
        if (!request) { setMessageError(true); setMessage("No se pudo preparar la maniobra gratis."); return; }
        const result = gameRef.current.executeFreeManeuver(player, request);
        setMessageError(!result.success); setMessage(result.message);
        if (result.success) {
          pushLog(entriesFromResult(result, player));
          const events = [...fmEvents, ...result.events];
          setFmEvents(events);
          if (gameRef.current.winner) { setView(projectGame(gameRef.current, player, events)); setMode("victory"); return; }
          refresh(result.events);
          // ¿Quedan más concesiones (p. ej. la cadena del Guerrero)?
          const remaining = grantsForPlayer(gameRef.current, player).filter((g) => kindsForFreeGrant(projectGame(gameRef.current!, player, events), player, g).length > 0);
          if (remaining.length === 0) { endFreeManeuverPhase(events); return; }
          setFmGrants(remaining);
          setFmGrantIndex(0);
          setFmKinds([]);
          setFmStep("grants");
          setMessage("Puedes encadenar otra maniobra gratis (Enter) o terminar tu turno (Esc).");
        }
      }
      return;
    }
    if (mode === "coin") {
      if (key.name === "l") { setMode("log"); return; }
      if (key.name === "left") setSelectedCoin((index: number) => moveActionSelection(index, "left", view.hand.length));
      if (key.name === "right") setSelectedCoin((index: number) => moveActionSelection(index, "right", view.hand.length));
      if (key.name === "escape") { setMessage("Elige una de tus monedas."); return; }
      if (key.name === "return") { setSelected(0); setMode("action"); setMessage(`Has elegido ${coinLabel(view, selectedCoin)}. Ahora elige qué hacer.`); }
      return;
    }
    if (mode === "recruit" && gameRef.current) {
      const player = gameRef.current.currentPlayer;
      if (key.name === "left") setRecruitIndex((index: number) => moveActionSelection(index, "left", reserveTypes.length));
      if (key.name === "right") setRecruitIndex((index: number) => moveActionSelection(index, "right", reserveTypes.length));
      if (key.name === "escape") { setMode("action"); setMessage("Elige otra acción para la moneda."); return; }
      if (key.name === "return") {
        const reserveType = reserveTypes[recruitIndex];
        const coin = gameRef.current.player(player).hand.toArray()[selectedCoin];
        if (!reserveType || !coin) { setMessageError(true); setMessage("No hay una tropa disponible para reclutar."); return; }
        // Narrowing por propiedad `type` (como executeTargetAction): la rama
        // de tropa solo existe si la moneda lleva `type` (UnitCoin); la Real
        // no → descarte royal. Sin casts dobles intermedios.
        const discard = "type" in coin
          ? { kind: "unit" as const, unitType: coin.type as UnitType }
          : { kind: "royal" as const };
        const result = gameRef.current.recruit(player, discard, reserveType);
        setMessageError(!result.success); setMessage(result.success ? `${result.message} Se descartan ambas monedas.` : result.message);
        if (result.success) { afterActionSuccess(result); setRecruitIndex(0); }
      }
      return;
    }
    if (mode === "attack-source" && gameRef.current) {
      if (key.name === "escape") { setMode("targeting"); return; }
      if (key.name === "left" || key.name === "right") setAttackReserve((value: boolean) => !value);
      if (key.name === "return") {
        const attacker = targetUnit ? gameRef.current.board.unitAt(targetUnit) : undefined;
        const target = targetPositions(view, gameRef.current.currentPlayer, "attack", targetUnit)[targetIndex];
        if (!attacker || !target) { setMessageError(true); setMessage("No hay un objetivo válido para atacar."); return; }
        const result = executeTargetAction("attack", gameRef.current.currentPlayer, selectedCoin, targetUnit, target, gameRef.current, attackReserve);
        setMessageError(!result.success); setMessage(result.message);
        if (result.success) { afterActionSuccess(result); setTargetAction(undefined); setAttackReserve(false); }
      }
      return;
    }
    if (mode === "ability" && gameRef.current && abilityUnitPos) {
      const player = gameRef.current.currentPlayer;
      const unit = gameRef.current.board.unitAt(abilityUnitPos);
      if (unit === undefined) { setMode("action"); return; }
      const progress = abilityStep(gameRef.current, player, unit, abilityTokens);
      // La secuencia ya está completa: queda una petición pendiente. Esc la
      // CANCELA (vuelve al menú sin ejecutar); cualquier otra tecla ejecuta y
      // limpia el asistente SIEMPRE (éxito o fallo) para que las teclas
      // siguientes no reintenten solas.
      if ("request" in progress) {
        if (key.name === "escape") {
          setAbilityTokens([]);
          setAbilityUnitPos(undefined);
          setMode("action");
          setMessage("Táctica cancelada. Elige otra acción.");
          return;
        }
        const result = gameRef.current.executeManeuver(player, { kind: "ability", unitType: unit.type, params: progress.request, unitPos: unit.position });
        setAbilityTokens([]);
        setAbilityUnitPos(undefined);
        setMessageError(!result.success); setMessage(result.message);
        if (result.success) { afterActionSuccess(result); }
        else setMode("action");
        return;
      }
      const options = progress.step.options;
      if (key.name === "left") setAbilityIndex((index: number) => Math.max(0, index - 1));
      if (key.name === "right") setAbilityIndex((index: number) => Math.min(Math.max(0, options.length - 1), index + 1));
      if (key.name === "escape") {
        if (abilityTokens.length > 0) {
          setAbilityTokens([...popAbilityToken(abilityTokens)]);
          setAbilityIndex(0);
        } else { setAbilityTokens([]); setAbilityUnitPos(undefined); setMode("action"); setMessage("Elige otra acción o cancela con Esc."); }
        return;
      }
      if (key.name === "return") {
        const option = options[abilityIndex];
        if (option === undefined) {
          setMessageError(true); setMessage("Esta habilidad no tiene opciones ahora: usa Esc para retroceder.");
          return;
        }
        const nextTokens = [...abilityTokens, option.token];
        const nextProgress = abilityStep(gameRef.current, player, unit, nextTokens);
        if ("request" in nextProgress) {
          const result = gameRef.current.executeManeuver(player, { kind: "ability", unitType: unit.type, params: nextProgress.request, unitPos: unit.position });
          // Limpieza SIEMPRE tras ejecutar: sin tokens pendientes no hay
          // reintento automático en eventos de teclado posteriores.
          setAbilityTokens([]);
          setAbilityUnitPos(undefined);
          setMessageError(!result.success); setMessage(result.message);
          if (result.success) { afterActionSuccess(result); }
          else setMode("action");
        } else {
          setAbilityTokens(nextTokens);
          setAbilityIndex(0);
          setMessage(nextProgress.step.title);
        }
      }
      return;
    }
    if (mode === "targeting" && gameRef.current && targetAction) {
      const targets = targetPositions(view, gameRef.current.currentPlayer, targetAction, targetUnit, view.hand[selectedCoin]?.type);
      if (key.name === "left") setTargetIndex((index: number) => cursorStep(targets, index, -1));
      if (key.name === "right") setTargetIndex((index: number) => cursorStep(targets, index, 1));
      if (key.name === "escape") { setMode("action"); setMessage("Elige otra acción o cancela con Esc."); return; }
      if (key.name === "return" && targets[targetIndex]) {
        if (targetAction === "attack" && gameRef.current.board.unitAt(targets[targetIndex])?.type === "guardia-real") {
          setAttackReserve(false); setMode("attack-source"); setMessage("Guardia Real: elige dónde quitar la moneda."); return;
        }
        const result = executeTargetAction(targetAction, gameRef.current.currentPlayer, selectedCoin, targetUnit, targets[targetIndex], gameRef.current);
        setMessageError(!result.success); setMessage(result.message);
        if (result.success) { afterActionSuccess(result); setTargetAction(undefined); }
        else setMode("action");
      }
      return;
    }
    if (mode === "action" && gameRef.current) {
      if (key.name === "l") { setMode("log"); return; }
      if (key.name === "left") setSelected((index: number) => moveActionSelection(index, "left", actions.length));
      if (key.name === "right") setSelected((index: number) => moveActionSelection(index, "right", actions.length));
      if (key.name === "escape") { setMode("coin"); setMessage("Escoge otra moneda o confirma esta."); return; }
      if (key.name === "return") {
        const action = actions[selected];
        if (!action) return;
        const selectedHandCoin = view.hand[selectedCoin];
        const selectedType = selectedHandCoin?.type;
        const unit = ownUnitPositions(view, gameRef.current.currentPlayer, selectedType)[0];
        if (action === "recruit") { setRecruitIndex(0); setMode("recruit"); setMessage("Elige una de tus tropas en la reserva para reclutar una moneda."); }
        else if (["deploy", "move", "attack", "control"].includes(action)) {
          setTargetAction(action); setTargetUnit(unit); setTargetIndex(0); setMode("targeting"); setMessage(`Selecciona el objetivo para ${action}.`);
        } else if (action === "ability") {
          const player = gameRef.current.currentPlayer;
          const unitPos = ownUnitPositions(view, player, selectedType)[0];
          if (!selectedType || unitPos === undefined || gameRef.current.board.unitAt(unitPos) === undefined) {
            setMessageError(true); setMessage("No hay una unidad tuya de este tipo en el tablero para usar su habilidad.");
            return;
          }
          const progress = abilityStep(gameRef.current, player, gameRef.current.board.unitAt(unitPos)!, []);
          if ("request" in progress || progress.step.options.length === 0) {
            setMessageError(true); setMessage("Esta unidad no tiene ningún blanco válido para su habilidad ahora.");
            return;
          }
          setAbilityUnitPos(unitPos);
          setAbilityTokens([]);
          setAbilityIndex(0);
          setMessage(progress.step.title);
          setMode("ability");
        } else executeAction(action, selectedCoin, gameRef.current!, domainCallbacks);
      }
    }
  });

  if (mode === "gallery") return <GalleryView page={galleryPage} />;
  if (mode === "board-preview") return <BoardPreviewView index={previewIndex} />;
  if (mode === "title") return <TitleView />;
  if (mode === "log") return <LogView entries={log} />;
  if (mode === "draft" && draft) return <DraftView available={draft.available} selected={selected} player={draft.currentPlayer === "player1" ? "Lobos" : "Cuervos"} playerId={draft.currentPlayer} lot={draft.currentLot} chosen={draft.results} />;
  if (mode === "turn") return <TurnView player={turnPlayer} round={turnRound} initiative={turnInitiative} />;
  if (mode === "victory") return <VictoryView faction={view.winner === "player1" ? "Lobos" : "Cuervos"} round={view.round} />;
  if (mode === "recruit" && gameRef.current) {
    return <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background }}><BoardView view={view} hint="PASO 3/3 · elige la tropa de la reserva" /><box style={{ flexDirection: "column", flexGrow: 1, border: true, borderColor: COLORS.accent }}><text fg={COLORS.accent}>RECLUTAR UNA MONEDA</text><text>La moneda elegida de tu mano y la moneda reclutada irán al descarte.</text><box style={{ flexDirection: "row" }}>{reserveTypes.map((type, index) => <box key={`reserve-${type}`} style={{ border: true, borderColor: index === recruitIndex ? COLORS.accent : COLORS.border, width: 26, height: 4 }}><text fg={index === recruitIndex ? COLORS.accent : COLORS.text}>{`${index === recruitIndex ? "▶" : "  "} ${index + 1}. ${type}`}</text><text fg={COLORS.muted}>{`Reserva: ${gameRef.current!.player(gameRef.current!.currentPlayer).reserve.countUnit(type)}`}</text></box>)}</box><text fg={COLORS.muted}>← → elegir tropa · Enter reclutar · Esc volver a acciones</text></box></box>;
  }
  if (mode === "free-maneuver" && gameRef.current && fmGrants.length > 0) {
    const player = gameRef.current.currentPlayer;
    const grant = fmGrants[fmGrantIndex];
    if (fmStep === "target" && grant && fmKind) {
      const targets = targetPositions(view, player, fmKind, grant.unit.position);
      return <TargetingView view={view} action={`maniobra gratis · ${fmKind}`} targets={targets} selected={targetIndex} />;
    }
    const options = fmStep === "kinds" ? fmKinds.map(freeKindLabel) : fmGrants.map(grantLabel);
    const index = fmStep === "kinds" ? fmKindIndex : fmGrantIndex;
    const title = fmStep === "kinds" ? "MANIOBRA GRATIS · ¿QUÉ MANIOBRA HACES?" : "MANIOBRA GRATIS DISPONIBLE";
    const keys = fmStep === "kinds" ? "← → maniobra · Enter confirmar · Esc volver a concesiones" : "← → concesión · Enter elegir · Esc terminar tu turno";
    // La unidad que concede la maniobra (Mercenario/Espadachín/Guerrero) se
    // resalta sobre el tablero oscurecido para ver A QUIÉN vas a mover.
    const grantUnitPos = grant === undefined ? undefined : grant.unit.position;
    return <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background }}>
      <box style={{ flexDirection: "row", flexGrow: 1 }}><BoardView view={view} validTargets={grantUnitPos === undefined ? [] : [grantUnitPos]} cursor={grantUnitPos} hint="MANIOBRA GRATIS · la unidad resaltada puede actuar" dim /></box>
      <box style={{ flexDirection: "column", flexGrow: 1, border: true, borderColor: COLORS.accent }}>
        <text fg={COLORS.accent}>{title}</text>
        {options.map((label, optionIndex) => <text key={label} fg={optionIndex === index ? COLORS.accent : COLORS.text}>{`${optionIndex === index ? "▶" : "  "} ${optionIndex + 1}. ${label.toUpperCase()}`}</text>)}
        <MessageView message={message} error={messageError} />
        <text fg={COLORS.muted}>{keys}</text>
      </box>
    </box>;
  }
  if (mode === "ability" && gameRef.current && abilityUnitPos) {
    const unit = gameRef.current.board.unitAt(abilityUnitPos);
    if (unit !== undefined) {
      const progress = abilityStep(gameRef.current, gameRef.current.currentPlayer, unit, abilityTokens);
      if ("step" in progress) {
        const options = progress.step.options;
        // Paso con SOLO blancos de casilla (Caballería, Caballería ligera,
        // Lancero, Alférez, Arquero, Ballestero, Guardia Real, Mariscal e
        // Infantería) → selección SOBRE EL TABLERO como en desplegar/mover:
        // el tablero se oscurece, brillan las casillas válidas y el cursor
        // salta con ← → (Enter confirma, Esc retrocede token a token).
        const targets = abilityStepPositions(progress);
        if (targets !== null) {
          return <TargetingView view={view} action="habilidad" title={progress.step.title} targets={targets} selected={abilityIndex} />;
        }
        return <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background }}>
          <box style={{ flexDirection: "row", flexGrow: 1 }}><BoardView view={view} hint="USAR HABILIDAD · táctica" /></box>
          <box style={{ flexDirection: "column", flexGrow: 1, border: true, borderColor: COLORS.accent }}>
            <text fg={COLORS.accent}>{progress.step.title}</text>
            {options.map((option, optionIndex) => <text key={`${optionIndex}-${option.label}`} fg={optionIndex === abilityIndex ? COLORS.accent : COLORS.text}>{`${optionIndex === abilityIndex ? "▶" : "  "} ${optionIndex + 1}. ${option.label.toUpperCase()}`}</text>)}
            {options.length === 0 ? <text fg={COLORS.error}>Sin opciones: pulsa Esc para retroceder.</text> : null}
            <MessageView message={message} error={messageError} />
            <text fg={COLORS.muted}>← → opción · Enter confirmar · Esc volver atrás</text>
          </box>
        </box>;
      }
    }
  }
  if (mode === "targeting" && targetAction && gameRef.current) return <TargetingView view={view} action={targetAction} targets={targetPositions(view, gameRef.current.currentPlayer, targetAction, targetUnit, view.hand[selectedCoin]?.type)} selected={targetIndex} />;

  const selectedType = view.hand[selectedCoin]?.type;
  // Tropas del jugador actual que puede jugar AHORA: en "coin" son los tipos
  // de la mano; en "action" solo el tipo de la moneda elegida.
  const playableTypes = mode === "coin"
    ? view.hand.flatMap((coin) => coin.type === undefined ? [] : [coin.type])
    : selectedType === undefined ? [] : [selectedType];
  return <box style={{ flexDirection: "column", flexGrow: 1, backgroundColor: COLORS.background }}>
    <box style={{ flexDirection: "row", flexGrow: 1 }}><BoardView view={view} playableTypes={playableTypes} hint={mode === "coin" ? "PASO 1/2 · elige una moneda · l registro" : `PASO 2/2 · ${coinLabel(view, selectedCoin)} · elige una acción · l registro`} /></box>
    <DiscardView view={view} log={log} />
    {mode === "coin" ? <HandView view={view} selected={selectedCoin} /> : <box style={{ flexDirection: "column", flexGrow: 1 }}>{noActionsMessage ? <box style={{ border: true, borderColor: COLORS.accent, flexGrow: 1, justifyContent: "center", alignItems: "center" }}><text fg={COLORS.accent}>{noActionsMessage}</text><text fg={COLORS.muted}>Esc · volver a escoger moneda</text></box> : <MenuView actions={actions} selected={selected} coinLabel={coinLabel(view, selectedCoin)} />}<MessageView message={message} error={messageError} /></box>}
    <text fg={COLORS.muted}>{mode === "coin" ? "←→ moneda · Enter elegir · q salir" : "←→ acción · Enter confirmar · Esc volver a monedas · q salir"}</text>
  </box>;
}

async function finishDraft(draft: DraftSession, callbacks: DomainCallbacks): Promise<void> {
  try {
    const board = await new SVGBoardLoader().load();
    const config = configureGame(board, draft.results);
    const game = new Game({ board, players: { player1: config.player1, player2: config.player2 }, initiative: config.initiative });
    const started = game.startRound();
    callbacks.onGameStarted(game);
    callbacks.pushLog(entriesFromResult(started, game.currentPlayer));
    callbacks.onMessage(started.message);
    callbacks.refresh(game, started.events);
    callbacks.onTurnChange(game);
  } catch (reason) {
    // Carga/arranque fallido: mensaje claro y vuelta a un modo navegable (no
    // dejar una promesa rechazada sin manejar en el flujo del draft).
    const detail = reason instanceof Error ? reason.message : String(reason);
    callbacks.onError(`No se pudo iniciar la partida (${detail}). Verifica assets/board/board-1v1.svg e inténtalo de nuevo.`);
  }
}

function executeTargetAction(action: MenuAction, player: PlayerId, coinIndex: number, unitPosition: string | undefined, target: string, game: Game, royalGuardFromReserve = false): GameResult {
  const coin = game.player(player).hand.toArray()[coinIndex];
  const unitType = unitPosition ? game.board.unitAt(unitPosition)?.type : undefined;
  if (action === "deploy" && coin && "type" in coin) return game.deploy(player, coin.type as UnitType, target);
  if (!unitType) return { success: false, message: "No se encontró la unidad seleccionada.", events: [] };
  if (action === "move") return game.executeManeuver(player, { kind: "move", unitType, to: target, unitPos: unitPosition });
  if (action === "attack") return game.executeManeuver(player, { kind: "attack", unitType, target, unitPos: unitPosition, royalGuardFromReserve });
  if (action === "control") return game.executeManeuver(player, { kind: "control", unitType, unitPos: unitPosition });
  return { success: false, message: "Acción no disponible en este paso.", events: [] };
}

function executeAction(action: MenuAction, coinIndex: number, game: Game, callbacks: DomainCallbacks): void {
  const player: PlayerId = game.currentPlayer;
  const local = game.player(player);
  const coin = local.hand.toArray()[coinIndex];
  const unitType: UnitType | undefined = coin && "type" in coin ? (coin.type as UnitType) : undefined;
  let result: GameResult | undefined;
  if (action === "retire") result = game.retire(player); // pase sin monedas en la mano
  else if (action === "pass" && coin) result = game.pass(player, coin.isRoyal() ? { kind: "royal" } : { kind: "unit", unitType: unitType! });
  else if (action === "initiative" && coin) result = game.claimInitiative(player, coin.isRoyal() ? { kind: "royal" } : { kind: "unit", unitType: unitType! });
  else if (action === "recruit" && coin) { const reserveType = local.unitCards.find((type) => local.reserve.countUnit(type) > 0); if (reserveType) result = game.recruit(player, coin.isRoyal() ? { kind: "royal" } : { kind: "unit", unitType: unitType! }, reserveType); }
  else if (action === "bolster" && unitType && game.board.findUnit(player, unitType)) result = game.bolster(player, unitType);
  if (!result) { callbacks.onMessage("Esta acción necesita una selección adicional. Elige otra opción.", true); return; }
  callbacks.onMessage(result.message, !result.success);
  if (!result.success) return;
  callbacks.pushLog(entriesFromResult(result, player));
  if (action === "pass" || action === "retire") {
    if (game.roundOver) {
      const ended = game.endRound();
      const started = game.startRound();
      callbacks.pushLog([...entriesFromResult(ended, player), ...entriesFromResult(started, player)]);
      callbacks.onMessage(started.success ? started.message : ended.message);
      callbacks.refresh(game, started.success ? started.events : []);
    } else {
      callbacks.refresh(game, result.events);
    }
    callbacks.onTurnChange(game);
    return;
  }
  callbacks.refresh(game, result.events);
  if (game.winner) {
    callbacks.setMode("victory");
    return;
  }
  game.nextTurn();
  callbacks.refresh(game, result.events);
  callbacks.onTurnChange(game);
}
