import { useEffect, useMemo, useRef, useState } from "react";
import {
  advanceBlueToActions,
  advanceRedActivePlayer,
  annualResourceAllocation,
  beginBlueReadinessBill,
  beginRedInvestmentsAndActions,
  calculateUsReadinessBill,
  createInitialGameState,
  entryPairs,
  entryValue,
  entryValues,
  generateRedPlayDecision,
  generateRedSequenceDecision,
  generateRedSignalDecision,
  generateReviewItems,
  generateWhiteCellAdjudicationResolution,
  generateWhiteCellSummary,
  getPlayerDeck,
  getPlayersBySide,
  payUsReadinessBill,
  playRedSignaledCard,
  procureForces,
  RandomDiceRoller,
  recordGameStartSummary,
  recordStateOfWorldSummary,
  requestBlueFreePlayAdjudication,
  resolveCard,
  resolveWhiteCellAdjudication,
  setActiveBluePlayer,
  setUsForceReadiness,
  signalRedCards,
  skipRemainingRedCards,
  validateState,
  type Card,
  type CardId,
  type EventLogItem,
  type ForceCommitment,
  type GameState,
  type PlayerId,
  type ReadinessLevel,
  type RollRecord,
  type Scenario
} from "../engine";
import { Banner, Button, EmptyState, Modal, Section, Spinner, Tag } from "./ui";
import { phaseLabel, playerLabel, sideToTone } from "./factions";
import { COLOR_SCHEMES, TopBar, type ColorSchemeId } from "./TopBar";
import { CurrentTaskPanel, RedSignalDeckTrigger, StatPanel } from "./Sidebars";
import { EventLogPanel, LogEntryModal } from "./EventLog";
import { CardModal } from "./CardModal";
import { CardBack, PlayerCard } from "./Card";
import { cardBackImageUrl } from "./cardBacks";
import { PlayerSwitcher } from "./PlayerSwitcher";
import { DiceResult } from "./Dice";
import { EffectsSummary } from "./Effects";
import {
  BriefingSection,
  IntelBriefing,
  RedSignalIntel,
  WorldStateNewspapers
} from "./Briefings";
import type { PlayerMetricPoint, ReviewItem, ScalarChange, StateDiff } from "./diff";
import { diffStates, takeSnapshot, type Snapshot } from "./diff";
import { ReadinessSlider } from "./ReadinessSlider";
import { RedSignalReveal } from "./Reveal";
import { TheaterMap } from "./TheaterMap";

interface GameViewProps {
  scenario: Scenario;
}

interface UiMessage {
  tone: "info" | "error";
  text: string;
}

const COLOR_SCHEME_STORAGE_KEY = "hedgemony-color-scheme";
const DEFAULT_COLOR_SCHEME: ColorSchemeId = "stealth-green";
const colorSchemeIds = new Set<ColorSchemeId>(COLOR_SCHEMES.map((scheme) => scheme.id));

function initialColorScheme(): ColorSchemeId {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEME;
  const stored = window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY) as ColorSchemeId | null;
  return stored && colorSchemeIds.has(stored) ? stored : DEFAULT_COLOR_SCHEME;
}

function commitmentsFor(cardId: CardId): Partial<{
  blue_commitments: ForceCommitment[];
  red_commitments: ForceCommitment[];
  blue_players: PlayerId[];
  red_players: PlayerId[];
  proxy_id: string;
}> {
  if (cardId === "US-ACT-01") {
    return {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater", out_of_area_arrival: null }],
      red_commitments: [{ force_id: "PRC-INDO-5-M3", source: "in_theater", out_of_area_arrival: null }],
      blue_players: ["US"],
      red_players: ["PRC"],
    };
  }
  if (cardId === "NATO-ACT-01") {
    return {
      blue_commitments: [{ force_id: "NATO-EUCOM-5", source: "in_theater", out_of_area_arrival: null }],
      red_commitments: [{ force_id: "RU-EUCOM-5-M2", source: "in_theater", out_of_area_arrival: null }],
      blue_players: ["NATO_EU"],
      red_players: ["RU"],
    };
  }
  if (cardId === "RU-ACT-01") {
    return {
      blue_commitments: [
        { force_id: "NATO-EUCOM-5", source: "in_theater", out_of_area_arrival: null },
        { force_id: "US-EUCOM-1", source: "in_theater", out_of_area_arrival: null },
      ],
      red_commitments: [
        { force_id: "RU-EUCOM-5-M2", source: "in_theater", out_of_area_arrival: null },
        { force_id: "RU-EUCOM-4-M3", source: "in_theater", out_of_area_arrival: null },
      ],
      blue_players: ["NATO_EU", "US"],
      red_players: ["RU"],
    };
  }
  if (cardId === "PRC-ACT-01" || cardId === "PRC-ACT-02") {
    return {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater", out_of_area_arrival: null }],
      red_commitments: [
        { force_id: "PRC-INDO-5-M2", source: "in_theater", out_of_area_arrival: null },
        { force_id: "PRC-INDO-5-M3", source: "in_theater", out_of_area_arrival: null },
      ],
      blue_players: ["US"],
      red_players: ["PRC"],
    };
  }
  if (cardId === "IR-ACT-01") {
    return {
      blue_commitments: [{ force_id: "US-IRQ-1", source: "in_theater", out_of_area_arrival: null }],
      red_commitments: [{ force_id: "IR-CENTCOM-5", source: "in_theater", out_of_area_arrival: null }],
      blue_players: ["US"],
      red_players: ["US"]
    };
  }
  if (cardId === "IR-ACT-02") {
    return { proxy_id: "IR-PROXY-01" };
  }
  return {};
}

function turnSummary(state: GameState, turn: number): string {
  if (turn <= 1) {
    return state.summaries.game_start ?? "World state at the start of the campaign.";
  }
  return (
    entryValue(state.summaries.state_of_world, turn - 1) ??
    entryValue(state.summaries.state_of_world, turn) ??
    "Open-source picture is forming."
  );
}

function openingSummaryFromReviews(reviewItems: ReviewItem[], fallback: string): string {
  const newspaperParagraphs = reviewItems
    .filter((item) => item.kind === "world_newspapers")
    .map((item) => item.summary.trim())
    .filter(Boolean);
  const intelParagraph = reviewItems
    .find((item) => item.kind === "world_intel")
    ?.summary
    .trim();
  const paragraphs = intelParagraph
    ? [...newspaperParagraphs, intelParagraph]
    : newspaperParagraphs;

  return paragraphs.length > 0 ? paragraphs.join("\n\n") : fallback.trim();
}

function fallbackOpeningReviews(summary: string, turn: number, label: string): ReviewItem[] {
  return [
    {
      kind: "world_newspapers",
      turn,
      summary,
      label,
      headline: `World Leaders Weigh Risks as Turn ${turn} Opens`
    },
    {
      kind: "world_newspapers",
      turn,
      summary,
      label: "International Desk",
      headline: "Regional Signals Draw Fresh Scrutiny"
    },
    {
      kind: "world_intel",
      turn,
      summary,
      label
    }
  ];
}

function SummaryParagraphs({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <p className="briefing__paragraph" key={index}>{paragraph}</p>
      ))}
    </>
  );
}

function metricPointFromState(state: GameState, turn: number): PlayerMetricPoint {
  return {
    turn,
    players: Object.fromEntries(
      entryPairs(state.players).map(([id, player]) => [
        id,
        {
          rp: player.resource_points,
          ip: player.influence_points,
          perTurn: entryValue(state.per_turn_resources, player.id) ?? 0,
          ntl: player.national_tech_level
        }
      ])
    ) as PlayerMetricPoint["players"]
  };
}

export function GameView({ scenario }: GameViewProps) {
	const [state, setState] = useState<GameState>(() => createInitialGameState(scenario));
	const [message, setMessage] = useState<UiMessage | undefined>();
	const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
	const [signalDeckOpen, setSignalDeckOpen] = useState(false);
	const [blueDeckOpen, setBlueDeckOpen] = useState(false);
	const [logEntryModal, setLogEntryModal] = useState<EventLogItem | undefined>();
	const [summaryModal, setSummaryModal] = useState<{ kind: "game_start" | "state_of_world"; turn: number } | undefined>();
	const [cardModal, setCardModal] = useState<Card | undefined>();
	const [freePlayIntent, setFreePlayIntent] = useState("");
	const [pendingFreePlay, setPendingFreePlay] = useState<{ playerId: PlayerId; subphase: "Investments" | "Actions" } | undefined>();
	const [mapOpen, setMapOpen] = useState(false);
	const [colorScheme, setColorScheme] = useState<ColorSchemeId>(() => initialColorScheme());
	const turnReviewsSeeded = useRef<Set<number>>(new Set());
	const turnStartSnapshots = useRef<Record<number, Snapshot>>({});
	const metricHistory = useRef<PlayerMetricPoint[]>([]);

  const roller = useMemo(() => new RandomDiceRoller(), []);

  if (metricHistory.current.length === 0) {
    metricHistory.current = [metricPointFromState(state, 0)];
  }
  if (!turnStartSnapshots.current[state.turn]) {
    turnStartSnapshots.current[state.turn] = takeSnapshot(state);
  }

  useEffect(() => {
    document.documentElement.dataset.colorScheme = colorScheme;
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, colorScheme);
  }, [colorScheme]);

  const validationIssues = validateState(state);
  const blockingValidation = validationIssues.filter((issue) => issue.severity === "error");

  const activePlayer = state.active_player_id ? entryValue(state.players, state.active_player_id) : undefined;
  const bluePlayers = useMemo(() => getPlayersBySide(state, "Blue"), [state]);

  const allRevealedSignals = useMemo(() => {
    return entryValues(state.red_signals).flatMap((signal) =>
      signal.card_ids
        .map((id) => ({ playerId: signal.player_id, card: entryValue(state.cards, id) }))
        .filter((entry): entry is { playerId: PlayerId; card: Card } => Boolean(entry.card))
    );
  }, [state.red_signals, state.cards]);

  function applyResult(next: GameState, errorText?: string): void {
    setState(next);
    if (errorText) setMessage({ tone: "error", text: errorText });
    else setMessage(undefined);
  }

  function showIssues(issues: { message: string; severity: string }[]): boolean {
    const blocking = issues.filter((issue) => issue.severity === "error");
    if (blocking.length === 0) return false;
    setMessage({ tone: "error", text: blocking.map((issue) => issue.message).join(" ") });
    return true;
  }

  function enqueueCardResolution(
    actor: PlayerId | "WhiteCell",
    cardId: CardId,
    snapshot: Snapshot,
    nextState: GameState,
    outcome?: string,
    rollFromResult?: RollRecord
  ): void {
    const diff = diffStates(snapshot, nextState);
    const newRollIds = new Set(nextState.rolls.map((roll) => roll.id));
    const newRolls = nextState.rolls.filter((roll) => !snapshot.rollIds.has(roll.id) && newRollIds.has(roll.id));
    if (rollFromResult && !newRolls.some((roll) => roll.id === rollFromResult.id)) {
      newRolls.push(rollFromResult);
    }
    const card = entryValue(nextState.cards, cardId);
    setReviewQueue((queue) => [
      ...queue,
      {
        kind: "card_resolution",
        actor,
        cardId,
        outcome,
        diff,
        rolls: newRolls,
        narrative: card?.description
      }
    ]);
  }

  // ------------------------------------------------------------------
  // Auto-advancement (Red + White Cell placeholder behaviors)
  // ------------------------------------------------------------------
  useEffect(() => {
    void (async () => {
      {
        if (reviewQueue.length > 0) return;

        const pendingAdj = state.pending_adjudications.find((entry) => entry.status === "pending");
        if (pendingAdj) {
          const snapshot = takeSnapshot(state);
          const result = await resolveWhiteCellAdjudication(
            state,
            pendingAdj.id,
            await generateWhiteCellAdjudicationResolution(pendingAdj, state)
          );
          if (showIssues(result.issues)) return;
          const diff = diffStates(snapshot, result.state);
          const newRolls = result.state.rolls.filter((roll) => !snapshot.rollIds.has(roll.id));
          const cardId = pendingAdj.card_id;
          const hasMechanical =
            diff.scalars.length > 0 || diff.flags.length > 0 || newRolls.length > 0;
          if (hasMechanical) {
            setReviewQueue((queue) => [
              ...queue,
              {
                kind: "card_resolution",
                actor: "WhiteCell",
                cardId: cardId ?? "WHITE-CELL",
                outcome: "Adjudicated",
                diff,
                rolls: newRolls,
                narrative: pendingAdj.reason
              }
            ]);
          }
          applyResult(result.state);
          return;
        }

        if (state.phase === "GameStart") {
          const summary = await generateWhiteCellSummary("game_start", state.turn, state);
          const reviewItems = await generateReviewItems(state, summary);
          const openingSummary = openingSummaryFromReviews(reviewItems, summary);
          const next = recordGameStartSummary(state, openingSummary);
          turnReviewsSeeded.current.add(state.turn);
          setReviewQueue(reviewItems);
          applyResult(next);
          return;
        }

        if (state.phase === "RedSignaling") {
          // Every turn opens with the world picture before Red discloses signals.
          if (!turnReviewsSeeded.current.has(state.turn)) {
            turnReviewsSeeded.current.add(state.turn);
            const summary = turnSummary(state, state.turn);
            const label = state.turn === 1 ? "Opening Bell" : `Turn ${state.turn} Opens`;
            const reviewItems = await generateReviewItems(state, summary);
            setReviewQueue(reviewItems.length > 0 ? reviewItems : fallbackOpeningReviews(summary, state.turn, label));
            return;
          }

          if (!turnStartSnapshots.current[state.turn]) {
            turnStartSnapshots.current[state.turn] = takeSnapshot(state);
          }
          const nextRed = getPlayersBySide(state, "Red").find(
            (player) => !entryValue(state.red_signals, player.id)?.completed,
          );
          if (nextRed) {
            const decision = await generateRedSignalDecision(state, nextRed.id);
            const result = signalRedCards(state, nextRed.id, decision.cardIds, decision.briefSummary, decision.activationIntent ?? undefined);
            if (showIssues(result.issues)) return;
            setReviewQueue([
              {
                kind: "signal_reveal",
                turn: state.turn,
                playerId: nextRed.id,
                cardIds: decision.cardIds
              },
              {
                kind: "signal_intel",
                turn: state.turn,
                playerId: nextRed.id,
                cardIds: decision.cardIds
              }
            ]);
            applyResult(result.state);
            return;
          }

          const result = beginBlueReadinessBill(state);
          if (!showIssues(result.issues)) applyResult(result.state);
          return;
        }

        if (state.phase === "RedInvestmentsAndActions" && state.active_player_id) {
          const playerId = state.active_player_id;
          if (entryValue(state.red_plays, playerId)?.skipped) {
            applyResult(advanceRedActivePlayer(state));
            return;
          }
          const decision = await generateRedPlayDecision(state, playerId);
          if (decision.kind === "play") {
            const snapshot = takeSnapshot(state);
            const result = playRedSignaledCard(
              state,
              playerId,
              decision.cardId,
              roller,
              commitmentsFor(decision.cardId)
            );
            if (showIssues(result.issues)) return;
            const outcome = result.outcome ? String(result.outcome) : undefined;
            enqueueCardResolution(playerId, decision.cardId, snapshot, result.state, outcome, result.roll);
            applyResult(result.state);
            return;
          }
          const result = skipRemainingRedCards(state, playerId);
          if (!showIssues(result.issues)) applyResult(result.state);
          return;
        }

        if (state.phase === "AnnualResourcesAllocation") {
          const before: Record<string, number> = {};
          for (const [id, p] of entryPairs(state.players)) before[id] = p.resource_points;
          const result = annualResourceAllocation(state, roller);
          if (showIssues(result.issues)) return;
          const allocations = entryValues(result.state.players).map((player) => {
            const beforeRp = before[player.id] ?? 0;
            const total = player.resource_points - beforeRp;
            const baseRp = entryValue(state.per_turn_resources, player.id) ?? 0;
            const variation = total - baseRp;
            return { playerId: player.id, baseRp, variation, total };
          });
          setReviewQueue((queue) => [
            ...queue,
            {
              kind: "annual_allocation",
              turn: state.turn,
              allocations,
              budgetRoll: result.budgetRoll
            }
          ]);
          applyResult(result.state);
          return;
        }

        if (state.phase === "StateOfWorldSummary") {
          const endingTurn = state.turn;
          const next = recordStateOfWorldSummary(state, await generateWhiteCellSummary("state_of_world", endingTurn, state));
          const turnStart = turnStartSnapshots.current[endingTurn] ?? takeSnapshot(state);
          const historyPoint = metricPointFromState(next, endingTurn);
          metricHistory.current = [
            ...metricHistory.current.filter((point) => point.turn !== endingTurn),
            historyPoint
          ].sort((a, b) => a.turn - b.turn);
          setReviewQueue((queue) => [
            ...queue,
            {
              kind: "end_of_turn_dashboard",
              turn: endingTurn,
              diff: diffStates(turnStart, next),
              history: metricHistory.current
            },
            { kind: "end_of_turn_map", turn: endingTurn } as ReviewItem
          ]);
          applyResult(next);
          return;
        }
      }
    })()
  }, [state, reviewQueue, roller]);

  // ------------------------------------------------------------------
  // Player-driven actions
  // ------------------------------------------------------------------
  function onSelectActiveBlue(playerId: PlayerId): void {
    const result = setActiveBluePlayer(state, playerId);
    if (!showIssues(result.issues)) applyResult(result.state);
  }

  function payReadiness(): void {
    const result = payUsReadinessBill(state);
    const blocking = result.issues.filter((issue) => issue.severity === "error");
    if (showIssues(blocking)) return;
    applyResult(result.state);
  }

  function setReadiness(forceId: string, level: ReadinessLevel): void {
    const result = setUsForceReadiness(state, forceId, level);
    if (!showIssues(result.issues)) applyResult(result.state);
  }

  function advanceToActions(): void {
    const result = advanceBlueToActions(state);
    if (!showIssues(result.issues)) applyResult(result.state);
  }

  async function endBluePhase(): Promise<void> {
    const sequence = state.rules_in_effect.random_red_sequence ? undefined : await generateRedSequenceDecision(state);
    const result = beginRedInvestmentsAndActions(state, sequence, roller);
    const blocking = result.issues.filter((issue) => issue.severity === "error");
    if (showIssues(blocking)) return;
    applyResult(result.state);
  }

  function playBlueCard(card: Card): void {
    const playerId = state.active_player_id;
    if (!playerId) return;
    const snapshot = takeSnapshot(state);
    if (card.id === "US-INV-02") {
      const result = procureForces(state, {
        player_id: "US",
        force_factors: 1,
        modernization_level: 3,
        location_id: "CONUS",
        home_base_id: "CONUS",
        readiness_level: 90,
      });
      if (showIssues(result.issues)) return;
      enqueueCardResolution(playerId, card.id, snapshot, result.state);
      applyResult(result.state);
      return;
    }
    const result = resolveCard(state, { acting_player_id: playerId, card_id: card.id, ...commitmentsFor(card.id) }, roller);
    const blocking = result.issues.filter((issue) => issue.severity === "error");
    if (showIssues(blocking)) return;
    const outcome = result.outcome ? String(result.outcome) : undefined;
    enqueueCardResolution(playerId, card.id, snapshot, result.state, outcome, result.roll);
    applyResult(result.state);
  }

  function submitFreePlay(): void {
    if (!pendingFreePlay) return;
    const intent = freePlayIntent.trim() || `Blue free-play ${pendingFreePlay.subphase.toLowerCase()}`;
    const request = requestBlueFreePlayAdjudication(state, pendingFreePlay.playerId, intent);
    applyResult(request.state);
    setFreePlayIntent("");
    setPendingFreePlay(undefined);
  }

  function popReview(count = 1): void {
    setReviewQueue((queue) => queue.slice(count));
  }

  // ------------------------------------------------------------------
  // Rendering helpers
  // ------------------------------------------------------------------
  const currentReview = reviewQueue[0];
  const currentNewspaperReviews = currentReview?.kind === "world_newspapers"
    ? reviewQueue
      .slice(0, 2)
      .filter((review): review is Extract<ReviewItem, { kind: "world_newspapers" }> =>
        review.kind === "world_newspapers" && review.turn === currentReview.turn
      )
    : [];

  return (
    <div className="app-shell">
      <TopBar
        state={state}
        onOpenMap={() => setMapOpen(true)}
        colorScheme={colorScheme}
        onColorSchemeChange={setColorScheme}
      />

      <aside className="left-rail" aria-label="Current task and event log">
        <CurrentTaskPanel
          phaseLabel={describePhase(state, currentReview).phaseLabel}
          subPhase={describePhase(state, currentReview).subPhase}
          task={describePhase(state, currentReview).task}
          why={describePhase(state, currentReview).why}
        />
        <Section title="Event Log" tone="neutral">
          <EventLogPanel
            state={state}
            viewer="Public"
            onSelectEntry={setLogEntryModal}
            onOpenSummary={(kind, turn) => setSummaryModal({ kind, turn })}
          />
        </Section>
      </aside>

      <main className="stage" aria-label="Stage">
        <div className="stage__inner">
          {message ? <Banner tone="error">{message.text}</Banner> : null}
          {blockingValidation.length > 0 ? (
            <Banner tone="warning">{blockingValidation[0].message}</Banner>
          ) : null}

					{currentReview ? (
						<ReviewStage
							state={state}
							review={currentReview}
							newspaperReviews={currentNewspaperReviews}
							onContinue={() => popReview(currentNewspaperReviews.length || 1)}
							onOpenCard={setCardModal}
						/>
					) : (
						<PrimaryStage
							state={state}
							bluePlayers={bluePlayers}
							activePlayerId={state.active_player_id ?? undefined}
							freePlayIntent={freePlayIntent}
							pendingFreePlay={pendingFreePlay}
							onSelectBlue={onSelectActiveBlue}
							onPay={payReadiness}
							onSetReadiness={setReadiness}
							onAdvanceToActions={advanceToActions}
							onEndBlue={endBluePhase}
							onRequestFreePlay={(playerId, subphase) => setPendingFreePlay({ playerId, subphase })}
							onCancelFreePlay={() => {
								setPendingFreePlay(undefined);
								setFreePlayIntent("");
							}}
							onSubmitFreePlay={submitFreePlay}
							onFreePlayIntent={setFreePlayIntent}
							onOpenCard={setCardModal}
							onPlayCard={playBlueCard}
						/>
					)}
				</div>
			</main>

			<aside className="right-rail" aria-label="Stats and intel">
				<StatPanel state={state} onOpenBlueDeck={() => setBlueDeckOpen(true)} />
				<Section title="Red Signals · Deck" tone="red">
					<RedSignalDeckTrigger
						state={state}
						count={allRevealedSignals.length}
						onOpen={() => setSignalDeckOpen(true)}
					/>
				</Section>
			</aside>

			{/* Modals */}
			<Modal
				open={blueDeckOpen}
				onClose={() => setBlueDeckOpen(false)}
				title={`Current Blue Deck · ${activePlayer?.label ?? "Blue"}`}
				size="lg"
			>
				<BlueDeckReference
					state={state}
					activePlayerId={activePlayer?.side === "Blue" ? activePlayer.id : undefined}
					onPlayCard={(card) => {
						playBlueCard(card);
						setBlueDeckOpen(false);
					}}
					onOpenCard={setCardModal}
				/>
			</Modal>

			<Modal
				open={signalDeckOpen}
				onClose={() => setSignalDeckOpen(false)}
				title="Revealed Red Signals (campaign-wide)"
				size="lg"
			>
				{allRevealedSignals.length === 0 ? (
					<EmptyState>No Red signals have been revealed yet. They will appear here as adversaries disclose cards.</EmptyState>
				) : (
					<div className="stage-card-row" style={{ justifyContent: "flex-start" }}>
						{allRevealedSignals.map(({ playerId, card }) => (
							<div key={`${playerId}-${card.id}`} style={{ display: "grid", gap: "0.4rem" }}>
								<Tag tone="red">{playerLabel(state, playerId)}</Tag>
								<PlayerCard card={card} state={state} size="compact" onOpen={() => setCardModal(card)} />
							</div>
						))}
					</div>
				)}
			</Modal>

      <CardModal card={cardModal} state={state} open={Boolean(cardModal)} onClose={() => setCardModal(undefined)} />
      <LogEntryModal entry={logEntryModal} state={state} open={Boolean(logEntryModal)} onClose={() => setLogEntryModal(undefined)} />

			<Modal
				open={mapOpen}
				onClose={() => setMapOpen(false)}
				title="Theater Map · Force Disposition"
				size="lg"
			>
				<div className="map-modal">
					<TheaterMap state={state} />
					<p className="map-modal__hint">Click any unit to see force factor count, location, and pin status.</p>
				</div>
			</Modal>

      <Modal
        open={Boolean(summaryModal)}
        onClose={() => setSummaryModal(undefined)}
        title={summaryModal ? `Briefing · Turn ${summaryModal.turn}` : "Briefing"}
        size="lg"
      >
        {summaryModal ? (
          <IntelBriefing
            title={summaryModal.kind === "game_start" ? "Opening Theater Picture" : `World State · Turn ${summaryModal.turn}`}
          >
            <BriefingSection title="Summary">
              <SummaryParagraphs
                text={
                  summaryModal.kind === "game_start"
                    ? state.summaries.game_start ?? "No summary available."
                    : entryValue(state.summaries.state_of_world, summaryModal.turn) ?? "No summary available."
                }
              />
            </BriefingSection>
          </IntelBriefing>
        ) : null}
      </Modal>

			<Modal
				open={Boolean(pendingFreePlay)}
				onClose={() => {
					setPendingFreePlay(undefined);
					setFreePlayIntent("");
				}}
				title={`Blue Free-Play · ${pendingFreePlay?.subphase ?? ""}`}
				footer={
					<>
						<Button variant="ghost" onClick={() => { setPendingFreePlay(undefined); setFreePlayIntent(""); }}>
							Cancel
						</Button>
						<Button variant="primary" onClick={submitFreePlay} disabled={freePlayIntent.trim().length === 0}>
							Submit for Adjudication
						</Button>
					</>
				}
			>
				<div className="freeplay-modal">
					{pendingFreePlay ? (
						<CardBack
							tone="blue"
							playerId={pendingFreePlay.playerId}
							kind={pendingFreePlay.subphase === "Investments" ? "Investment" : "Action"}
							stamp=""
							label={`${playerLabel(state, pendingFreePlay.playerId)} ${pendingFreePlay.subphase} card back`}
						/>
					) : null}
					<div className="stack-md">
						<p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
							Articulate the intent for {pendingFreePlay ? playerLabel(state, pendingFreePlay.playerId) : "Blue"}'s free-play{" "}
							{pendingFreePlay?.subphase.toLowerCase()}. The White Cell will translate this into game terms and resolve.
						</p>
						<textarea
							value={freePlayIntent}
							onChange={(event) => setFreePlayIntent(event.target.value)}
							placeholder="e.g., Reposition USINDOPACOM forces to deter PRC escalation while preserving readiness in CENTCOM."
							rows={5}
							aria-label="Free play intent"
						/>
					</div>
				</div>
			</Modal>
		</div>
	);
}

// ============================================================================
// Stage helpers
// ============================================================================

interface DescribedPhase {
  phaseLabel: string;
  subPhase?: string;
  task: string;
  why: string;
}

function describePhase(state: GameState, review?: ReviewItem): DescribedPhase {
  if (review) {
    if (review.kind === "world_newspapers") {
      return {
        phaseLabel: "Open-Source Picture",
        subPhase: review.label,
        task: "Read the headlines for the current world state.",
        why: "Public framing matters — these papers reflect what the population and leaders are reading."
      };
    }
    if (review.kind === "world_intel") {
      return {
        phaseLabel: "Intelligence Briefing",
        subPhase: "World State",
        task: "Receive the dispatch summarizing posture and shifts.",
        why: "Translates open-source noise into actionable readouts for Blue command."
      };
    }
    if (review.kind === "signal_reveal") {
      return {
        phaseLabel: "Red Signals Revealed",
        subPhase: playerLabel(state, review.playerId),
        task: "Watch the cards turn over and note what has been disclosed.",
        why: "Red disclosure is partial. The signaled cards bound what they may play this turn."
      };
    }
    if (review.kind === "signal_intel") {
      return {
        phaseLabel: "Intelligence Briefing",
        subPhase: `${playerLabel(state, review.playerId)} signals`,
        task: `Read the assessment of ${playerLabel(state, review.playerId)}'s disclosed cards.`,
        why: "Each adversary's disclosure is briefed in turn so Blue can shape investment and force priorities."
      };
    }
    if (review.kind === "card_resolution") {
      return {
        phaseLabel: "Action Resolution",
        subPhase: review.cardId,
        task: "Review the outcome, dice, and changes to the world state.",
        why: "Confirm the effect summary and continue the turn."
      };
    }
    if (review.kind === "annual_allocation") {
      return {
        phaseLabel: "Annual Allocation",
        subPhase: `Turn ${review.turn}`,
        task: "Review per-country resource credits before the turn closes.",
        why: "Per-turn allocations and the U.S. budget variation are credited now."
      };
    }
    if (review.kind === "end_of_turn_dashboard") {
      return {
        phaseLabel: "End of Turn",
        subPhase: `Turn ${review.turn}`,
        task: "Review turn analytics and major variable changes.",
        why: "Resource and influence trajectories show how this turn shifted the campaign."
      };
    }
    if (review.kind === "end_of_turn_map") {
      return {
        phaseLabel: "End of Turn",
        subPhase: `Turn ${review.turn}`,
        task: "Inspect the theater map, then close the turn.",
        why: "Final force disposition before the next turn opens."
      };
    }
  }

  switch (state.phase) {
    case "GameStart":
      return {
        phaseLabel: "Initializing",
        task: "Recording the game-start summary.",
        why: "The initial world state must be established before Red may signal."
      };
    case "RedSignaling":
      return {
        phaseLabel: "Red Signaling",
        task: "Adversaries are selecting and disclosing their signaled cards.",
        why: "Red must commit to a small slate of plays for the turn before Blue acts."
      };
    case "BlueReadinessBill":
      return {
        phaseLabel: "Blue Readiness Bill",
        subPhase: "United States",
        task: "Adjust U.S. readiness levels, then pay the sustainment bill.",
        why: "Readiness levels drive every U.S. combat factor and force sustainment cost."
      };
    case "BlueInvestmentsAndActions":
      if (state.blue_subphase === "Investments") {
        return {
          phaseLabel: "Blue Investments",
          subPhase: state.active_player_id ?? undefined,
          task: "Play investment cards or request a free-play, then begin actions.",
          why: "Investments build long-term posture. They must complete before any Blue action card may be played."
        };
      }
      return {
        phaseLabel: "Blue Actions",
        subPhase: state.active_player_id ?? undefined,
        task: "Play action cards or request a free-play, then end the Blue phase.",
        why: "Action cards may pin or commit forces. End the Blue phase only when finished."
      };
    case "RedInvestmentsAndActions":
      return {
        phaseLabel: "Red Investments & Actions",
        subPhase: state.active_player_id ?? undefined,
        task: "Adversaries are playing their signaled cards.",
        why: "Each Red action will pause for an effect-summary review before continuing."
      };
    case "AnnualResourcesAllocation":
      return {
        phaseLabel: "Annual Resource Allocation",
        task: "DoD budget variation is being rolled and allocations applied.",
        why: "Per-turn resources are credited and U.S. budget variation is determined here."
      };
    case "StateOfWorldSummary":
      return {
        phaseLabel: "State-of-World",
        task: "Recording the closing summary for this turn.",
        why: "Pinning expirations, scheduled effects, and the next-turn handoff are processed now."
      };
    case "GameOver":
      return {
        phaseLabel: "Campaign Complete",
        task: "Maximum turn reached. Review the final event log and stats.",
        why: "The scenario has ended. Compare resource and influence trajectories."
      };
    default:
      return { phaseLabel: state.phase, task: "Pending.", why: "" };
  }
}

// ----- Review stage -----

interface ReviewStageProps {
  state: GameState;
  review: ReviewItem;
  newspaperReviews: Extract<ReviewItem, { kind: "world_newspapers" }>[];
  onContinue: () => void;
  onOpenCard: (card: Card) => void;
}

const TREND_COLORS = [
  "var(--blue-300)",
  "var(--amber-200)",
  "var(--red-200)",
  "var(--green-300)",
  "var(--od-200)",
  "var(--neutral-200)"
];

function deltaLabel(delta: number): string {
  if (delta > 0) return `+${delta}`;
  return `${delta}`;
}

function changeTone(delta: number): "up" | "down" | "neutral" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "neutral";
}

function keyMetricChanges(diff: StateDiff, prefix: "rp" | "ip"): ScalarChange[] {
  return diff.scalars
    .filter((change) => change.key.startsWith(`${prefix}:`))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function otherImportantChanges(diff: StateDiff): ScalarChange[] {
  return diff.scalars
    .filter((change) => !change.key.startsWith("rp:") && !change.key.startsWith("ip:"))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function TrendChart({
  state,
  history,
  metric,
  title
}: {
  state: GameState;
  history: PlayerMetricPoint[];
  metric: "rp" | "ip";
  title: string;
}) {
  const players = entryValues(state.players);
  const values = history.flatMap((point) => players.map((player) => point.players[player.id]?.[metric] ?? 0));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const pad = Math.max(2, Math.ceil((maxValue - minValue) * 0.08));
  const yMin = minValue - pad;
  const yMax = maxValue + pad;
  const width = 420;
  const height = 190;
  const inset = { top: 18, right: 18, bottom: 30, left: 42 };
  const plotWidth = width - inset.left - inset.right;
  const plotHeight = height - inset.top - inset.bottom;
  const xFor = (index: number) => inset.left + (history.length <= 1 ? plotWidth : (index / (history.length - 1)) * plotWidth);
  const yFor = (value: number) => inset.top + ((yMax - value) / (yMax - yMin)) * plotHeight;
  const zeroY = yFor(0);

  return (
    <section className="turn-chart" aria-label={title}>
      <div className="turn-chart__header">
        <h2>{title}</h2>
        <span>{history.length > 1 ? `Turns ${history[0].turn}-${history[history.length - 1].turn}` : `Turn ${history[0]?.turn ?? 0}`}</span>
      </div>
      <svg className="turn-chart__svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} trend chart`}>
        <line x1={inset.left} x2={width - inset.right} y1={zeroY} y2={zeroY} className="turn-chart__zero" />
        {[0, 0.5, 1].map((ratio) => {
          const y = inset.top + ratio * plotHeight;
          const label = Math.round(yMax - ratio * (yMax - yMin));
          return (
            <g key={ratio}>
              <line x1={inset.left} x2={width - inset.right} y1={y} y2={y} className="turn-chart__grid" />
              <text x={inset.left - 9} y={y + 4} textAnchor="end" className="turn-chart__axis">{label}</text>
            </g>
          );
        })}
        {history.map((point, index) => (
          <g key={point.turn}>
            <line x1={xFor(index)} x2={xFor(index)} y1={inset.top} y2={height - inset.bottom} className="turn-chart__grid turn-chart__grid--vertical" />
            <text x={xFor(index)} y={height - 8} textAnchor="middle" className="turn-chart__axis">T{point.turn}</text>
          </g>
        ))}
        {players.map((player, playerIndex) => {
          const d = history
            .map((point, pointIndex) => {
              const value = point.players[player.id]?.[metric] ?? 0;
              return `${pointIndex === 0 ? "M" : "L"} ${xFor(pointIndex)} ${yFor(value)}`;
            })
            .join(" ");
          const latest = history[history.length - 1]?.players[player.id]?.[metric] ?? 0;
          return (
            <g key={player.id}>
              <path d={d} fill="none" stroke={TREND_COLORS[playerIndex % TREND_COLORS.length]} className="turn-chart__line" />
              <circle
                cx={xFor(history.length - 1)}
                cy={yFor(latest)}
                r="3.8"
                fill={TREND_COLORS[playerIndex % TREND_COLORS.length]}
                className="turn-chart__point"
              />
            </g>
          );
        })}
      </svg>
      <div className="turn-chart__legend">
        {players.map((player, index) => (
          <span key={player.id}>
            <i style={{ background: TREND_COLORS[index % TREND_COLORS.length] }} />
            {player.label}
          </span>
        ))}
      </div>
    </section>
  );
}

function ChangePill({ change }: { change: ScalarChange }) {
  const tone = changeTone(change.delta);
  const isNumeric = change.before !== change.after || change.delta !== 0;
  return (
    <div className="turn-change">
      <div>
        <b>{change.scopeLabel}</b>
        <span>{change.label}</span>
      </div>
      <strong className={`turn-change__delta turn-change__delta--${tone}`}>
        {isNumeric ? deltaLabel(change.delta) : "changed"}
      </strong>
      {isNumeric ? (
        <small>{change.before} → {change.after}</small>
      ) : null}
    </div>
  );
}

function ReviewStage({ state, review, newspaperReviews, onContinue, onOpenCard }: ReviewStageProps) {
  if (review.kind === "world_newspapers") {
    const newspapers = newspaperReviews.length > 0 ? newspaperReviews : [review];
    return (
      <div className="stack-lg fade-in">
        <header>
          <div className="stage-eyebrow">
            <span className="stage-eyebrow__dot stage-eyebrow__dot--muted" />
            <span>OPEN-SOURCE · TURN {review.turn}</span>
          </div>
          <h1 className="stage-title">{review.label}</h1>
          <p className="stage-subtitle">
            What the world is reading this morning. Headlines color how leaders frame their next moves.
          </p>
        </header>
        <WorldStateNewspapers state={state} newspapers={newspapers} edition={`Day ${review.turn * 30}`} />
        <div className="row gap-md">
          <Button variant="primary" onClick={onContinue}>Continue to Intel Briefing →</Button>
          <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.74rem", letterSpacing: "0.1em" }}>
            ESC to keep reading
          </span>
        </div>
      </div>
    );
  }

  if (review.kind === "world_intel") {
    return (
      <div className="stack-lg fade-in">
        <header>
          <div className="stage-eyebrow">
            <span className="stage-eyebrow__dot stage-eyebrow__dot--amber" />
            <span>J2 · BLUE COMMAND</span>
          </div>
          <h1 className="stage-title">Intelligence Briefing — World State</h1>
          <p className="stage-subtitle">Turn {review.turn} dispatch from the White Cell.</p>
        </header>
        <IntelBriefing title={`World State · Turn ${review.turn}`}>
          <BriefingSection title="Executive Summary">
            <p className="briefing__paragraph">{review.summary}</p>
          </BriefingSection>
          <BriefingSection title="Posture Notes">
            <ul className="briefing__bullets">
              {entryValues(state.players).map((player) => (
                <li key={player.id}>
                  <b>{player.label}</b> — {player.resource_points} RP · {player.influence_points} IP · NTL {player.national_tech_level}
                </li>
              ))}
            </ul>
          </BriefingSection>
        </IntelBriefing>
        <div className="row gap-md">
          <Button variant="primary" onClick={onContinue}>Continue →</Button>
        </div>
      </div>
    );
  }

  if (review.kind === "signal_reveal") {
    const cards = review.cardIds
      .map((id) => entryValue(state.cards, id))
      .filter((card): card is Card => Boolean(card));
    return (
      <div className="stack-lg fade-in">
        <header>
          <div className="stage-eyebrow">
            <span className="stage-eyebrow__dot stage-eyebrow__dot--red" />
            <span>RED SIGNAL DISCLOSURE</span>
          </div>
          <h1 className="stage-title">{playerLabel(state, review.playerId)} discloses signaled cards</h1>
          <p className="stage-subtitle">
            Adversary signaling bounds what {playerLabel(state, review.playerId)} can play this turn. Click the
            <span className="kbd" style={{ margin: "0 0.3rem" }}>i</span>
            on any card for full text.
          </p>
        </header>
        <RedSignalReveal
          key={`reveal-${review.turn}-${review.playerId}`}
          state={state}
          playerId={review.playerId}
          cards={cards}
          onComplete={onContinue}
          isCurrent
          onOpenCard={onOpenCard}
        />
      </div>
    );
  }

	if (review.kind === "signal_intel") {
		const signal = entryValue(state.red_signals, review.playerId);
		const signalLogMessage = [...state.event_log].reverse().find((entry) =>
			entry.turn === review.turn &&
			entry.phase === "RedSignaling" &&
			entry.player_id === review.playerId &&
			entry.message.startsWith(`${review.playerId} intelligence briefing:`)
		)?.message;
		const signalSummary = signal?.brief_summary?.trim();
		const implications = signalLogMessage ?? (signalSummary
			? `${review.playerId} intelligence briefing: ${signalSummary}`
			: "No intelligence briefing summary is on record for this signal.");
		return (
			<div className="stack-lg fade-in">
				<header>
					<div className="stage-eyebrow">
						<span className="stage-eyebrow__dot stage-eyebrow__dot--amber" />
						<span>J2 · {playerLabel(state, review.playerId).toUpperCase()} SIGNALS</span>
					</div>
					<h1 className="stage-title">Intelligence Briefing — {playerLabel(state, review.playerId)}</h1>
					<p className="stage-subtitle">An assessment of {playerLabel(state, review.playerId)}'s disclosed cards this turn.</p>
				</header>
				<IntelBriefing title={`${playerLabel(state, review.playerId)} — Disclosed Cards`}>
					<BriefingSection title="Disclosed Cards">
						<RedSignalIntel state={state} signals={signal ? [signal] : []} />
					</BriefingSection>
					<BriefingSection title="Implications">
						<p className="briefing__paragraph">
							{implications}
						</p>
					</BriefingSection>
				</IntelBriefing>
				<div className="row gap-md">
					<Button variant="primary" onClick={onContinue}>Continue →</Button>
				</div>
			</div>
		);
	}

  if (review.kind === "annual_allocation") {
    return (
      <div className="stack-lg fade-in">
        <header>
          <div className="stage-eyebrow">
            <span className="stage-eyebrow__dot" />
            <span>FY ALLOCATION · TURN {review.turn}</span>
          </div>
          <h1 className="stage-title">Annual Resource Allocation</h1>
          <p className="stage-subtitle">
            Per-country resource credits for the new fiscal cycle. The U.S. allocation includes a DoD budget variation roll.
          </p>
        </header>
        <div className="alloc-table" role="table" aria-label="Annual resource allocations">
          <div className="alloc-table__row alloc-table__row--head" role="row">
            <span>Country</span>
            <span>Side</span>
            <span>Base RP</span>
            <span>Variation</span>
            <span>Credited</span>
          </div>
          {review.allocations.map((row) => {
            const player = entryValue(state.players, row.playerId);
            const tone = sideToTone(player?.side);
            const variation = row.variation;
            const variationCls = variation > 0 ? "alloc-table__delta--up" : variation < 0 ? "alloc-table__delta--down" : "alloc-table__delta--neutral";
            return (
              <div key={row.playerId} className="alloc-table__row" role="row">
                <span style={{ fontWeight: 600 }}>{player?.label ?? row.playerId}</span>
                <span><Tag tone={tone}>{player?.side ?? "—"}</Tag></span>
                <span>{row.baseRp} RP</span>
                <span className={variationCls}>{variation === 0 ? "—" : variation > 0 ? `+${variation}` : `${variation}`}</span>
                <span style={{ fontWeight: 700 }}>{row.total} RP</span>
              </div>
            );
          })}
        </div>
        {review.budgetRoll ? (
          <div className="row gap-md">
            <DiceResult roll={review.budgetRoll} />
          </div>
        ) : null}
        <div className="row gap-md">
          <Button variant="primary" onClick={onContinue}>Continue →</Button>
        </div>
      </div>
    );
  }

  if (review.kind === "end_of_turn_dashboard") {
    const rpChanges = keyMetricChanges(review.diff, "rp");
    const ipChanges = keyMetricChanges(review.diff, "ip");
    const otherChanges = otherImportantChanges(review.diff);
    const changedFlags = review.diff.flags;
    const biggestMoves = [...rpChanges, ...ipChanges, ...otherChanges].slice(0, 6);
    return (
      <div className="stack-lg fade-in">
        <header className="theater-disposition__header">
          <div>
            <div className="stage-eyebrow">
              <span className="stage-eyebrow__dot stage-eyebrow__dot--amber" />
              <span>END OF TURN {review.turn} · CAMPAIGN READOUT</span>
            </div>
            <h1 className="stage-title">Turn {review.turn} Strategic Summary</h1>
            <p className="stage-subtitle">
              Resource and influence trajectories across the campaign, with the major mechanical changes from this turn called out before the map review.
            </p>
          </div>
          <Button variant="primary" onClick={onContinue}>Continue to Theater Map →</Button>
        </header>

        <div className="turn-dashboard">
          <TrendChart state={state} history={review.history} metric="rp" title="Resource Points" />
          <TrendChart state={state} history={review.history} metric="ip" title="Influence Points" />
        </div>

        <section className="turn-brief">
          <div className="turn-brief__panel">
            <h2>Largest Moves</h2>
            {biggestMoves.length > 0 ? (
              <div className="turn-change-list">
                {biggestMoves.map((change) => <ChangePill key={change.key} change={change} />)}
              </div>
            ) : (
              <p className="turn-brief__empty">No scored variables moved this turn.</p>
            )}
          </div>

          <div className="turn-brief__panel">
            <h2>Other Variables</h2>
            {otherChanges.length > 0 || changedFlags.length > 0 ? (
              <div className="turn-change-list">
                {otherChanges.slice(0, 8).map((change) => <ChangePill key={change.key} change={change} />)}
                {changedFlags.slice(0, 4).map((flag) => (
                  <div className="turn-change" key={flag.key}>
                    <div>
                      <b>Scenario flag</b>
                      <span>{flag.label}</span>
                    </div>
                    <strong className="turn-change__delta turn-change__delta--neutral">changed</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="turn-brief__empty">No capability, readiness, per-turn RP, force, or scenario flag changes were recorded.</p>
            )}
          </div>
        </section>
      </div>
    );
  }

	if (review.kind === "end_of_turn_map") {
		return (
			<div className="stack-lg fade-in">
				<header className="theater-disposition__header">
					<div>
						<div className="stage-eyebrow">
							<span className="stage-eyebrow__dot stage-eyebrow__dot--amber" />
							<span>END OF TURN {review.turn} · THEATER MAP</span>
						</div>
						<h1 className="stage-title">Theater Disposition</h1>
						<p className="stage-subtitle">
							Final force disposition for turn {review.turn}. Click any unit for details, then close the turn.
						</p>
					</div>
					<Button variant="primary" onClick={onContinue}>End Turn → Begin Turn {review.turn + 1}</Button>
				</header>
				<div className="end-turn-map">
					<TheaterMap state={state} />
				</div>
			</div>
		);
	}

  if (review.kind === "card_resolution") {
    const card = entryValue(state.cards, review.cardId);
    const isWhiteCell = review.actor === "WhiteCell";
    const tone = isWhiteCell
      ? "white"
      : card?.owner && card.owner !== "WhiteCell"
        ? sideToTone(entryValue(state.players, card.owner)?.side)
        : "white";
    const headerLabel = isWhiteCell
      ? "WHITE CELL ADJUDICATION"
      : `${playerLabel(state, review.actor as PlayerId)} ACTION`;
    const titleText = card?.title ?? (isWhiteCell ? "White Cell Adjudication" : review.cardId);
    return (
      <div className="stack-lg fade-in">
        <header>
          <div className="stage-eyebrow">
            <span className={`stage-eyebrow__dot stage-eyebrow__dot--${tone === "red" ? "red" : tone === "blue" ? "" : "amber"}`} />
            <span>{headerLabel}</span>
          </div>
          <h1 className="stage-title">{titleText}</h1>
          {card?.subtype ? <p className="stage-subtitle">{card.subtype}{card.aor ? ` · ${card.aor}` : ""}</p> : null}
          {!card && isWhiteCell && review.narrative ? (
            <p className="stage-subtitle">{review.narrative}</p>
          ) : null}
        </header>
        <div className="stage-card-row" style={{ alignItems: "flex-start" }}>
          {card ? (
            <PlayerCard card={card} state={state} size="lg" onOpen={() => onOpenCard(card)} />
          ) : null}
          <div className="stack-md" style={{ flex: 1, minWidth: 0 }}>
            {review.rolls.length === 0 ? (
              <DiceResult roll={undefined} pendingLabel="No dice rolled — fixed effect" />
            ) : (
              review.rolls.map((roll) => <DiceResult key={roll.id} roll={roll} />)
            )}
            <EffectsSummary
              title="Effects Summary"
              diff={review.diff}
              state={state}
              card={card}
              outcome={review.outcome}
              rolls={review.rolls}
              narrative={card?.notes || card?.description}
            />
          </div>
        </div>
        <div className="row gap-md">
          <Button variant="primary" onClick={onContinue}>Continue →</Button>
          {card ? <Button variant="ghost" onClick={() => onOpenCard(card)}>Open Card</Button> : null}
        </div>
      </div>
    );
  }

  return null;
}

// ----- Primary stage (no review pending) -----

interface PrimaryStageProps {
	state: GameState;
	bluePlayers: ReturnType<typeof getPlayersBySide>;
	activePlayerId?: PlayerId;
	freePlayIntent: string;
	pendingFreePlay?: { playerId: PlayerId; subphase: "Investments" | "Actions" };
	onSelectBlue: (id: PlayerId) => void;
	onPay: () => void;
	onSetReadiness: (forceId: string, level: ReadinessLevel) => void;
	onAdvanceToActions: () => void;
	onEndBlue: () => void;
	onRequestFreePlay: (playerId: PlayerId, subphase: "Investments" | "Actions") => void;
	onCancelFreePlay: () => void;
	onSubmitFreePlay: () => void;
	onFreePlayIntent: (value: string) => void;
	onOpenCard: (card: Card) => void;
	onPlayCard: (card: Card) => void;
}

function PrimaryStage({
	state,
	bluePlayers,
	activePlayerId,
	onSelectBlue,
	onPay,
	onSetReadiness,
	onAdvanceToActions,
	onEndBlue,
	onRequestFreePlay,
	onOpenCard,
	onPlayCard
}: PrimaryStageProps) {
	if (state.phase === "BlueReadinessBill") {
		return <ReadinessStage state={state} onPay={onPay} onSetReadiness={onSetReadiness} />;
	}
	if (state.phase === "BlueInvestmentsAndActions") {
		return (
			<BlueIAStage
				state={state}
				bluePlayers={bluePlayers}
				activePlayerId={activePlayerId}
				onSelectBlue={onSelectBlue}
				onAdvanceToActions={onAdvanceToActions}
				onEndBlue={onEndBlue}
				onRequestFreePlay={onRequestFreePlay}
				onOpenCard={onOpenCard}
				onPlayCard={onPlayCard}
			/>
		);
	}
	if (state.phase === "GameOver") {
		return <GameOverStage state={state} />;
	}
	return <AutoResolvingStage state={state} />;
}

function AutoResolvingStage({ state }: { state: GameState }) {
  return (
    <div className="stack-md fade-in">
      <header>
        <div className="stage-eyebrow">
          <span className="stage-eyebrow__dot stage-eyebrow__dot--muted" />
          <span>AUTOMATED · AWAITING REVIEWS</span>
        </div>
        <h1 className="stage-title">{phaseLabel(state.phase)}</h1>
        <p className="stage-subtitle">
          The engine is resolving Red and White Cell steps. Reviews will pause for your acknowledgment as needed.
        </p>
      </header>
      <EmptyState>
        <span className="row gap-sm" style={{ justifyContent: "center" }}>
          <Spinner />
          Resolving...
        </span>
      </EmptyState>
    </div>
  );
}

function GameOverStage({ state }: { state: GameState }) {
  const players = entryValues(state.players);
  return (
    <div className="stack-md fade-in">
      <header>
        <div className="stage-eyebrow">
          <span className="stage-eyebrow__dot stage-eyebrow__dot--amber" />
          <span>CAMPAIGN COMPLETE</span>
        </div>
        <h1 className="stage-title">Final State of the World</h1>
        <p className="stage-subtitle">Maximum turn reached. Compare end-state metrics and review the event log.</p>
      </header>
      <div className="stat-grid" style={{ maxWidth: 720 }}>
        {players.map((player) => (
          <div key={player.id} className="stat-cell">
            <div className="stat-cell__label">{player.label}</div>
            <div className="stat-cell__value">{player.influence_points} IP</div>
            <div className="stat-cell__sub">{player.resource_points} RP · NTL {player.national_tech_level}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ReadinessStageProps {
  state: GameState;
  onPay: () => void;
  onSetReadiness: (forceId: string, level: ReadinessLevel) => void;
}

function ReadinessStage({ state, onPay, onSetReadiness }: ReadinessStageProps) {
  const bill = calculateUsReadinessBill(state);
  const usForces = entryValues(state.forces)
    .filter((force) => force.owner === "US")
    .sort((a, b) => a.id.localeCompare(b.id));
  return (
    <div className="stack-md fade-in">
      <header>
        <div className="stage-eyebrow">
          <span className="stage-eyebrow__dot" />
          <span>BLUE READINESS BILL · UNITED STATES</span>
        </div>
        <h1 className="stage-title">Set Readiness, Then Sustain</h1>
        <p className="stage-subtitle">
          Adjust each U.S. force's readiness level to balance combat power against sustainment cost. The bill must be paid before
          the Blue investments sub-phase begins.
        </p>
      </header>

      <div className="readiness-table" role="table" aria-label="U.S. force readiness">
        <div className="readiness-table__row readiness-table__row--head" role="row">
          <span>Force</span>
          <span>Location</span>
          <span>FF</span>
          <span>Readiness</span>
          <span>Mod</span>
        </div>
        {usForces.map((force) => {
          const location = entryValue(state.locations, force.location_id);
          const readiness = (force.readiness_level ?? 100) as ReadinessLevel;
          return (
            <div key={force.id} className="readiness-table__row" role="row">
              <span style={{ fontWeight: 600 }}>{force.id}</span>
              <span>{location?.label ?? force.location_id}</span>
              <span>{force.force_factors}</span>
              <span>
                <ReadinessSlider
                  value={readiness}
                  onChange={(level) => onSetReadiness(force.id, level)}
                  ariaLabel={`Readiness for ${force.id}`}
                />
              </span>
              <span>M{force.modernization_level}</span>
            </div>
          );
        })}
      </div>

      <div className="readiness-table" role="table" aria-label="Sustainment cost breakdown">
        <div className="readiness-table__row readiness-table__row--head" role="row">
          <span>Group</span>
          <span>Forces</span>
          <span>Readiness</span>
          <span style={{ gridColumn: "span 2" }}>Cost</span>
        </div>
        {bill.rows.map((row) => (
          <div key={`${row.location}-${row.readiness}`} className="readiness-table__row">
            <span>{row.location}</span>
            <span>{row.force_factors} FF</span>
            <span>{row.readiness}%</span>
            <span style={{ gridColumn: "span 2", textAlign: "right", fontWeight: 600 }}>{row.cost} RP</span>
          </div>
        ))}
        <div className="readiness-table__row readiness-table__row--total">
          <span style={{ gridColumn: "span 4" }}>Total Sustainment</span>
          <span style={{ textAlign: "right" }}>{bill.total} RP</span>
        </div>
      </div>

      <div className="row gap-md">
        <Button variant="primary" onClick={onPay}>Pay Readiness Bill ({bill.total} RP) →</Button>
        <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.08em" }}>
          U.S. RP: {entryValue(state.players, "US")?.resource_points ?? 0}
        </span>
      </div>
    </div>
  );
}

interface BlueIAStageProps {
	state: GameState;
	bluePlayers: ReturnType<typeof getPlayersBySide>;
	activePlayerId?: PlayerId;
	onSelectBlue: (id: PlayerId) => void;
	onAdvanceToActions: () => void;
	onEndBlue: () => void;
	onRequestFreePlay: (playerId: PlayerId, subphase: "Investments" | "Actions") => void;
	onOpenCard: (card: Card) => void;
	onPlayCard: (card: Card) => void;
}

function BlueIAStage({
	state,
	bluePlayers,
	activePlayerId,
	onSelectBlue,
	onAdvanceToActions,
	onEndBlue,
	onRequestFreePlay,
	onOpenCard,
	onPlayCard
}: BlueIAStageProps) {
	const subphase = state.blue_subphase ?? "Investments";
	const activePlayer = bluePlayers.find((player) => player.id === activePlayerId) ?? bluePlayers[0];
	const allCards = activePlayer ? getPlayerDeck(state, activePlayer.id) : [];
	const inSubphaseCards = allCards.filter((card) => (subphase === "Investments" ? card.type === "Investment" : card.type === "Action"));
	const otherSubphaseCards = allCards.filter((card) => (subphase === "Investments" ? card.type === "Action" : card.type === "Investment"));
	const activeBackKind = subphase === "Investments" ? "Investment" : "Action";
	const activeBackUrl = activePlayer ? cardBackImageUrl(activePlayer.id, activeBackKind) : undefined;
	return (
		<div className="stack-md fade-in">
			<header>
				<div className="stage-eyebrow">
					<span className="stage-eyebrow__dot" />
					<span>BLUE COMMAND · {subphase.toUpperCase()}</span>
				</div>
				<h1 className="stage-title">{subphase === "Investments" ? "Build Posture" : "Take Action"}</h1>
				<p className="stage-subtitle">
					{subphase === "Investments"
						? "Play investment cards to shape capabilities, posture, and tech for the rest of the campaign. Investments must complete before any Blue action."
						: "Play action cards or stand down. Each action may pin or commit forces; effects are summarized after resolution."}
				</p>
			</header>
			<div className="stage-toolbar">
				<span className="section__title">Active Player</span>
				<PlayerSwitcher players={bluePlayers} activeId={activePlayer?.id} onSelect={onSelectBlue} ariaLabel="Active Blue player" />
				<div className="spacer" />
				{subphase === "Investments" ? (
					<Button variant="primary" onClick={onAdvanceToActions}>Begin Blue Actions →</Button>
				) : (
					<Button variant="primary" onClick={onEndBlue}>End Blue Phase →</Button>
				)}
			</div>

      <div className="play-instructions" role="note">
        <span className="play-instructions__pip" aria-hidden />
        <div>
          <strong>Click a card in the deck reference to play it immediately.</strong>{" "}
          <span className="muted">Click the <span className="kbd">i</span> on any card to read its full text first. Cards from the
            other sub-phase are disabled until then.</span>
        </div>
      </div>

			{activePlayer ? (
				<div className="freeplay-cta">
					<div className="freeplay-cta__card" aria-hidden>
						<CardBack
							tone="blue"
							imageUrl={activeBackUrl}
							stamp=""
							label={`${activePlayer.label} ${subphase} card back`}
						/>
					</div>
					<div className="freeplay-cta__copy">
						<div className="freeplay-cta__kicker">{activePlayer.label} · {subphase} card back</div>
						<div className="freeplay-cta__title">Free-Play {subphase}</div>
						<div className="freeplay-cta__sub">
							Use this blank {subphase.toLowerCase()} back when no card fits the play in mind. Describe Blue's intent in
							plain language and the White Cell will translate it into game terms.
						</div>
					</div>
					<Button
						variant="primary"
						className="freeplay-cta__btn"
						onClick={() => onRequestFreePlay(activePlayer.id, subphase)}
					>
						Request Free-Play {subphase}
					</Button>
				</div>
			) : null}

			{inSubphaseCards.length === 0 ? (
				<EmptyState>
					{activePlayer ? `${activePlayer.label} has no ${subphase.toLowerCase()} cards available.` : "Select a Blue player above."}
				</EmptyState>
			) : null}
			{otherSubphaseCards.length > 0 ? (
				<p className="muted" style={{ fontSize: "0.82rem" }}>
					{otherSubphaseCards.length} {subphase === "Investments" ? "action" : "investment"} card(s) are visible in the deck reference but
					disabled until {subphase === "Investments" ? "the action sub-phase" : "investments complete"}.
				</p>
			) : null}

			<details open>
				<summary className="muted" style={{ cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "0.74rem", letterSpacing: "0.08em" }}>
					Show full deck reference for {activePlayer?.label ?? "—"}
				</summary>
				<BlueDeckReference
					state={state}
					activePlayerId={activePlayer?.id}
					onPlayCard={onPlayCard}
					onOpenCard={onOpenCard}
				/>
			</details>
		</div>
	);
}

// ----- Blue deck reference -----

interface BlueDeckReferenceProps {
	state: GameState;
	activePlayerId?: PlayerId;
	onPlayCard: (card: Card) => void;
	onOpenCard: (card: Card) => void;
}

function BlueDeckReference({ state, activePlayerId, onPlayCard, onOpenCard }: BlueDeckReferenceProps) {
	const bluePlayers = getPlayersBySide(state, "Blue");
	const activePlayer = bluePlayers.find((player) => player.id === activePlayerId) ?? bluePlayers[0];
	const cards = activePlayer ? getPlayerDeck(state, activePlayer.id) : [];
	const subphase = state.blue_subphase ?? "Investments";
	const playableType = subphase === "Investments" ? "Investment" : "Action";
	const canPlayCurrentPhase = state.phase === "BlueInvestmentsAndActions";

	return (
		<div className="blue-deck-reference">
			{cards.length === 0 ? (
				<EmptyState>
					{activePlayer ? `${activePlayer.label} has no cards in their action/investment deck.` : "No active Blue player."}
				</EmptyState>
			) : (
				cards.map((card) => {
					const playable = canPlayCurrentPhase && card.type === playableType;
					return (
						<div key={`blue-deck-${activePlayer?.id ?? "none"}-${card.id}`} className="blue-deck-reference__item">
							<Tag tone={playable ? "blue" : "neutral"}>{card.type}</Tag>
							<PlayerCard
								card={card}
								state={state}
								size="compact"
								disabled={!playable}
								onClick={playable ? () => onPlayCard(card) : undefined}
								onOpen={() => onOpenCard(card)}
							/>
						</div>
					);
				})
			)}
		</div>
	);
}
