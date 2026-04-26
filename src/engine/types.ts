export type PlayerSide = "Blue" | "Red" | "Other";
export type PlayerId = string;
export type ForceId = string;
export type CardId = string;
export type LocationId = string;
export type CapabilityId =
  | "C4ISR"
  | "LRF"
  | "SOF"
  | "IAMD_BMD"
  | "NUCLEAR"
  | string;

export type RuleTag =
  | "DETERMINISTIC"
  | "CARD_DEFINED"
  | "WHITE_CELL_ADJUDICATION"
  | "SUMMARY_REQUIRED"
  | "SCENARIO_DEFINED";

export type PhaseId =
  | "GameStart"
  | "RedSignaling"
  | "BlueReadinessBill"
  | "BlueInvestmentsAndActions"
  | "RedInvestmentsAndActions"
  | "AnnualResourcesAllocation"
  | "StateOfWorldSummary"
  | "GameOver";

export type CardType =
  | "Action"
  | "Investment"
  | "DomesticEvent"
  | "InternationalEvent";

export type PublicPrivate = "Public" | "Private";
export type Visibility =
  | "public"
  | "private_to_player_and_white_cell"
  | "white_cell_only";

export type ProbabilityOutcome = "RMG" | "RmG" | "SQ" | "BmG" | "BMG";
export type ReadinessLevel = 50 | 60 | 70 | 80 | 90 | 100;
export type ReliabilityLevel = "Certain" | "High" | "Medium" | "Low";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Condition {
  id?: string;
  description: string;
  tag?: RuleTag;
  expression?: string;
}

export interface Location {
  id: LocationId;
  label: string;
  aor_id?: LocationId;
  parent_location_id?: LocationId;
  country_owner?: PlayerId;
  home_for?: string[];
  coordinates?: [number, number];
}

export interface MovementEdge {
  from: LocationId;
  to: LocationId;
  type?: "adjacent" | "same_aor" | "scenario";
}

export interface Base {
  id: string;
  owner: PlayerId;
  location_id: LocationId;
  aor_id?: LocationId;
  out_of_area_discount?: number;
  notes?: string;
}

export interface ProxyForce {
  id: string;
  sponsor: PlayerId;
  label: string;
  force_factors: number;
  modernization_level: number;
  location_id: LocationId;
  reliability: ReliabilityLevel;
  scope?: string;
}

export interface PlayerState {
  id: PlayerId;
  label: string;
  side: PlayerSide;
  resource_points: number;
  influence_points: number;
  national_tech_level: number;
  critical_capabilities: Record<CapabilityId, number>;
  victory_condition: string;
  card_decks: {
    action_investment: CardId[];
    domestic_event: CardId[];
  };
  notes?: string;
  allow_deficit?: boolean;
}

export interface ForceCounter {
  id: ForceId;
  owner: PlayerId;
  force_factors: number;
  modernization_level: number;
  location_id: LocationId;
  home_base_id: LocationId;
  readiness_level?: ReadinessLevel;
  pinned: {
    active: boolean;
    remaining_turns: number | "indefinite" | null;
    area_of_interest_id?: LocationId;
  };
  reset_required: boolean;
  reset_available_turn?: number;
  procured_turn?: number;
  proxy: boolean;
}

export interface MarkerDefinition {
  id: string;
  label: string;
  description?: string;
}

export interface PaceRule {
  additional_cost_starts_after_card_number: number;
  additional_cost_per_card: number;
}

export interface RandomEventRule {
  enabled: boolean;
  timing?: PhaseId[];
  threshold?: number;
}

export interface TableExtension {
  table: string;
  row: string;
  column?: string;
  value: JsonValue;
  tag: "SCENARIO_DEFINED";
}

export interface ScenarioRules {
  optional_pace_of_play?: PaceRule;
  activation_markers: boolean;
  random_events?: RandomEventRule;
  random_red_sequence: boolean;
  random_red_sequence_order?: "ascending" | "descending";
  random_red_sequence_tie_rule?: "player_id" | "white_cell";
  table_extensions: TableExtension[];
  allow_us_emergency_deficit?: boolean;
}

export type CostValue =
  | number
  | null
  | {
      table_reference?: string;
      expression?: string;
      requires_adjudication?: boolean;
    };

export interface CardCost {
  resource_points: CostValue;
  additional_red_card_cost_applies: boolean;
}

export interface CardResponse {
  allowed_responders: string[];
  response_window: "immediate" | "same_phase" | "card_defined" | "white_cell";
  force_commitment_allowed: boolean;
  cost_rule?: string;
}

export interface ModifierDefinition {
  id: string;
  description: string;
  value?: number;
  source?: "critical_capability_difference" | "card" | "readiness" | "white_cell";
}

export interface OutcomeRow {
  outcome?: ProbabilityOutcome;
  roll_min?: number;
  roll_max?: number;
  label?: string;
  effects: Effect[];
  narrative?: string;
}

export type ResolutionMethod =
  | "fixed_effect"
  | "card_d10_table"
  | "crt_a_then_card_outcome"
  | "rt_b_then_card_outcome"
  | "proxy_reliability"
  | "white_cell_adjudication";

export interface PinRule {
  duration_turns: number | "indefinite";
  area_of_interest_id?: LocationId;
}

export interface CardResolution {
  method: ResolutionMethod[];
  table_reference?:
    | "CRT_A"
    | "RT_B"
    | "ProxyReliability"
    | "DoDBudgetVariation"
    | null;
  die?: "D10";
  modifiers: ModifierDefinition[];
  critical_capabilities: CapabilityId[];
  outcome_map: OutcomeRow[];
  reset_rules_apply: boolean;
  pinning?: PinRule;
}

export interface PlayConstraints {
  frequency?: string;
  phase_restrictions: PhaseId[];
  prerequisites: Condition[];
  unopposed_rule?: {
    description: string;
    effects?: Effect[];
    requires_adjudication?: boolean;
  };
}

export interface Card {
  id: CardId;
  type: CardType;
  subtype?: string;
  owner: PlayerId | "WhiteCell" | null;
  public_private: PublicPrivate;
  private_conditions: Condition[];
  title: string;
  description: string;
  aor?: LocationId;
  players_involved: PlayerId[];
  cost: CardCost;
  play_constraints: PlayConstraints;
  response: CardResponse;
  resolution: CardResolution;
  effects: Effect[];
  future_effects: ScheduledEffect[];
  notes?: string;
}

export type EffectType =
  | "adjust_resource_points"
  | "adjust_influence_points"
  | "set_or_adjust_per_turn_resource_allocation"
  | "set_national_tech_level"
  | "adjust_national_tech_level"
  | "set_critical_capability_mod_level"
  | "adjust_critical_capability_mod_level"
  | "procure_forces"
  | "modernize_forces"
  | "retire_forces"
  | "move_forces"
  | "deploy_or_redeploy_forces"
  | "set_readiness_level"
  | "adjust_readiness_level"
  | "buy_back_readiness"
  | "pay_readiness_sustainment"
  | "pin_forces"
  | "unpin_forces"
  | "reset_forces"
  | "create_or_modify_base"
  | "create_proxy_force"
  | "develop_proxy_force"
  | "employ_proxy_force"
  | "set_visibility"
  | "create_scenario_flag"
  | "schedule_future_effect"
  | "expire_effect";

export interface Effect {
  type: EffectType;
  target: string;
  value: JsonValue;
  timing: "immediate" | "start_of_turn" | "end_of_turn" | "after_pinning_removed" | "card_defined";
  visibility: Visibility;
  source_card_id?: CardId;
  requires_adjudication: boolean;
}

export interface ScheduledEffect {
  effect: Effect;
  trigger_turn?: number;
  expiration_turn?: number;
  trigger_condition?: Condition;
}

export interface GroundTruthItem {
  id: string;
  source: CardId | "rule_id" | "white_cell";
  created_turn: number;
  visible_to: (PlayerId | "WhiteCell" | "Public")[];
  effect: Effect;
  trigger_turn?: number;
  expiration_turn?: number;
  trigger_condition?: Condition;
  status: "pending" | "active" | "expired" | "resolved";
  narrative_note: string;
}

export interface ForceInitialization {
  id: ForceId;
  owner: PlayerId;
  force_factors: number;
  modernization_level: number;
  location_id: LocationId;
  home_base_id: LocationId;
  readiness_level?: ReadinessLevel;
  proxy?: boolean;
}

export interface Scenario {
  title: string;
  learning_objectives: string[];
  security_environment: string;
  players: PlayerState[];
  map: {
    locations: Location[];
    movement_edges: MovementEdge[];
    aor_boundaries: JsonValue[];
  };
  starting_conditions: {
    resources: Record<PlayerId, number>;
    per_turn_resources: Record<PlayerId, number>;
    influence: Record<PlayerId, number>;
    national_tech_levels: Record<PlayerId, number>;
    critical_capabilities: Record<PlayerId, Record<CapabilityId, number>>;
    force_laydown: ForceInitialization[];
    bases: Base[];
    proxy_forces: ProxyForce[];
  };
  victory_conditions: Record<PlayerId, string>;
  card_decks: {
    action_investment: Record<PlayerId, Card[]>;
    domestic_event: Record<PlayerId, Card[]>;
    international_event: Card[];
  };
  rules_in_effect: ScenarioRules;
  marker_chits: MarkerDefinition[];
  max_turns: number;
}

export interface RollRecord {
  id: string;
  turn: number;
  phase: PhaseId;
  die: "D10";
  results: number[];
  modifier: number;
  total: number;
  formula: string;
  purpose: string;
  visibility: Visibility;
}

export interface EventLogItem {
  id: string;
  turn: number;
  phase: PhaseId;
  message: string;
  tags: RuleTag[];
  visibility: Visibility;
  player_id?: PlayerId;
  card_id?: CardId;
  roll_id?: string;
}

export interface AdjudicationRequest {
  id: string;
  turn: number;
  phase: PhaseId;
  reason: string;
  rule_refs: string[];
  tags: RuleTag[];
  status: "pending" | "resolved";
  requested_by?: PlayerId;
  card_id?: CardId;
  payload?: JsonValue;
  resolution_note?: string;
}

export interface RedSignalState {
  player_id: PlayerId;
  card_ids: CardId[];
  brief_summary?: string;
  activation_intent?: Record<CardId, "Yes" | "No" | "Undeclared">;
  completed: boolean;
}

export interface RedPlayState {
  player_id: PlayerId;
  played_card_ids: CardId[];
  skipped: boolean;
}

export interface GameState {
  scenario_title: string;
  turn: number;
  phase: PhaseId;
  players: Record<PlayerId, PlayerState>;
  forces: Record<ForceId, ForceCounter>;
  cards: Record<CardId, Card>;
  locations: Record<LocationId, Location>;
  bases: Record<string, Base>;
  proxy_forces: Record<string, ProxyForce>;
  per_turn_resources: Record<PlayerId, number>;
  rules_in_effect: ScenarioRules;
  max_turns: number;
  active_player_id?: PlayerId;
  red_sequence: PlayerId[];
  red_signals: Record<PlayerId, RedSignalState>;
  red_plays: Record<PlayerId, RedPlayState>;
  active_red_index: number;
  readiness_paid_turns: number[];
  event_log: EventLogItem[];
  rolls: RollRecord[];
  pending_adjudications: AdjudicationRequest[];
  ground_truth: GroundTruthItem[];
  scenario_flags: Record<string, JsonValue>;
  summaries: {
    game_start?: string;
    state_of_world: Record<number, string>;
  };
}

export type RuleIssueSeverity = "error" | "adjudication";

export interface RuleIssue {
  id: string;
  severity: RuleIssueSeverity;
  message: string;
  rule_refs: string[];
  tags: RuleTag[];
}

export type RuleValue<T> =
  | { ok: true; value: T }
  | { ok: false; issue: RuleIssue };

export interface ForceCommitment {
  force_id: ForceId;
  source: "in_theater" | "adjacent_theater" | "conus_reactive";
  out_of_area_arrival?: boolean;
}

export interface CombatFactorsBreakdown {
  force_id: ForceId;
  base_cf: number;
  final_cf: number;
  note: string;
}

export interface CombatFactorsResult {
  total: number;
  breakdown: CombatFactorsBreakdown[];
  adjudications: RuleIssue[];
}
