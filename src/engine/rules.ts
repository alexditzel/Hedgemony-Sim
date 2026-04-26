import { rollD10Record, type DiceRoller } from "./dice";
import {
  applyReadinessImpact,
  getBudgetVariation,
  getConusDeploymentCost,
  getConusReactiveCombatFactors,
  getCrtAOutcome,
  getInTheaterCombatFactors,
  getModernizationCost,
  getProcurementCost,
  getProxyReliabilityResult,
  getReadinessBuyBackCost,
  getReadinessSustainmentCost,
  getRtBOutcome,
  type CtrAColumn,
  type RtBColumn
} from "./tables";
import type {
  AdjudicationRequest,
  Base,
  Card,
  CardId,
  CombatFactorsResult,
  Effect,
  EventLogItem,
  ForceCommitment,
  ForceCounter,
  ForceId,
  GameState,
  GroundTruthItem,
  JsonValue,
  LocationId,
  OutcomeRow,
  PhaseId,
  PlayerId,
  PlayerState,
  ProbabilityOutcome,
  ProxyForce,
  ReadinessLevel,
  ReliabilityLevel,
  RollRecord,
  RuleIssue,
  RuleTag,
  RuleValue,
  Scenario,
  Visibility
} from "./types";

const READINESS_LEVELS: ReadinessLevel[] = [50, 60, 70, 80, 90, 100];
const DEFAULT_RED_SEQUENCE: PlayerId[] = ["RU", "PRC", "DPRK", "IR"];

export interface ReadinessBillRow {
  location: "CONUS" | "OCONUS";
  readiness: ReadinessLevel;
  force_factors: number;
  cost: number;
}

export interface ReadinessBill {
  total: number;
  rows: ReadinessBillRow[];
  issues: RuleIssue[];
}

export interface MovementCostRequest {
  player_id: PlayerId;
  force_ids: ForceId[];
  from_location_id: LocationId;
  to_location_id: LocationId;
  timing: "proactive" | "reactive";
  responding_to_action_id?: string;
}

export interface MovementCostResult {
  cost: number;
  issues: RuleIssue[];
  notes: string[];
}

export interface ResolveCardArgs {
  acting_player_id: PlayerId;
  card_id: CardId;
  blue_commitments?: ForceCommitment[];
  red_commitments?: ForceCommitment[];
  blue_players?: PlayerId[];
  red_players?: PlayerId[];
  modifier?: number;
  proxy_id?: string;
  reliability_level?: ReliabilityLevel;
  private_resolution?: boolean;
}

export interface CardResolutionResult {
  state: GameState;
  outcome?: ProbabilityOutcome | "Success" | "Fail";
  roll?: RollRecord;
  issues: RuleIssue[];
  adjudications: AdjudicationRequest[];
}

function cloneState(state: GameState): GameState {
  return structuredClone(state) as GameState;
}

function makeIssue(
  message: string,
  ruleRefs: string[],
  tags: RuleTag[] = ["DETERMINISTIC"],
  severity: "error" | "adjudication" = "error"
): RuleIssue {
  return {
    id: `issue:${ruleRefs.join(":")}:${message.slice(0, 24)}`,
    severity,
    message,
    rule_refs: ruleRefs,
    tags
  };
}

function visibilityForCard(card?: Card): Visibility {
  return card?.public_private === "Private" ? "private_to_player_and_white_cell" : "public";
}

function nextId(state: GameState, prefix: string): string {
  const count =
    state.event_log.length +
    state.rolls.length +
    state.pending_adjudications.length +
    state.ground_truth.length +
    Object.keys(state.forces).length;
  return `${prefix}-${state.turn}-${count + 1}`;
}

function appendLog(
  state: GameState,
  message: string,
  tags: RuleTag[],
  visibility: Visibility = "public",
  extras: Partial<Pick<EventLogItem, "player_id" | "card_id" | "roll_id">> = {}
): void {
  state.event_log.push({
    id: nextId(state, "log"),
    turn: state.turn,
    phase: state.phase,
    message,
    tags,
    visibility,
    ...extras
  });
}

function addAdjudication(
  state: GameState,
  reason: string,
  ruleRefs: string[],
  payload?: JsonValue,
  requestedBy?: PlayerId,
  cardId?: CardId
): AdjudicationRequest {
  const request: AdjudicationRequest = {
    id: nextId(state, "adj"),
    turn: state.turn,
    phase: state.phase,
    reason,
    rule_refs: ruleRefs,
    tags: ["WHITE_CELL_ADJUDICATION"],
    status: "pending",
    requested_by: requestedBy,
    card_id: cardId,
    payload
  };
  state.pending_adjudications.push(request);
  appendLog(state, `White Cell adjudication required: ${reason}`, ["WHITE_CELL_ADJUDICATION"], "public", {
    player_id: requestedBy,
    card_id: cardId
  });
  return request;
}

function tableIssuePayload(issue: RuleIssue): JsonValue | undefined {
  const [, table, row, column] = issue.id.split(":");
  if (!table || !row || !column || column === "-") {
    return undefined;
  }
  return {
    kind: "table_extension",
    table,
    row,
    column
  };
}

function hasAnyIssue(issues: RuleIssue[]): boolean {
  return issues.length > 0;
}

function isRecord(value: JsonValue): value is Record<string, JsonValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberFrom(value: JsonValue, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function stringFrom(value: JsonValue, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function cardMapFromScenario(scenario: Scenario): Record<CardId, Card> {
  const cards: Record<CardId, Card> = {};
  for (const deck of Object.values(scenario.card_decks.action_investment)) {
    for (const card of deck) {
      cards[card.id] = card;
    }
  }
  for (const deck of Object.values(scenario.card_decks.domestic_event)) {
    for (const card of deck) {
      cards[card.id] = card;
    }
  }
  for (const card of scenario.card_decks.international_event) {
    cards[card.id] = card;
  }
  return cards;
}

function playerMapFromScenario(scenario: Scenario): Record<PlayerId, PlayerState> {
  return Object.fromEntries(
    scenario.players.map((player) => [
      player.id,
      {
        ...player,
        resource_points: scenario.starting_conditions.resources[player.id] ?? player.resource_points,
        influence_points: scenario.starting_conditions.influence[player.id] ?? player.influence_points,
        national_tech_level:
          scenario.starting_conditions.national_tech_levels[player.id] ?? player.national_tech_level,
        critical_capabilities:
          scenario.starting_conditions.critical_capabilities[player.id] ?? player.critical_capabilities,
        victory_condition: scenario.victory_conditions[player.id] ?? player.victory_condition
      }
    ])
  );
}

function forceMapFromScenario(scenario: Scenario): Record<ForceId, ForceCounter> {
  return Object.fromEntries(
    scenario.starting_conditions.force_laydown.map((force) => [
      force.id,
      {
        id: force.id,
        owner: force.owner,
        force_factors: force.force_factors,
        modernization_level: force.modernization_level,
        location_id: force.location_id,
        home_base_id: force.home_base_id,
        readiness_level: force.readiness_level,
        pinned: {
          active: false,
          remaining_turns: null
        },
        reset_required: false,
        procured_turn: undefined,
        proxy: force.proxy ?? false
      }
    ])
  );
}

export function createInitialGameState(scenario: Scenario): GameState {
  const players = playerMapFromScenario(scenario);
  const state: GameState = {
    scenario_title: scenario.title,
    turn: 1,
    phase: "GameStart",
    players,
    forces: forceMapFromScenario(scenario),
    cards: cardMapFromScenario(scenario),
    locations: Object.fromEntries(scenario.map.locations.map((location) => [location.id, location])),
    bases: Object.fromEntries(scenario.starting_conditions.bases.map((base) => [base.id, base])),
    proxy_forces: Object.fromEntries(scenario.starting_conditions.proxy_forces.map((proxy) => [proxy.id, proxy])),
    per_turn_resources: { ...scenario.starting_conditions.per_turn_resources },
    rules_in_effect: scenario.rules_in_effect,
    max_turns: scenario.max_turns,
    active_player_id: undefined,
    blue_subphase: undefined,
    red_sequence: DEFAULT_RED_SEQUENCE.filter((id) => players[id]?.side === "Red"),
    red_signals: {},
    red_plays: {},
    active_red_index: 0,
    readiness_paid_turns: [],
    event_log: [],
    rolls: [],
    pending_adjudications: [],
    pending_resets: [],
    card_play_history: [],
    ground_truth: [],
    scenario_flags: {},
    summaries: {
      state_of_world: {}
    }
  };
  appendLog(state, `Loaded scenario: ${scenario.title}`, ["SCENARIO_DEFINED"], "public");
  return state;
}

export function getPlayersBySide(state: GameState, side: "Blue" | "Red"): PlayerState[] {
  return Object.values(state.players).filter((player) => player.side === side);
}

export function getPlayerDeck(state: GameState, playerId: PlayerId): Card[] {
  const ids = state.players[playerId]?.card_decks.action_investment ?? [];
  return ids.map((id) => state.cards[id]).filter((card): card is Card => Boolean(card));
}

export function recordGameStartSummary(state: GameState, summary: string): GameState {
  const draft = cloneState(state);
  draft.summaries.game_start = summary;
  draft.phase = "RedSignaling";
  appendLog(draft, "Game-start state-of-world summary recorded.", ["SUMMARY_REQUIRED"], "public");
  return draft;
}

export function validateState(state: GameState): RuleIssue[] {
  const issues: RuleIssue[] = [];
  for (const player of Object.values(state.players)) {
    if (player.resource_points < 0 && !player.allow_deficit) {
      issues.push(
        makeIssue(`${player.id} has negative RPs without an explicit deficit exception.`, ["Validation:Resources"])
      );
    }
    for (const [capability, level] of Object.entries(player.critical_capabilities)) {
      if (level > player.national_tech_level) {
        issues.push(
          makeIssue(
            `${player.id} ${capability} Mod Level ${level} exceeds National Tech Level ${player.national_tech_level}.`,
            ["Validation:Capabilities"]
          )
        );
      }
    }
  }
  for (const force of Object.values(state.forces)) {
    const owner = state.players[force.owner];
    if (owner && force.modernization_level > owner.national_tech_level) {
      issues.push(
        makeIssue(
          `${force.id} Mod Level ${force.modernization_level} exceeds ${force.owner} National Tech Level ${owner.national_tech_level}.`,
          ["Validation:ForceModLevel"]
        )
      );
    }
    if (force.owner === "US" && force.readiness_level && !READINESS_LEVELS.includes(force.readiness_level)) {
      issues.push(makeIssue(`${force.id} has unsupported U.S. readiness.`, ["Validation:Readiness"]));
    }
    if (force.pinned.active && force.reset_required) {
      issues.push(
        makeIssue(`${force.id} is both pinned and reset-required; White Cell should confirm availability.`, ["Validation:Reset"], [
          "WHITE_CELL_ADJUDICATION"
        ], "adjudication")
      );
    }
  }
  for (const item of state.ground_truth) {
    if (item.effect.visibility !== "public" && item.visible_to.includes("Public")) {
      issues.push(makeIssue(`${item.id} leaks a private outcome to Public.`, ["Validation:PrivateVisibility"]));
    }
  }
  for (const request of state.pending_adjudications.filter((entry) => entry.status === "pending")) {
    issues.push({
      id: request.id,
      severity: "adjudication",
      message: request.reason,
      rule_refs: request.rule_refs,
      tags: request.tags
    });
  }
  return issues;
}

function phaseIssue(state: GameState, expected: PhaseId | PhaseId[]): RuleIssue | undefined {
  const expectedList = Array.isArray(expected) ? expected : [expected];
  if (!expectedList.includes(state.phase)) {
    return makeIssue(`Expected phase ${expectedList.join(" or ")}, got ${state.phase}.`, ["Turn Sequence"]);
  }
  return undefined;
}

function redSignalMixIssue(cards: Card[]): RuleIssue | undefined {
  if (cards.length !== 3) {
    return undefined;
  }
  const hasAction = cards.some((card) => card.type === "Action");
  const hasInvestment = cards.some((card) => card.type === "Investment");
  if (!hasAction || !hasInvestment) {
    return makeIssue(
      "When three Red cards are signaled, at least one must be Action and at least one must be Investment.",
      ["5.2 Red Signaling Phase"]
    );
  }
  return undefined;
}

export function signalRedCards(
  state: GameState,
  playerId: PlayerId,
  cardIds: CardId[],
  briefSummary = "",
  activationIntent: Record<CardId, "Yes" | "No" | "Undeclared"> = {}
): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "RedSignaling");
  if (phase) {
    issues.push(phase);
  }
  const player = draft.players[playerId];
  if (!player || player.side !== "Red") {
    issues.push(makeIssue(`${playerId} is not a Red player.`, ["5.2 Red Signaling Phase"]));
  }
  if (cardIds.length > 3) {
    issues.push(makeIssue("Red may signal up to three cards.", ["5.2 Red Signaling Phase"]));
  }
  const uniqueCardIds = [...new Set(cardIds)];
  if (uniqueCardIds.length !== cardIds.length) {
    issues.push(makeIssue("Red signaled the same card more than once.", ["5.2 Red Signaling Phase"]));
  }
  const deck = new Set(player?.card_decks.action_investment ?? []);
  const cards = cardIds.map((id) => draft.cards[id]).filter((card): card is Card => Boolean(card));
  for (const cardId of cardIds) {
    if (!deck.has(cardId)) {
      issues.push(makeIssue(`${cardId} is not in ${playerId}'s Action/Investment deck.`, ["6 Cards"]));
    }
  }
  const mixIssue = redSignalMixIssue(cards);
  if (mixIssue) {
    issues.push(mixIssue);
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return { state, issues };
  }
  draft.red_signals[playerId] = {
    player_id: playerId,
    card_ids: cardIds,
    brief_summary: briefSummary,
    activation_intent: activationIntent,
    completed: true
  };
  draft.red_plays[playerId] = {
    player_id: playerId,
    played_card_ids: [],
    skipped: false
  };
  appendLog(draft, `${playerId} signaled ${cardIds.length} card(s): ${cardIds.join(", ")}.`, ["SUMMARY_REQUIRED"], "public", {
    player_id: playerId
  });
  if (briefSummary.trim().length > 0) {
    appendLog(draft, `${playerId} intelligence briefing: ${briefSummary}`, ["SUMMARY_REQUIRED"], "public", {
      player_id: playerId
    });
  }
  return { state: draft, issues };
}

export function allRedPlayersSignaled(state: GameState): boolean {
  return getPlayersBySide(state, "Red").every((player) => state.red_signals[player.id]?.completed);
}

export function beginBlueReadinessBill(state: GameState): { state: GameState; issues: RuleIssue[] } {
  const issues: RuleIssue[] = [];
  if (!allRedPlayersSignaled(state)) {
    issues.push(makeIssue("All Red players must complete signaling before Blue readiness.", ["5.2 Red Signaling Phase"]));
    return { state, issues };
  }
  const draft = cloneState(state);
  draft.phase = "BlueReadinessBill";
  draft.active_player_id = "US";
  appendLog(draft, "Blue phase begins with the U.S. readiness bill.", ["DETERMINISTIC"], "public", {
    player_id: "US"
  });
  return { state: draft, issues };
}

export function setActiveBluePlayer(state: GameState, playerId: PlayerId): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "BlueInvestmentsAndActions");
  if (phase) {
    issues.push(phase);
  }
  const player = draft.players[playerId];
  if (!player || player.side !== "Blue") {
    issues.push(makeIssue(`${playerId} is not a Blue player.`, ["5.3 Blue Investments and Actions Phase"]));
  }
  if (issues.length > 0) {
    return { state, issues };
  }
  draft.active_player_id = playerId;
  appendLog(draft, `Active Blue player is now ${player.label}.`, ["DETERMINISTIC"], "public", {
    player_id: playerId
  });
  return { state: draft, issues };
}

function isConus(state: GameState, locationId: LocationId): boolean {
  const location = state.locations[locationId];
  return locationId === "CONUS" || location?.parent_location_id === "CONUS" || location?.aor_id === "CONUS";
}

export function calculateUsReadinessBill(state: GameState): ReadinessBill {
  const groups = new Map<string, { location: "CONUS" | "OCONUS"; readiness: ReadinessLevel; ffs: number }>();
  for (const force of Object.values(state.forces)) {
    if (force.owner !== "US") {
      continue;
    }
    const readiness = force.readiness_level ?? 100;
    const location = isConus(state, force.location_id) ? "CONUS" : "OCONUS";
    const key = `${location}:${readiness}`;
    const current = groups.get(key) ?? { location, readiness, ffs: 0 };
    current.ffs += force.force_factors;
    groups.set(key, current);
  }
  const rows: ReadinessBillRow[] = [];
  const issues: RuleIssue[] = [];
  let total = 0;
  for (const group of groups.values()) {
    const cost = getReadinessSustainmentCost(
      group.ffs,
      group.readiness,
      group.location,
      state.rules_in_effect.table_extensions
    );
    if (cost.ok) {
      rows.push({
        location: group.location,
        readiness: group.readiness,
        force_factors: group.ffs,
        cost: cost.value
      });
      total += cost.value;
    } else {
      issues.push(cost.issue);
    }
  }
  return { total, rows, issues };
}

function spendResources(
  state: GameState,
  playerId: PlayerId,
  amount: number,
  reason: string,
  allowDeficit = false
): RuleIssue | undefined {
  const player = state.players[playerId];
  if (!player) {
    if (amount === 0) {
      appendLog(state, `${playerId} resolved zero-cost controller action for ${reason}.`, ["DETERMINISTIC"], "public", {
        player_id: playerId
      });
      return undefined;
    }
    return makeIssue(`Unknown player ${playerId}.`, ["Resources"]);
  }
  if (amount < 0) {
    return makeIssue("Spend amount may not be negative.", ["Resources"]);
  }
  if (player.resource_points < amount && !allowDeficit && !player.allow_deficit) {
    return makeIssue(`${playerId} lacks ${amount} RP for ${reason}.`, ["7 Resources and Influence"]);
  }
  player.resource_points -= amount;
  appendLog(state, `${playerId} paid ${amount} RP for ${reason}.`, ["DETERMINISTIC"], "public", { player_id: playerId });
  return undefined;
}

export function payUsReadinessBill(state: GameState): { state: GameState; bill: ReadinessBill; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "BlueReadinessBill");
  if (phase) {
    issues.push(phase);
  }
  const bill = calculateUsReadinessBill(draft);
  issues.push(...bill.issues);
  for (const issue of bill.issues.filter((entry) => entry.severity === "adjudication")) {
    addAdjudication(
      draft,
      issue.message,
      ["15.1 Readiness Sustainment Cost"],
      tableIssuePayload(issue),
      "US"
    );
  }
  if (issues.some((entry) => entry.severity === "error" || entry.severity === "adjudication")) {
    return { state: draft, bill, issues };
  }
  const spendIssue = spendResources(draft, "US", bill.total, "readiness sustainment");
  if (spendIssue) {
    issues.push(spendIssue);
    return { state, bill, issues };
  }
  draft.readiness_paid_turns.push(draft.turn);
  draft.phase = "BlueInvestmentsAndActions";
  draft.active_player_id = "US";
  draft.blue_subphase = "Investments";
  appendLog(draft, `U.S. readiness bill paid: ${bill.total} RP.`, ["DETERMINISTIC"], "public", { player_id: "US" });
  return { state: draft, bill, issues };
}

export function advanceBlueToActions(state: GameState): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "BlueInvestmentsAndActions");
  if (phase) {
    issues.push(phase);
  }
  if (issues.length > 0) {
    return { state, issues };
  }
  draft.blue_subphase = "Actions";
  appendLog(draft, "Blue investments complete. Blue actions may now be resolved.", ["DETERMINISTIC"], "public");
  return { state: draft, issues };
}

function cardBaseCost(card: Card): RuleValue<number> {
  if (card.cost.resource_points === null) {
    return { ok: true, value: 0 };
  }
  if (typeof card.cost.resource_points === "number") {
    return { ok: true, value: card.cost.resource_points };
  }
  if (card.cost.resource_points.requires_adjudication || card.cost.resource_points.expression) {
    return {
      ok: false,
      issue: makeIssue(
        `${card.id} has a card-defined cost that requires White Cell confirmation.`,
        ["6.2 Card Data Schema"],
        ["CARD_DEFINED", "WHITE_CELL_ADJUDICATION"],
        "adjudication"
      )
    };
  }
  return {
    ok: false,
    issue: makeIssue(`${card.id} has an unsupported cost reference.`, ["6.2 Card Data Schema"], ["CARD_DEFINED"], "adjudication")
  };
}

function redAdditionalCardCost(state: GameState, playerId: PlayerId, card: Card): number {
  if (state.players[playerId]?.side !== "Red" || !card.cost.additional_red_card_cost_applies) {
    return 0;
  }
  if (card.subtype === "Procure New Forces") {
    return 0;
  }
  const pace = state.rules_in_effect.optional_pace_of_play ?? {
    additional_cost_starts_after_card_number: 1,
    additional_cost_per_card: 1
  };
  const alreadyPlayed = state.red_plays[playerId]?.played_card_ids.filter((id) => {
    const playedCard = state.cards[id];
    return playedCard?.subtype !== "Procure New Forces";
  }).length ?? 0;
  if (alreadyPlayed < pace.additional_cost_starts_after_card_number) {
    return 0;
  }
  return pace.additional_cost_per_card;
}

function validateCardPhase(state: GameState, card: Card, actorId?: PlayerId): RuleIssue | undefined {
  if (card.play_constraints.phase_restrictions.length === 0) {
    return undefined;
  }
  if (!card.play_constraints.phase_restrictions.includes(state.phase)) {
    return makeIssue(`${card.id} cannot be played during ${state.phase}.`, ["6 Cards"]);
  }
  const owner = card.owner ? state.players[card.owner] : undefined;
  const actor = actorId ? state.players[actorId] : undefined;
  if (state.phase === "BlueInvestmentsAndActions" && (owner?.side === "Blue" || actor?.side === "Blue")) {
    if (card.type === "Investment" && state.blue_subphase !== "Investments") {
      return makeIssue(
        `${card.id} cannot be played after Blue actions have begun.`,
        ["5.3 Blue Investments and Actions Phase"]
      );
    }
    if (card.type === "Action" && state.blue_subphase !== "Actions") {
      return makeIssue(
        `${card.id} cannot be played until Blue investments are complete.`,
        ["5.3 Blue Investments and Actions Phase"]
      );
    }
  }
  return undefined;
}

function validateCardFrequency(state: GameState, playerId: PlayerId, card: Card): RuleIssue | undefined {
  const frequency = card.play_constraints.frequency?.toLowerCase() ?? "";
  if (frequency.length === 0 || frequency.includes("may play every turn") || frequency.includes("can be played each turn")) {
    return undefined;
  }
  const playerHistory = state.card_play_history.filter(
    (entry) => entry.card_id === card.id && entry.player_id === playerId
  );
  if (frequency.includes("once per game") && playerHistory.length > 0) {
    return makeIssue(`${card.id} may only be played once per game by ${playerId}.`, ["6 Cards"]);
  }
  if (frequency.includes("once per two turns")) {
    const lastPlayed = [...playerHistory].sort((left, right) => right.turn - left.turn)[0];
    if (lastPlayed && state.turn - lastPlayed.turn < 2) {
      return makeIssue(`${card.id} may only be played once per two turns by ${playerId}.`, ["6 Cards"]);
    }
  }
  return undefined;
}

function recordCardPlay(state: GameState, playerId: PlayerId, cardId: CardId): void {
  state.card_play_history.push({
    card_id: cardId,
    player_id: playerId,
    turn: state.turn
  });
}

function matchingOutcomeRows(card: Card, outcome: ProbabilityOutcome | "Success" | "Fail", rollTotal?: number): OutcomeRow[] {
  if (rollTotal !== undefined) {
    const rollRows = card.resolution.outcome_map.filter(
      (row) =>
        row.roll_min !== undefined &&
        row.roll_max !== undefined &&
        rollTotal >= row.roll_min &&
        rollTotal <= row.roll_max
    );
    if (rollRows.length > 0) {
      return rollRows;
    }
  }
  return card.resolution.outcome_map.filter((row) => row.outcome === outcome || row.label === outcome);
}

function visibleToForEffect(effect: Effect, owner?: PlayerId): (PlayerId | "WhiteCell" | "Public")[] {
  if (effect.visibility === "public") {
    return ["Public"];
  }
  if (effect.visibility === "white_cell_only") {
    return ["WhiteCell"];
  }
  return owner ? [owner, "WhiteCell"] : ["WhiteCell"];
}

function addGroundTruthForEffect(state: GameState, effect: Effect, owner?: PlayerId, note = ""): void {
  const item: GroundTruthItem = {
    id: nextId(state, "truth"),
    source: effect.source_card_id ?? "rule_id",
    created_turn: state.turn,
    visible_to: visibleToForEffect(effect, owner),
    effect,
    status: effect.timing === "immediate" ? "resolved" : "pending",
    narrative_note: note
  };
  state.ground_truth.push(item);
}

function setPlayerResourceAllocation(state: GameState, playerId: PlayerId, value: JsonValue): void {
  if (typeof value === "number") {
    state.per_turn_resources[playerId] = value;
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  const amount = numberFrom(value.amount);
  const mode = stringFrom(value.mode, "adjust");
  if (mode === "set") {
    state.per_turn_resources[playerId] = amount;
  } else {
    state.per_turn_resources[playerId] = (state.per_turn_resources[playerId] ?? 0) + amount;
  }
}

function applySingleEffect(
  state: GameState,
  effect: Effect,
  owner?: PlayerId,
  trackDeferred = true
): RuleIssue | undefined {
  if (trackDeferred && (effect.visibility !== "public" || effect.timing !== "immediate")) {
    addGroundTruthForEffect(state, effect, owner, "Tracked due to private, future, temporary, or conditional handling.");
  }
  if (effect.requires_adjudication) {
    addAdjudication(state, `Effect ${effect.type} requires White Cell resolution.`, ["6.4 Effect Schema"], effect.value, owner);
    return undefined;
  }
  const target = effect.target === "ACTOR" && owner ? owner : effect.target;
  const player = state.players[target];
  const force = state.forces[target];
  switch (effect.type) {
    case "adjust_resource_points":
      if (player) {
        player.resource_points += numberFrom(effect.value);
      }
      break;
    case "adjust_influence_points":
      if (player) {
        player.influence_points += numberFrom(effect.value);
      }
      break;
    case "set_or_adjust_per_turn_resource_allocation":
      setPlayerResourceAllocation(state, effect.target, effect.value);
      break;
    case "set_national_tech_level":
      if (player) {
        const nextLevel = numberFrom(effect.value, player.national_tech_level);
        const forceAboveCap = Object.values(state.forces).find(
          (force) => force.owner === player.id && force.modernization_level > nextLevel
        );
        const capabilityAboveCap = Object.entries(player.critical_capabilities).find(([, level]) => level > nextLevel);
        if (forceAboveCap || capabilityAboveCap) {
          return makeIssue(
            `${player.id} National Tech Level ${nextLevel} would be below existing force or Critical Capability Mod Levels.`,
            ["14 National Tech and Critical Capability Upgrades"],
            ["WHITE_CELL_ADJUDICATION"],
            "adjudication"
          );
        }
        player.national_tech_level = nextLevel;
      }
      break;
    case "adjust_national_tech_level":
      if (player) {
        const nextLevel = player.national_tech_level + numberFrom(effect.value);
        const forceAboveCap = Object.values(state.forces).find(
          (force) => force.owner === player.id && force.modernization_level > nextLevel
        );
        const capabilityAboveCap = Object.entries(player.critical_capabilities).find(([, level]) => level > nextLevel);
        if (forceAboveCap || capabilityAboveCap) {
          return makeIssue(
            `${player.id} National Tech Level ${nextLevel} would be below existing force or Critical Capability Mod Levels.`,
            ["14 National Tech and Critical Capability Upgrades"],
            ["WHITE_CELL_ADJUDICATION"],
            "adjudication"
          );
        }
        player.national_tech_level = nextLevel;
      }
      break;
    case "set_critical_capability_mod_level":
      if (player && isRecord(effect.value)) {
        const level = numberFrom(effect.value.level);
        if (level > player.national_tech_level) {
          return makeIssue(
            `${player.id} Critical Capability Mod Level ${level} exceeds National Tech Level ${player.national_tech_level}.`,
            ["14 National Tech and Critical Capability Upgrades"],
            ["WHITE_CELL_ADJUDICATION"],
            "adjudication"
          );
        }
        player.critical_capabilities[stringFrom(effect.value.capability)] = level;
      }
      break;
    case "adjust_critical_capability_mod_level":
      if (player && isRecord(effect.value)) {
        const capability = stringFrom(effect.value.capability);
        const nextLevel = (player.critical_capabilities[capability] ?? 0) + numberFrom(effect.value.amount);
        if (nextLevel > player.national_tech_level) {
          return makeIssue(
            `${player.id} ${capability} Mod Level ${nextLevel} exceeds National Tech Level ${player.national_tech_level}.`,
            ["14 National Tech and Critical Capability Upgrades"],
            ["WHITE_CELL_ADJUDICATION"],
            "adjudication"
          );
        }
        player.critical_capabilities[capability] = nextLevel;
      }
      break;
    case "move_forces":
    case "deploy_or_redeploy_forces":
      if (force && typeof effect.value === "string") {
        if (force.pinned.active) {
          return makeIssue(`${force.id} is pinned and may not move without White Cell confirmation.`, ["11.1 Pinned Forces"]);
        }
        force.location_id = effect.value;
      }
      break;
    case "set_readiness_level":
      if (force) {
        force.readiness_level = numberFrom(effect.value, force.readiness_level ?? 100) as ReadinessLevel;
      }
      break;
    case "adjust_readiness_level":
      if (force) {
        const next = (force.readiness_level ?? 100) + numberFrom(effect.value);
        if (!READINESS_LEVELS.includes(next as ReadinessLevel)) {
          return makeIssue(
            `Readiness adjustment would move ${force.id} to ${next}%, outside printed levels.`,
            ["15 U.S. Readiness"],
            ["WHITE_CELL_ADJUDICATION"],
            "adjudication"
          );
        }
        force.readiness_level = next as ReadinessLevel;
      }
      break;
    case "pin_forces":
      if (force) {
        force.pinned = {
          active: true,
          remaining_turns: isRecord(effect.value)
            ? (numberFrom(effect.value.duration_turns, 1) as number | "indefinite")
            : 1,
          area_of_interest_id: isRecord(effect.value) ? stringFrom(effect.value.area_of_interest_id) : undefined
        };
      }
      break;
    case "unpin_forces":
      if (force) {
        force.pinned = { active: false, remaining_turns: null };
      }
      break;
    case "reset_forces":
      if (force) {
        force.reset_required = true;
        force.location_id = force.home_base_id;
        force.reset_available_turn = state.turn + 1;
      }
      break;
    case "create_or_modify_base":
      if (isRecord(effect.value)) {
        const base: Base = {
          id: stringFrom(effect.value.id, effect.target),
          owner: stringFrom(effect.value.owner, owner ?? effect.target),
          location_id: stringFrom(effect.value.location_id, effect.target),
          aor_id: stringFrom(effect.value.aor_id, undefined),
          out_of_area_discount: numberFrom(effect.value.out_of_area_discount, 0),
          notes: stringFrom(effect.value.notes)
        };
        state.bases[base.id] = base;
      }
      break;
    case "create_proxy_force":
      if (isRecord(effect.value)) {
        const proxy: ProxyForce = {
          id: stringFrom(effect.value.id, effect.target),
          sponsor: stringFrom(effect.value.sponsor, owner ?? effect.target),
          label: stringFrom(effect.value.label, effect.target),
          force_factors: numberFrom(effect.value.force_factors),
          modernization_level: numberFrom(effect.value.modernization_level),
          location_id: stringFrom(effect.value.location_id),
          reliability: stringFrom(effect.value.reliability, "Medium") as ReliabilityLevel,
          scope: stringFrom(effect.value.scope)
        };
        state.proxy_forces[proxy.id] = proxy;
      }
      break;
    case "procure_forces":
      if (isRecord(effect.value)) {
        const owner = stringFrom(effect.value.owner, effect.target);
        const id = stringFrom(effect.value.id, `${owner}-F-${Object.keys(state.forces).length + 1}`);
        state.forces[id] = {
          id,
          owner,
          force_factors: numberFrom(effect.value.force_factors),
          modernization_level: numberFrom(effect.value.modernization_level),
          location_id: stringFrom(effect.value.location_id),
          home_base_id: stringFrom(effect.value.home_base_id, stringFrom(effect.value.location_id)),
          readiness_level:
            owner === "US" && typeof effect.value.readiness_level === "number"
              ? (effect.value.readiness_level as ReadinessLevel)
              : undefined,
          pinned: { active: false, remaining_turns: null },
          reset_required: false,
          procured_turn: state.turn,
          proxy: false
        };
      } else {
        addAdjudication(
          state,
          "Effect procure_forces is represented by a dedicated rules command or card-specific procedure.",
          ["6.4 Effect Schema"],
          effect.value,
          owner
        );
      }
      break;
    case "create_scenario_flag":
      state.scenario_flags[target] = effect.value;
      break;
    case "adjust_scenario_flag_number":
      state.scenario_flags[target] = numberFrom(state.scenario_flags[target]) + numberFrom(effect.value);
      break;
    case "schedule_future_effect":
      addGroundTruthForEffect(state, effect, owner, "Future effect scheduled.");
      break;
    case "expire_effect":
      for (const item of state.ground_truth.filter((entry) => entry.id === effect.target)) {
        item.status = "expired";
      }
      break;
    case "pay_readiness_sustainment":
    case "buy_back_readiness":
    case "modernize_forces":
    case "retire_forces":
    case "develop_proxy_force":
    case "employ_proxy_force":
    case "set_visibility":
      addAdjudication(
        state,
        `Effect ${effect.type} is represented by a dedicated rules command or card-specific procedure.`,
        ["6.4 Effect Schema"],
        effect.value,
        owner
      );
      break;
  }
  appendLog(state, `Applied effect ${effect.type} to ${effect.target}.`, ["CARD_DEFINED"], effect.visibility, {
    player_id: owner,
    card_id: effect.source_card_id
  });
  return undefined;
}

export function applyEffects(state: GameState, effects: Effect[], owner?: PlayerId): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  for (const effect of effects) {
    const issue = applySingleEffect(draft, effect, owner);
    if (issue) {
      issues.push(issue);
      if (issue.severity === "adjudication") {
        addAdjudication(draft, issue.message, issue.rule_refs, effect.value, owner, effect.source_card_id);
      }
    }
  }
  return { state: draft, issues };
}

export function calculateCombatFactors(
  state: GameState,
  playerId: PlayerId,
  commitments: ForceCommitment[]
): CombatFactorsResult {
  const extensions = state.rules_in_effect.table_extensions;
  const breakdown: CombatFactorsResult["breakdown"] = [];
  const adjudications: RuleIssue[] = [];
  let total = 0;
  for (const commitment of commitments) {
    const force = state.forces[commitment.force_id];
    if (!force || force.owner !== playerId) {
      adjudications.push(makeIssue(`${commitment.force_id} is not available to ${playerId}.`, ["9 Combat Factors"]));
      continue;
    }
    if (force.pinned.active) {
      adjudications.push(
        makeIssue(
          `${force.id} is pinned; White Cell must confirm whether this action is inside the existing AOI.`,
          ["11.1 Pinned Forces"],
          ["WHITE_CELL_ADJUDICATION"],
          "adjudication"
        )
      );
      continue;
    }
    const tableResult =
      playerId === "US" && commitment.source === "conus_reactive"
        ? getConusReactiveCombatFactors(force.force_factors, force.modernization_level, extensions)
        : getInTheaterCombatFactors(force.force_factors, force.modernization_level, extensions);
    if (!tableResult.ok) {
      adjudications.push(tableResult.issue);
      continue;
    }
    let baseCf = tableResult.value;
    let note = commitment.source === "conus_reactive" ? "US CONUS reactive table" : "In-theater table";
    if (commitment.source === "adjacent_theater") {
      baseCf = Math.ceil(baseCf / 2);
      note += ", adjacent theater halved and rounded up";
    }
    let finalCf = baseCf;
    if (playerId === "US") {
      const readiness = force.readiness_level ?? 100;
      const readinessResult = applyReadinessImpact(baseCf, readiness, extensions);
      if (!readinessResult.ok) {
        adjudications.push(readinessResult.issue);
        continue;
      }
      finalCf = readinessResult.value;
      if (readiness < 100) {
        note += `, readiness ${readiness}% applied`;
      }
    }
    total += finalCf;
    breakdown.push({
      force_id: force.id,
      base_cf: baseCf,
      final_cf: finalCf,
      note
    });
  }
  return { total, breakdown, adjudications };
}

export function selectCrtAColumn(blueCfs: number, redCfs: number): RuleValue<CtrAColumn> {
  if (blueCfs <= 0 || redCfs <= 0) {
    return {
      ok: false,
      issue: makeIssue(
        "CRT A does not define division by zero or no-response cases; use card unopposed rule or White Cell adjudication.",
        ["10.1 CRT A Column Selection"],
        ["WHITE_CELL_ADJUDICATION"],
        "adjudication"
      )
    };
  }
  if (blueCfs === redCfs) {
    return { ok: true, value: "1:1" };
  }
  const blueLarger = blueCfs > redCfs;
  const ratio = Math.floor(Math.max(blueCfs, redCfs) / Math.min(blueCfs, redCfs));
  if (ratio <= 1) {
    return { ok: true, value: "1:1" };
  }
  if (blueLarger) {
    if (ratio >= 4) {
      return { ok: true, value: "Blue >=4:1" };
    }
    return { ok: true, value: ratio >= 3 ? "Blue 3:1" : "Blue 2:1" };
  }
  if (ratio >= 4) {
    return { ok: true, value: "Red >=4:1" };
  }
  return { ok: true, value: ratio >= 3 ? "Red 3:1" : "Red 2:1" };
}

export function selectRtBColumn(blueFfs: number, redFfs: number): RuleValue<RtBColumn> {
  if (blueFfs <= 0 || redFfs <= 0) {
    return {
      ok: false,
      issue: makeIssue(
        "RT B does not define zero-force or no-response cases; use card unopposed rule or White Cell adjudication.",
        ["12.1 RT B Column Selection"],
        ["WHITE_CELL_ADJUDICATION"],
        "adjudication"
      )
    };
  }
  const ratio = Math.floor(Math.max(blueFfs, redFfs) / Math.min(blueFfs, redFfs));
  if (ratio < 2) {
    return { ok: true, value: "Parity" };
  }
  return { ok: true, value: blueFfs > redFfs ? "Blue Advantage" : "Red Advantage" };
}

function bestCapability(state: GameState, players: PlayerId[], capability: string): number {
  return Math.max(0, ...players.map((id) => state.players[id]?.critical_capabilities[capability] ?? 0));
}

function criticalCapabilityModifier(
  state: GameState,
  capabilities: string[],
  bluePlayers: PlayerId[],
  redPlayers: PlayerId[]
): number {
  if (capabilities.length === 0) {
    return 0;
  }
  const bestBlue = Math.max(...capabilities.map((capability) => bestCapability(state, bluePlayers, capability)));
  const bestRed = Math.max(...capabilities.map((capability) => bestCapability(state, redPlayers, capability)));
  return bestBlue - bestRed;
}

function totalFfsForCommitments(state: GameState, commitments: ForceCommitment[]): number {
  return commitments.reduce((sum, commitment) => {
    const force = state.forces[commitment.force_id];
    if (!force) {
      return sum;
    }
    const ffs = commitment.out_of_area_arrival ? Math.ceil(force.force_factors / 2) : force.force_factors;
    return sum + ffs;
  }, 0);
}

function commitmentsOwnedBy(state: GameState, playerId: PlayerId, commitments: ForceCommitment[]): ForceCommitment[] {
  return commitments.filter((commitment) => state.forces[commitment.force_id]?.owner === playerId);
}

function resolveCrtA(
  draft: GameState,
  card: Card,
  args: ResolveCardArgs,
  roller: DiceRoller
): { outcome?: ProbabilityOutcome; roll?: RollRecord; issues: RuleIssue[] } {
  const bluePlayers = args.blue_players ?? getPlayersBySide(draft, "Blue").map((player) => player.id);
  const redPlayers = args.red_players ?? getPlayersBySide(draft, "Red").map((player) => player.id);
  if (!args.blue_commitments || !args.red_commitments) {
    const issue = makeIssue(
      `${card.id} requires force commitments for CRT A.`,
      ["10 CRT A"],
      ["WHITE_CELL_ADJUDICATION"],
      "adjudication"
    );
    addAdjudication(draft, issue.message, issue.rule_refs, undefined, args.acting_player_id, card.id);
    return { issues: [issue] };
  }
  const blueResults = bluePlayers.map((playerId) =>
    calculateCombatFactors(draft, playerId, commitmentsOwnedBy(draft, playerId, args.blue_commitments ?? []))
  );
  const redResults = redPlayers.map((playerId) =>
    calculateCombatFactors(draft, playerId, commitmentsOwnedBy(draft, playerId, args.red_commitments ?? []))
  );
  const blueCf = blueResults.reduce((sum, result) => sum + result.total, 0);
  const redCf = redResults.reduce((sum, result) => sum + result.total, 0);
  const blueBreakdown = blueResults.flatMap((result) => result.adjudications);
  const redBreakdown = redResults.flatMap((result) => result.adjudications);
  const issues = [...blueBreakdown, ...redBreakdown];
  const column = selectCrtAColumn(blueCf, redCf);
  if (!column.ok) {
    issues.push(column.issue);
    addAdjudication(draft, column.issue.message, column.issue.rule_refs, undefined, args.acting_player_id, card.id);
    return { issues };
  }
  const cardModifier = card.resolution.modifiers.reduce((sum, modifier) => sum + (modifier.value ?? 0), 0);
  const capabilityModifier = criticalCapabilityModifier(draft, card.resolution.critical_capabilities, bluePlayers, redPlayers);
  const modifier = cardModifier + capabilityModifier + (args.modifier ?? 0);
  const roll = rollD10Record(roller, {
    id: nextId(draft, "roll"),
    turn: draft.turn,
    phase: draft.phase,
    modifier,
    purpose: `${card.id} CRT A ${column.value}`,
    visibility: visibilityForCard(card)
  });
  draft.rolls.push(roll);
  const outcome = getCrtAOutcome(roll.total, column.value);
  appendLog(
    draft,
    `${card.id} resolved CRT A (${column.value}, Blue ${blueCf} CF vs Red ${redCf} CF): ${roll.formula} => ${outcome}.`,
    ["DETERMINISTIC", "CARD_DEFINED"],
    visibilityForCard(card),
    { player_id: args.acting_player_id, card_id: card.id, roll_id: roll.id }
  );
  return { outcome, roll, issues };
}

function resolveRtB(
  draft: GameState,
  card: Card,
  args: ResolveCardArgs,
  roller: DiceRoller
): { outcome?: ProbabilityOutcome; roll?: RollRecord; issues: RuleIssue[] } {
  if (!args.blue_commitments || !args.red_commitments) {
    const issue = makeIssue(`${card.id} requires force commitments for RT B.`, ["12 RT B"], ["WHITE_CELL_ADJUDICATION"], "adjudication");
    addAdjudication(draft, issue.message, issue.rule_refs, undefined, args.acting_player_id, card.id);
    return { issues: [issue] };
  }
  const blueFfs = totalFfsForCommitments(draft, args.blue_commitments);
  const redFfs = totalFfsForCommitments(draft, args.red_commitments);
  const column = selectRtBColumn(blueFfs, redFfs);
  if (!column.ok) {
    addAdjudication(draft, column.issue.message, column.issue.rule_refs, undefined, args.acting_player_id, card.id);
    return { issues: [column.issue] };
  }
  const modifier = card.resolution.modifiers.reduce((sum, entry) => sum + (entry.value ?? 0), 0) + (args.modifier ?? 0);
  const roll = rollD10Record(roller, {
    id: nextId(draft, "roll"),
    turn: draft.turn,
    phase: draft.phase,
    modifier,
    purpose: `${card.id} RT B ${column.value}`,
    visibility: visibilityForCard(card)
  });
  draft.rolls.push(roll);
  const outcome = getRtBOutcome(roll.total, column.value);
  appendLog(
    draft,
    `${card.id} resolved RT B (${column.value}, Blue ${blueFfs} FF vs Red ${redFfs} FF): ${roll.formula} => ${outcome}.`,
    ["DETERMINISTIC", "CARD_DEFINED"],
    visibilityForCard(card),
    { player_id: args.acting_player_id, card_id: card.id, roll_id: roll.id }
  );
  return { outcome, roll, issues: [] };
}

function resolveCardD10(
  draft: GameState,
  card: Card,
  args: ResolveCardArgs,
  roller: DiceRoller
): { outcome?: ProbabilityOutcome | "Success" | "Fail"; roll?: RollRecord; issues: RuleIssue[] } {
  const modifier = card.resolution.modifiers.reduce((sum, entry) => sum + (entry.value ?? 0), 0) + (args.modifier ?? 0);
  const roll = rollD10Record(roller, {
    id: nextId(draft, "roll"),
    turn: draft.turn,
    phase: draft.phase,
    modifier,
    purpose: `${card.id} card D10 table`,
    visibility: visibilityForCard(card)
  });
  draft.rolls.push(roll);
  const rows = matchingOutcomeRows(card, "SQ", roll.total);
  const outcome = rows[0]?.outcome ?? rows[0]?.label;
  const issues: RuleIssue[] = [];
  if (!outcome) {
    const issue = makeIssue(
      `${card.id} has no card-defined outcome row for modified D10 result ${roll.total}.`,
      ["6.3 Resolution Methods"],
      ["CARD_DEFINED", "WHITE_CELL_ADJUDICATION"],
      "adjudication"
    );
    issues.push(issue);
    addAdjudication(draft, issue.message, issue.rule_refs, { card_id: card.id, roll_total: roll.total }, args.acting_player_id, card.id);
  }
  appendLog(draft, `${card.id} rolled ${roll.formula}${outcome ? ` => ${outcome}` : ""}.`, ["CARD_DEFINED"], visibilityForCard(card), {
    player_id: args.acting_player_id,
    card_id: card.id,
    roll_id: roll.id
  });
  return { outcome: outcome as ProbabilityOutcome | "Success" | "Fail" | undefined, roll, issues };
}

function applyCardOutcome(
  draft: GameState,
  card: Card,
  actor: PlayerId,
  outcome?: ProbabilityOutcome | "Success" | "Fail",
  rollTotal?: number
): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const rows = outcome ? matchingOutcomeRows(card, outcome, rollTotal) : [];
  const effects = rows.length > 0 ? [...card.effects, ...rows.flatMap((row) => row.effects)] : card.effects;
  for (const effect of effects) {
    const issue = applySingleEffect(draft, { ...effect, source_card_id: effect.source_card_id ?? card.id }, actor);
    if (issue) {
      issues.push(issue);
      if (issue.severity === "adjudication") {
        addAdjudication(draft, issue.message, issue.rule_refs, effect.value, actor, card.id);
      }
    }
  }
  for (const future of card.future_effects) {
    draft.ground_truth.push({
      id: nextId(draft, "truth"),
      source: card.id,
      created_turn: draft.turn,
      visible_to: ["WhiteCell", actor],
      effect: future.effect,
      trigger_turn: future.trigger_turn,
      expiration_turn: future.expiration_turn,
      trigger_condition: future.trigger_condition,
      status: "pending",
      narrative_note: `Future effect from ${card.id}`
    });
  }
  return issues;
}

export function resolveCard(state: GameState, args: ResolveCardArgs, roller: DiceRoller): CardResolutionResult {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const card = draft.cards[args.card_id];
  if (!card) {
    return {
      state,
      issues: [makeIssue(`Unknown card ${args.card_id}.`, ["6 Cards"])],
      adjudications: []
    };
  }
  const phase = validateCardPhase(draft, card, args.acting_player_id);
  if (phase) {
    issues.push(phase);
  }
  const frequency = validateCardFrequency(draft, args.acting_player_id, card);
  if (frequency) {
    issues.push(frequency);
  }
  const cost = cardBaseCost(card);
  if (!cost.ok) {
    issues.push(cost.issue);
    addAdjudication(draft, cost.issue.message, cost.issue.rule_refs, undefined, args.acting_player_id, card.id);
  } else {
    const extraCost = redAdditionalCardCost(draft, args.acting_player_id, card);
    const spendIssue = spendResources(draft, args.acting_player_id, cost.value + extraCost, `playing ${card.id}`);
    if (spendIssue) {
      issues.push(spendIssue);
    }
  }
  if (issues.some((issue) => issue.severity === "error")) {
    return { state, issues, adjudications: [] };
  }
  if (issues.some((issue) => issue.severity === "adjudication")) {
    return {
      state: draft,
      issues,
      adjudications: draft.pending_adjudications.filter((entry) => entry.status === "pending")
    };
  }

  let outcome: ProbabilityOutcome | "Success" | "Fail" | undefined;
  let roll: RollRecord | undefined;
  const method = card.resolution.method.find((entry) => entry !== "white_cell_adjudication") ?? "white_cell_adjudication";

  if (method === "fixed_effect") {
    appendLog(draft, `${card.id} resolved as a fixed effect.`, ["CARD_DEFINED"], visibilityForCard(card), {
      player_id: args.acting_player_id,
      card_id: card.id
    });
  } else if (method === "card_d10_table") {
    const resolved = resolveCardD10(draft, card, args, roller);
    issues.push(...resolved.issues);
    outcome = resolved.outcome;
    roll = resolved.roll;
  } else if (method === "crt_a_then_card_outcome") {
    const resolved = resolveCrtA(draft, card, args, roller);
    issues.push(...resolved.issues);
    outcome = resolved.outcome;
    roll = resolved.roll;
  } else if (method === "rt_b_then_card_outcome") {
    const resolved = resolveRtB(draft, card, args, roller);
    issues.push(...resolved.issues);
    outcome = resolved.outcome;
    roll = resolved.roll;
  } else if (method === "proxy_reliability") {
    const proxy = args.proxy_id ? draft.proxy_forces[args.proxy_id] : undefined;
    const reliability = args.reliability_level ?? proxy?.reliability;
    if (!reliability) {
      const issue = makeIssue(`${card.id} needs a proxy reliability level.`, ["16 Proxy Forces"], ["WHITE_CELL_ADJUDICATION"], "adjudication");
      issues.push(issue);
      addAdjudication(draft, issue.message, issue.rule_refs, undefined, args.acting_player_id, card.id);
    } else {
      const proxyRoll = rollD10Record(roller, {
        id: nextId(draft, "roll"),
        turn: draft.turn,
        phase: draft.phase,
        purpose: `${card.id} proxy reliability (${reliability})`,
        visibility: visibilityForCard(card)
      });
      draft.rolls.push(proxyRoll);
      outcome = getProxyReliabilityResult(proxyRoll.total, reliability);
      roll = proxyRoll;
      appendLog(draft, `${card.id} proxy reliability: ${proxyRoll.formula} => ${outcome}.`, ["DETERMINISTIC"], visibilityForCard(card), {
        player_id: args.acting_player_id,
        card_id: card.id,
        roll_id: proxyRoll.id
      });
    }
  } else {
    issues.push(...applyCardOutcome(draft, card, args.acting_player_id));
    const request = addAdjudication(
      draft,
      `${card.id} resolution is White Cell adjudicated.`,
      ["6.3 Resolution Methods"],
      undefined,
      args.acting_player_id,
      card.id
    );
    recordCardPlay(draft, args.acting_player_id, card.id);
    appendLog(draft, `${args.acting_player_id} played ${card.id}: ${card.title}.`, ["CARD_DEFINED"], visibilityForCard(card), {
      player_id: args.acting_player_id,
      card_id: card.id
    });
    return { state: draft, issues, adjudications: [request] };
  }

  if (!hasAnyIssue(issues)) {
    issues.push(...applyCardOutcome(draft, card, args.acting_player_id, outcome, roll?.total));
    if (hasAnyIssue(issues)) {
      return {
        state: draft,
        outcome,
        roll,
        issues,
        adjudications: draft.pending_adjudications.filter((entry) => entry.status === "pending")
      };
    }
    if (card.resolution.pinning) {
      for (const commitment of [...(args.blue_commitments ?? []), ...(args.red_commitments ?? [])]) {
        const force = draft.forces[commitment.force_id];
        if (force) {
          force.pinned = {
            active: true,
            remaining_turns: card.resolution.pinning.duration_turns,
            area_of_interest_id: card.resolution.pinning.area_of_interest_id
          };
        }
      }
    }
    if (card.resolution.reset_rules_apply && outcome && outcome !== "Success" && outcome !== "Fail") {
      const forceIds = [...(args.blue_commitments ?? []), ...(args.red_commitments ?? [])].map((entry) => entry.force_id);
      if (card.resolution.pinning) {
        draft.pending_resets.push({
          id: nextId(draft, "reset"),
          force_ids: forceIds,
          outcome,
          status: "pending_after_pinning"
        });
        appendLog(draft, `${card.id} reset rules scheduled after pinning is removed.`, ["CARD_DEFINED"], visibilityForCard(card), {
          player_id: args.acting_player_id,
          card_id: card.id
        });
      } else {
        const reset = applyResetRules(draft, forceIds, outcome);
        draft.forces = reset.state.forces;
        draft.players = reset.state.players;
        draft.event_log = reset.state.event_log;
        draft.pending_adjudications = reset.state.pending_adjudications;
        draft.pending_resets = reset.state.pending_resets;
        issues.push(...reset.issues);
      }
    }
  }
  appendLog(draft, `${args.acting_player_id} played ${card.id}: ${card.title}.`, ["CARD_DEFINED"], visibilityForCard(card), {
    player_id: args.acting_player_id,
    card_id: card.id
  });
  recordCardPlay(draft, args.acting_player_id, card.id);
  return {
    state: draft,
    outcome,
    roll,
    issues,
    adjudications: draft.pending_adjudications.filter((entry) => entry.status === "pending")
  };
}

const RED_PLAY_MIX_RULE_REFS = ["5.4 Red Investments and Actions Phase"];
const RED_PLAY_MIX_MESSAGE =
  "A Red player who plays more than one card must have at least one Action and one Investment card among played cards.";

function redPlayedMixIssueForCardIds(state: GameState, playedIds: CardId[]): RuleIssue | undefined {
  if (playedIds.length <= 1) {
    return undefined;
  }
  const cards = playedIds.map((id) => state.cards[id]).filter((card): card is Card => Boolean(card));
  const hasAction = cards.some((card) => card.type === "Action");
  const hasInvestment = cards.some((card) => card.type === "Investment");
  if (hasAction && hasInvestment) {
    return undefined;
  }
  return makeIssue(RED_PLAY_MIX_MESSAGE, RED_PLAY_MIX_RULE_REFS);
}

function redPlayDeadEndIssue(state: GameState, playerId: PlayerId, cardId: CardId): RuleIssue | undefined {
  const signal = state.red_signals[playerId];
  const play = state.red_plays[playerId];
  if (!signal || !play) {
    return undefined;
  }
  const playedIds = [...play.played_card_ids, cardId];
  if (!redPlayedMixIssueForCardIds(state, playedIds)) {
    return undefined;
  }
  const remainingIds = signal.card_ids.filter((id) => !playedIds.includes(id));
  const canStillCompleteMix = remainingIds.some((remainingId) => !redPlayedMixIssueForCardIds(state, [...playedIds, remainingId]));
  if (canStillCompleteMix) {
    return undefined;
  }
  return makeIssue(
    `${cardId} would leave ${playerId} unable to finish with at least one Action and one Investment card among played cards.`,
    RED_PLAY_MIX_RULE_REFS
  );
}

export function getRedChoiceOptions(state: GameState, playerId: PlayerId): { remaining: Card[]; canSkip: boolean } {
  const signal = state.red_signals[playerId];
  const play = state.red_plays[playerId];
  if (!signal || !play || play.skipped) {
    return { remaining: [], canSkip: true };
  }
  const remaining = signal.card_ids
    .filter((id) => !play.played_card_ids.includes(id))
    .filter((id) => !redPlayDeadEndIssue(state, playerId, id))
    .map((id) => state.cards[id])
    .filter((card): card is Card => Boolean(card));
  return { remaining, canSkip: !redPlayedMixIssueForCardIds(state, play.played_card_ids) };
}

function redPlayedMixValid(state: GameState, playerId: PlayerId): boolean {
  return !redPlayedMixIssueForCardIds(state, state.red_plays[playerId]?.played_card_ids ?? []);
}

export function playRedSignaledCard(
  state: GameState,
  playerId: PlayerId,
  cardId: CardId,
  roller: DiceRoller,
  args: Omit<ResolveCardArgs, "acting_player_id" | "card_id"> = {}
): CardResolutionResult {
  const signal = state.red_signals[playerId];
  const play = state.red_plays[playerId];
  if (!signal || !play || !signal.card_ids.includes(cardId) || play.played_card_ids.includes(cardId) || play.skipped) {
    return {
      state,
      issues: [makeIssue(`${cardId} is not a remaining signaled card for ${playerId}.`, ["5.4 Red Investments and Actions Phase"])],
      adjudications: []
    };
  }
  const deadEndIssue = redPlayDeadEndIssue(state, playerId, cardId);
  if (deadEndIssue) {
    return {
      state,
      issues: [deadEndIssue],
      adjudications: []
    };
  }
  const resolved = resolveCard(state, { ...args, acting_player_id: playerId, card_id: cardId }, roller);
  if (!resolved.issues.some((issue) => issue.severity === "error")) {
    resolved.state.red_plays[playerId] = {
      ...resolved.state.red_plays[playerId],
      played_card_ids: [...resolved.state.red_plays[playerId].played_card_ids, cardId]
    };
    appendLog(resolved.state, `${playerId} has remaining signaled options: ${getRedChoiceOptions(resolved.state, playerId).remaining.map((card) => card.id).join(", ") || "none"}.`, ["DETERMINISTIC"], "public", {
      player_id: playerId
    });
  }
  return resolved;
}

export function skipRemainingRedCards(state: GameState, playerId: PlayerId): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  if (!redPlayedMixValid(draft, playerId)) {
    issues.push(makeIssue(RED_PLAY_MIX_MESSAGE, RED_PLAY_MIX_RULE_REFS));
    return { state, issues };
  }
  if (!draft.red_plays[playerId]) {
    issues.push(makeIssue(`${playerId} has no Red play state.`, ["5.4 Red Investments and Actions Phase"]));
    return { state, issues };
  }
  draft.red_plays[playerId].skipped = true;
  appendLog(draft, `${playerId} skipped remaining signaled cards.`, ["DETERMINISTIC"], "public", { player_id: playerId });
  return { state: draft, issues };
}

export function beginRedInvestmentsAndActions(
  state: GameState,
  sequence?: PlayerId[],
  roller?: DiceRoller
): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "BlueInvestmentsAndActions");
  if (phase) {
    issues.push(phase);
    return { state, issues };
  }
  if (draft.blue_subphase !== "Actions") {
    issues.push(
      makeIssue(
        "Blue investments must be ended with the action sub-phase before the Blue phase can end.",
        ["5.3 Blue Investments and Actions Phase"]
      )
    );
    return { state, issues };
  }
  if (sequence) {
    const redPlayers = getPlayersBySide(draft, "Red").map((player) => player.id);
    const uniqueSequence = new Set(sequence);
    const missing = redPlayers.filter((playerId) => !uniqueSequence.has(playerId));
    const unknown = sequence.filter((playerId) => !redPlayers.includes(playerId));
    if (uniqueSequence.size !== sequence.length || missing.length > 0 || unknown.length > 0) {
      issues.push(
        makeIssue(
          "Red player sequence must include each Red player exactly once.",
          ["5.4 Red Investments and Actions Phase", "17.4 Random Red Player Sequence"]
        )
      );
      return { state, issues };
    }
    draft.red_sequence = sequence;
  } else if (draft.rules_in_effect.random_red_sequence) {
    if (!roller) {
      issues.push(
        makeIssue(
          "Random Red player sequence requires a D10 roller.",
          ["17.4 Random Red Player Sequence"]
        )
      );
      return { state, issues };
    }
    const rolls = getPlayersBySide(draft, "Red").map((player) => {
      const roll = rollD10Record(roller, {
        id: nextId(draft, "roll"),
        turn: draft.turn,
        phase: draft.phase,
        purpose: `${player.id} random Red sequence`,
        visibility: "public"
      });
      draft.rolls.push(roll);
      return { playerId: player.id, roll: roll.total };
    });
    const direction = draft.rules_in_effect.random_red_sequence_order ?? "ascending";
    const hasTie = new Set(rolls.map((entry) => entry.roll)).size !== rolls.length;
    if (hasTie && draft.rules_in_effect.random_red_sequence_tie_rule !== "player_id") {
      addAdjudication(draft, "Random Red sequence has a tie.", ["17.4 Random Red Player Sequence"]);
    }
    draft.red_sequence = rolls
      .sort((left, right) =>
        direction === "ascending"
          ? left.roll - right.roll || left.playerId.localeCompare(right.playerId)
          : right.roll - left.roll || left.playerId.localeCompare(right.playerId)
      )
      .map((entry) => entry.playerId);
  } else {
    issues.push(
      makeIssue(
        "White Cell must choose the Red player sequence under default rules.",
        ["5.4 Red Investments and Actions Phase"]
      )
    );
    return { state, issues };
  }
  draft.phase = "RedInvestmentsAndActions";
  draft.blue_subphase = undefined;
  draft.active_red_index = 0;
  draft.active_player_id = draft.red_sequence[0];
  appendLog(draft, `Red Investments and Actions sequence: ${draft.red_sequence.join(", ")}.`, ["WHITE_CELL_ADJUDICATION"], "public");
  return { state: draft, issues };
}

export function advanceRedActivePlayer(state: GameState): GameState {
  const draft = cloneState(state);
  const nextIndex = draft.active_red_index + 1;
  if (nextIndex >= draft.red_sequence.length) {
    draft.phase = "AnnualResourcesAllocation";
    draft.active_player_id = undefined;
    appendLog(draft, "Red phase complete. Annual resources allocation begins.", ["DETERMINISTIC"], "public");
  } else {
    draft.active_red_index = nextIndex;
    draft.active_player_id = draft.red_sequence[nextIndex];
    appendLog(draft, `Active Red player is now ${draft.active_player_id}.`, ["DETERMINISTIC"], "public", {
      player_id: draft.active_player_id
    });
  }
  return draft;
}

export function calculateMovementCost(state: GameState, request: MovementCostRequest): MovementCostResult {
  const notes: string[] = [];
  const issues: RuleIssue[] = [];
  const from = state.locations[request.from_location_id];
  const to = state.locations[request.to_location_id];
  if (!from || !to) {
    return {
      cost: 0,
      issues: [makeIssue("Movement request references an unknown location.", ["8 Deployment, Redeployment, and Bases"])],
      notes
    };
  }
  if (from.aor_id === to.aor_id || request.from_location_id === request.to_location_id || to.country_owner === request.player_id) {
    return { cost: 0, issues, notes: ["Same AOR, same location, or own country movement is free."] };
  }
  const forces = request.force_ids.map((id) => state.forces[id]).filter((force): force is ForceCounter => Boolean(force));
  if (forces.some((force) => force.home_base_id === request.to_location_id)) {
    return { cost: 0, issues, notes: ["Redeployment back to home base is free."] };
  }
  const totalFfs = forces.reduce((sum, force) => sum + force.force_factors, 0);
  if (request.player_id === "US" && isConus(state, request.from_location_id) && !isConus(state, request.to_location_id)) {
    const table = getConusDeploymentCost(totalFfs, request.timing, state.rules_in_effect.table_extensions);
    if (table.ok) {
      return { cost: table.value, issues, notes: [`U.S. CONUS ${request.timing} deployment table used.`] };
    }
    issues.push(table.issue);
    return { cost: 0, issues, notes };
  }
  if (!isConus(state, request.from_location_id) && !isConus(state, request.to_location_id)) {
    return { cost: 1, issues, notes: ["OCONUS-to-OCONUS redeployment costs 1 RP per movement."] };
  }
  issues.push(
    makeIssue(
      "Movement cost depends on collocation, card-defined out-of-area rules, or scenario facts.",
      ["8.1 General Movement Cost Rules"],
      ["WHITE_CELL_ADJUDICATION"],
      "adjudication"
    )
  );
  return { cost: 0, issues, notes };
}

export function buyBackReadiness(
  state: GameState,
  forceIds: ForceId[],
  targetReadiness: ReadinessLevel
): { state: GameState; cost: number; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  let totalCost = 0;
  const groups = new Map<string, { location: "CONUS" | "OCONUS"; increase: number; ffs: number; forceIds: ForceId[] }>();
  for (const forceId of forceIds) {
    const force = draft.forces[forceId];
    if (!force || force.owner !== "US") {
      issues.push(makeIssue(`${forceId} is not a U.S. force.`, ["15.2 Readiness Buy-Back Cost"]));
      continue;
    }
    const current = force.readiness_level ?? 100;
    if (targetReadiness <= current) {
      issues.push(makeIssue(`${forceId} is already at or above ${targetReadiness}% readiness.`, ["15.2 Readiness Buy-Back Cost"]));
      continue;
    }
    const increase = targetReadiness - current;
    const location = isConus(draft, force.location_id) ? "CONUS" : "OCONUS";
    const key = `${location}:${increase}`;
    const group = groups.get(key) ?? { location, increase, ffs: 0, forceIds: [] };
    group.ffs += force.force_factors;
    group.forceIds.push(forceId);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const cost = getReadinessBuyBackCost(group.ffs, group.increase, group.location, draft.rules_in_effect.table_extensions);
    if (cost.ok) {
      totalCost += cost.value;
    } else {
      issues.push(cost.issue);
    }
  }
  if (issues.length > 0) {
    return { state, cost: 0, issues };
  }
  const spendIssue = spendResources(draft, "US", totalCost, `readiness buy-back to ${targetReadiness}%`);
  if (spendIssue) {
    return { state, cost: totalCost, issues: [spendIssue] };
  }
  for (const forceId of forceIds) {
    draft.forces[forceId].readiness_level = targetReadiness;
  }
  return { state: draft, cost: totalCost, issues };
}

export function procureForces(
  state: GameState,
  args: {
    player_id: PlayerId;
    force_factors: number;
    modernization_level: number;
    location_id: LocationId;
    home_base_id: LocationId;
    readiness_level?: ReadinessLevel;
    id?: ForceId;
  }
): { state: GameState; force_id?: ForceId; cost: number; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const player = draft.players[args.player_id];
  const issues: RuleIssue[] = [];
  if (!player) {
    return { state, cost: 0, issues: [makeIssue(`Unknown player ${args.player_id}.`, ["13.1 Procurement"])] };
  }
  if (args.modernization_level > player.national_tech_level) {
    issues.push(makeIssue("Procured force Mod Level may not exceed National Tech Level.", ["13.1 Procurement"]));
  }
  const cost = getProcurementCost(args.force_factors, args.modernization_level, draft.rules_in_effect.table_extensions);
  if (!cost.ok) {
    issues.push(cost.issue);
    return { state, cost: 0, issues };
  }
  if (issues.length > 0) {
    return { state, cost: 0, issues };
  }
  const spendIssue = spendResources(draft, args.player_id, cost.value, "force procurement");
  if (spendIssue) {
    return { state, cost: cost.value, issues: [spendIssue] };
  }
  const id = args.id ?? `${args.player_id}-F-${Object.keys(draft.forces).length + 1}`;
  draft.forces[id] = {
    id,
    owner: args.player_id,
    force_factors: args.force_factors,
    modernization_level: args.modernization_level,
    location_id: args.location_id,
    home_base_id: args.home_base_id,
    readiness_level: args.player_id === "US" ? (args.readiness_level ?? 100) : undefined,
    pinned: { active: false, remaining_turns: null },
    reset_required: false,
    procured_turn: draft.turn,
    proxy: false
  };
  appendLog(draft, `${args.player_id} procured ${args.force_factors} FF at M${args.modernization_level}.`, ["DETERMINISTIC"], "public", {
    player_id: args.player_id
  });
  return { state: draft, force_id: id, cost: cost.value, issues };
}

export function modernizeForces(
  state: GameState,
  args: {
    player_id: PlayerId;
    force_ids: ForceId[];
    target_modernization_level: number;
    percent_limit?: number;
  }
): { state: GameState; cost: number; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const player = draft.players[args.player_id];
  const issues: RuleIssue[] = [];
  if (!player) {
    return { state, cost: 0, issues: [makeIssue(`Unknown player ${args.player_id}.`, ["13.2 Modernization"])] };
  }
  if (args.target_modernization_level > player.national_tech_level) {
    issues.push(makeIssue("Modernized force Mod Level may not exceed National Tech Level.", ["13.2 Modernization"]));
  }
  const ownedForces = Object.values(draft.forces).filter((force) => force.owner === args.player_id);
  const requestedForces = args.force_ids.map((id) => draft.forces[id]).filter((force): force is ForceCounter => Boolean(force));
  const requestedFfs = requestedForces.reduce((sum, force) => sum + force.force_factors, 0);
  if (args.percent_limit !== undefined) {
    const allowedFfs = Math.floor(ownedForces.reduce((sum, force) => sum + force.force_factors, 0) * args.percent_limit);
    if (requestedFfs > allowedFfs) {
      issues.push(makeIssue("Modernization exceeds the card-defined percentage limit.", ["13.2 Modernization"]));
    }
  }
  let totalCost = 0;
  for (const force of requestedForces) {
    if (force.owner !== args.player_id) {
      issues.push(makeIssue(`${force.id} is not owned by ${args.player_id}.`, ["13.2 Modernization"]));
    }
    if (force.pinned.active) {
      issues.push(makeIssue("Pinned forces may not be modernized.", ["13.2 Modernization"]));
    }
    if (force.procured_turn === draft.turn) {
      issues.push(makeIssue("Forces may not be modernized in the same turn in which they were procured.", ["13.2 Modernization"]));
    }
    const increase = args.target_modernization_level - force.modernization_level;
    if (increase <= 0) {
      issues.push(makeIssue(`${force.id} is already at or above target Mod Level.`, ["13.2 Modernization"]));
      continue;
    }
    const cost = getModernizationCost(force.force_factors, increase, draft.rules_in_effect.table_extensions);
    if (cost.ok) {
      totalCost += cost.value;
    } else {
      issues.push(cost.issue);
    }
  }
  if (issues.length > 0) {
    return { state, cost: 0, issues };
  }
  const spendIssue = spendResources(draft, args.player_id, totalCost, "force modernization");
  if (spendIssue) {
    return { state, cost: totalCost, issues: [spendIssue] };
  }
  for (const force of requestedForces) {
    draft.forces[force.id].modernization_level = args.target_modernization_level;
  }
  appendLog(draft, `${args.player_id} modernized ${requestedFfs} FF to M${args.target_modernization_level}.`, ["DETERMINISTIC"], "public", {
    player_id: args.player_id
  });
  return { state: draft, cost: totalCost, issues };
}

export function retireUsForces(state: GameState, forceIds: ForceId[]): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "BlueInvestmentsAndActions");
  if (phase) {
    issues.push(phase);
  }
  for (const forceId of forceIds) {
    const force = draft.forces[forceId];
    if (!force || force.owner !== "US") {
      issues.push(makeIssue(`${forceId} is not a U.S. force.`, ["13.3 Retirement"]));
    } else if (!isConus(draft, force.location_id)) {
      issues.push(makeIssue("U.S. forces may be retired only if they start the turn in CONUS.", ["13.3 Retirement"]));
    }
  }
  if (issues.length > 0) {
    return { state, issues };
  }
  for (const forceId of forceIds) {
    delete draft.forces[forceId];
  }
  appendLog(draft, `U.S. retired ${forceIds.length} force counter(s).`, ["DETERMINISTIC"], "public", { player_id: "US" });
  return { state: draft, issues };
}

export function applyResetRules(
  state: GameState,
  committedForceIds: ForceId[],
  outcome: ProbabilityOutcome,
  selectedResetForceIds?: ForceId[]
): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const committed = committedForceIds.map((id) => draft.forces[id]).filter((force): force is ForceCounter => Boolean(force));
  const requiredFfs = Math.ceil(committed.reduce((sum, force) => sum + force.force_factors, 0) / 2);
  let resetFfs = 0;
  const resetIds = selectedResetForceIds ?? committed.map((force) => force.id);
  for (const forceId of resetIds) {
    if (resetFfs >= requiredFfs) {
      break;
    }
    const force = draft.forces[forceId];
    if (!force) {
      continue;
    }
    force.location_id = force.home_base_id;
    force.reset_required = true;
    force.reset_available_turn = draft.turn + 1;
    force.pinned = { active: false, remaining_turns: null };
    resetFfs += force.force_factors;
  }
  if (resetFfs < requiredFfs) {
    issues.push(
      makeIssue("Reset selection covers fewer than 50 percent of committed FFs.", ["11.3 Reset Rules"], ["WHITE_CELL_ADJUDICATION"], "adjudication")
    );
  }
  const usReduction = outcome === "RMG" ? -30 : outcome === "RmG" ? -20 : -10;
  for (const force of committed.filter((entry) => entry.owner === "US")) {
    const current = force.readiness_level ?? 100;
    const next = current + usReduction;
    if (!READINESS_LEVELS.includes(next as ReadinessLevel)) {
      issues.push(
        makeIssue(
          `Reset readiness reduction would move ${force.id} below printed levels.`,
          ["11.3 Reset Rules"],
          ["WHITE_CELL_ADJUDICATION"],
          "adjudication"
        )
      );
      addAdjudication(draft, `Reset readiness reduction for ${force.id} needs White Cell resolution.`, ["11.3 Reset Rules"]);
    } else {
      draft.forces[force.id].readiness_level = next as ReadinessLevel;
    }
  }
  appendLog(draft, `Reset rules applied to ${resetFfs} FF; required ${requiredFfs} FF.`, ["DETERMINISTIC"], "public");
  return { state: draft, issues };
}

export function restoreResetRedForces(state: GameState, playerId: PlayerId, forceIds: ForceId[]): { state: GameState; cost: number; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  let cost = 0;
  for (const forceId of forceIds) {
    const force = draft.forces[forceId];
    if (!force || force.owner !== playerId || draft.players[playerId]?.side !== "Red") {
      issues.push(makeIssue(`${forceId} is not a reset Red force for ${playerId}.`, ["11.3 Reset Rules"]));
      continue;
    }
    cost += force.force_factors;
  }
  if (issues.length > 0) {
    return { state, cost: 0, issues };
  }
  const spendIssue = spendResources(draft, playerId, cost, "restoring reset Red forces");
  if (spendIssue) {
    return { state, cost, issues: [spendIssue] };
  }
  for (const forceId of forceIds) {
    draft.forces[forceId].reset_required = false;
    draft.forces[forceId].reset_available_turn = draft.turn + 1;
  }
  return { state: draft, cost, issues };
}

export function resolveProxyParticipation(
  state: GameState,
  proxyId: string,
  reliability: ReliabilityLevel | undefined,
  roller: DiceRoller
): { state: GameState; outcome?: "Success" | "Fail"; roll?: RollRecord; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const proxy = draft.proxy_forces[proxyId];
  if (!proxy) {
    return { state, issues: [makeIssue(`Unknown proxy ${proxyId}.`, ["16 Proxy Forces"])] };
  }
  const level = reliability ?? proxy.reliability;
  const roll = rollD10Record(roller, {
    id: nextId(draft, "roll"),
    turn: draft.turn,
    phase: draft.phase,
    purpose: `${proxy.label} proxy reliability (${level})`,
    visibility: "public"
  });
  draft.rolls.push(roll);
  const outcome = getProxyReliabilityResult(roll.total, level);
  appendLog(draft, `${proxy.label} proxy reliability ${roll.formula} => ${outcome}.`, ["DETERMINISTIC"], "public");
  return { state: draft, outcome, roll, issues: [] };
}

export function developProxyForce(
  state: GameState,
  args: {
    sponsor_id: PlayerId;
    proxy_id: string;
    intended_ffs: number;
    intended_mod_level: number;
    sponsor_cost_share: number;
    reliability: ReliabilityLevel;
  },
  roller: DiceRoller
): { state: GameState; delivered_ffs: number; delivered_mod_level: number; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const baseCost = getProcurementCost(args.intended_ffs, args.intended_mod_level, draft.rules_in_effect.table_extensions);
  if (!baseCost.ok) {
    return { state, delivered_ffs: 0, delivered_mod_level: 0, issues: [baseCost.issue] };
  }
  const sponsorCost = Math.ceil(baseCost.value * args.sponsor_cost_share);
  const spendIssue = spendResources(draft, args.sponsor_id, sponsorCost, "proxy force development");
  if (spendIssue) {
    return { state, delivered_ffs: 0, delivered_mod_level: 0, issues: [spendIssue] };
  }
  const roll = rollD10Record(roller, {
    id: nextId(draft, "roll"),
    turn: draft.turn,
    phase: draft.phase,
    purpose: `Proxy development ${args.proxy_id}`,
    visibility: "private_to_player_and_white_cell"
  });
  draft.rolls.push(roll);
  const success = getProxyReliabilityResult(roll.total, args.reliability) === "Success";
  const deliveredFfs = success ? args.intended_ffs : Math.max(0, args.intended_ffs - 1);
  const deliveredMod = args.intended_mod_level;
  const proxy = draft.proxy_forces[args.proxy_id];
  if (proxy) {
    proxy.force_factors += deliveredFfs;
    proxy.modernization_level = Math.max(proxy.modernization_level, deliveredMod);
  }
  appendLog(draft, `Proxy development for ${args.proxy_id}: ${roll.formula}.`, ["DETERMINISTIC"], "private_to_player_and_white_cell", {
    player_id: args.sponsor_id,
    roll_id: roll.id
  });
  return { state: draft, delivered_ffs: deliveredFfs, delivered_mod_level: deliveredMod, issues: [] };
}

export function annualResourceAllocation(state: GameState, roller: DiceRoller): { state: GameState; issues: RuleIssue[]; budgetRoll?: RollRecord } {
  const draft = cloneState(state);
  const issues: RuleIssue[] = [];
  const phase = phaseIssue(draft, "AnnualResourcesAllocation");
  if (phase) {
    issues.push(phase);
    return { state, issues };
  }
  const budgetRoll = rollD10Record(roller, {
    id: nextId(draft, "roll"),
    turn: draft.turn,
    phase: draft.phase,
    purpose: "U.S. DoD Budget Variation",
    visibility: "public"
  });
  draft.rolls.push(budgetRoll);
  const usVariation = getBudgetVariation(budgetRoll.total);
  for (const [playerId, allocation] of Object.entries(draft.per_turn_resources)) {
    const amount = playerId === "US" ? allocation + usVariation : allocation;
    draft.players[playerId].resource_points += amount;
    appendLog(draft, `${playerId} received ${amount} RP annual allocation.`, ["DETERMINISTIC"], "public", {
      player_id: playerId,
      roll_id: playerId === "US" ? budgetRoll.id : undefined
    });
  }
  draft.phase = "StateOfWorldSummary";
  appendLog(draft, `U.S. budget variation ${budgetRoll.formula}: ${usVariation >= 0 ? "+" : ""}${usVariation} RP.`, ["DETERMINISTIC"], "public", {
    player_id: "US",
    roll_id: budgetRoll.id
  });
  return { state: draft, issues, budgetRoll };
}

export function recordStateOfWorldSummary(state: GameState, summary: string): GameState {
  const draft = cloneState(state);
  draft.summaries.state_of_world[draft.turn] = summary;
  appendLog(draft, `State-of-world summary recorded for turn ${draft.turn}.`, ["SUMMARY_REQUIRED"], "public");
  for (const force of Object.values(draft.forces)) {
    if (force.pinned.active && typeof force.pinned.remaining_turns === "number") {
      force.pinned.remaining_turns -= 1;
      if (force.pinned.remaining_turns <= 0) {
        force.pinned = { active: false, remaining_turns: null };
      }
    }
    if (force.reset_required && force.reset_available_turn !== undefined && force.reset_available_turn <= draft.turn) {
      force.reset_required = false;
    }
  }
  for (const pendingReset of draft.pending_resets.filter((entry) => entry.status === "pending_after_pinning")) {
    const stillPinned = pendingReset.force_ids.some((forceId) => draft.forces[forceId]?.pinned.active);
    if (!stillPinned) {
      const reset = applyResetRules(draft, pendingReset.force_ids, pendingReset.outcome);
      draft.forces = reset.state.forces;
      draft.players = reset.state.players;
      draft.event_log = reset.state.event_log;
      draft.pending_adjudications = reset.state.pending_adjudications;
      draft.pending_resets = reset.state.pending_resets;
      const updated = draft.pending_resets.find((entry) => entry.id === pendingReset.id);
      if (updated) {
        updated.status = "resolved";
      }
    }
  }
  for (const item of draft.ground_truth) {
    if (item.status === "pending" && item.trigger_turn !== undefined && item.trigger_turn <= draft.turn + 1) {
      const issue = applySingleEffect(draft, item.effect, undefined, false);
      if (issue?.severity === "adjudication") {
        addAdjudication(
          draft,
          issue.message,
          issue.rule_refs,
          item.effect.value,
          undefined,
          item.source === "white_cell" || item.source === "rule_id" ? undefined : item.source
        );
      }
      item.status = "resolved";
    }
    if (item.expiration_turn !== undefined && item.expiration_turn <= draft.turn) {
      item.status = "expired";
    }
  }
  if (draft.turn >= draft.max_turns) {
    draft.phase = "GameOver";
    appendLog(draft, "Maximum turn reached. Game over.", ["SCENARIO_DEFINED"], "public");
  } else {
    draft.turn += 1;
    draft.phase = "RedSignaling";
    draft.active_player_id = undefined;
    draft.blue_subphase = undefined;
    draft.red_signals = {};
    draft.red_plays = {};
    draft.active_red_index = 0;
    appendLog(draft, `Turn ${draft.turn} begins.`, ["DETERMINISTIC"], "public");
  }
  return draft;
}

export function resolveWhiteCellAdjudication(
  state: GameState,
  adjudicationId: string,
  resolutionNote: string,
  effects: Effect[] = []
): { state: GameState; issues: RuleIssue[] } {
  const draft = cloneState(state);
  const request = draft.pending_adjudications.find((entry) => entry.id === adjudicationId);
  if (!request) {
    return { state, issues: [makeIssue(`Unknown adjudication ${adjudicationId}.`, ["19 Digital Adjudication"])] };
  }
  request.status = "resolved";
  request.resolution_note = resolutionNote;
  if (request.payload !== undefined && isRecord(request.payload) && request.payload.kind === "table_extension") {
    const value = Number(resolutionNote.match(/-?\d+/)?.[0]);
    if (!Number.isFinite(value)) {
      return {
        state,
        issues: [
          makeIssue(
            "A table adjudication resolution must include a numeric value.",
            ["19 Digital Adjudication"],
            ["WHITE_CELL_ADJUDICATION"],
            "adjudication"
          )
        ]
      };
    }
    draft.rules_in_effect.table_extensions.push({
      table: stringFrom(request.payload.table),
      row: stringFrom(request.payload.row),
      column: stringFrom(request.payload.column),
      value,
      tag: "SCENARIO_DEFINED"
    });
  }
  appendLog(draft, `White Cell resolved adjudication: ${resolutionNote}`, ["WHITE_CELL_ADJUDICATION"], "public", {
    player_id: request.requested_by,
    card_id: request.card_id
  });
  const applied = applyEffects(draft, effects, request.requested_by);
  return { state: applied.state, issues: applied.issues };
}

export function requestBlueFreePlayAdjudication(
  state: GameState,
  playerId: PlayerId,
  intent: string
): { state: GameState; request: AdjudicationRequest } {
  const draft = cloneState(state);
  const request = addAdjudication(
    draft,
    `Blue free-play action requires translation into game terms: ${intent}`,
    ["5.3 Blue Investments and Actions Phase", "19 Digital Adjudication"],
    { intent },
    playerId
  );
  return { state: draft, request };
}

export function injectWhiteCellEvent(
  state: GameState,
  cardId: CardId,
  note: string,
  roller: DiceRoller
): CardResolutionResult {
  const card = state.cards[cardId];
  if (!card || (card.type !== "DomesticEvent" && card.type !== "InternationalEvent")) {
    return {
      state,
      issues: [makeIssue(`${cardId} is not an event card.`, ["5 Turn Sequence", "6 Cards"])],
      adjudications: []
    };
  }
  const result = resolveCard(state, { acting_player_id: "WhiteCell", card_id: cardId }, roller);
  if (!result.issues.some((issue) => issue.severity === "error")) {
    appendLog(result.state, `White Cell injected event ${cardId}: ${note}`, ["WHITE_CELL_ADJUDICATION"], visibilityForCard(card), {
      card_id: cardId
    });
  }
  return result;
}
