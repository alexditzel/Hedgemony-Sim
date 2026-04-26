import z from "zod";

export type PlayerSide = "Blue" | "Red" | "Other";
export const PlayerSideSchema = z.enum(["Blue", "Red", "Other"]);

export type PlayerId = z.infer<typeof PlayerIdSchema>;
export const PlayerIdSchema = z.string();

export type ForceId = string;
export const ForceIdSchema = z.string();

export type CardId = string;
export const CardIdSchema = z.string();

export type LocationId = string;
export const LocationIdSchema = z.string();

export type CapabilityId =
  | "C4ISR"
  | "LRF"
  | "SOF"
  | "IAMD_BMD"
  | "NUCLEAR"
  | string;

export const CapabilityIdSchema = z.union([
  z.enum(["C4ISR", "LRF", "SOF", "IAMD_BMD", "NUCLEAR"]),
  z.string(),
]);

export type RuleTag =
  | "DETERMINISTIC"
  | "CARD_DEFINED"
  | "WHITE_CELL_ADJUDICATION"
  | "SUMMARY_REQUIRED"
  | "SCENARIO_DEFINED";
export const RuleTagSchema = z.enum([
  "DETERMINISTIC",
  "CARD_DEFINED",
  "WHITE_CELL_ADJUDICATION",
  "SUMMARY_REQUIRED",
  "SCENARIO_DEFINED",
]);

export type PhaseId =
  | "GameStart"
  | "RedSignaling"
  | "BlueReadinessBill"
  | "BlueInvestmentsAndActions"
  | "RedInvestmentsAndActions"
  | "AnnualResourcesAllocation"
  | "StateOfWorldSummary"
  | "GameOver";
export const PhaseIdSchema = z.enum([
  "GameStart",
  "RedSignaling",
  "BlueReadinessBill",
  "BlueInvestmentsAndActions",
  "RedInvestmentsAndActions",
  "AnnualResourcesAllocation",
  "StateOfWorldSummary",
  "GameOver",
]);

export type CardType =
  | "Action"
  | "Investment"
  | "DomesticEvent"
  | "InternationalEvent";
export const CardTypeSchema = z.enum([
  "Action",
  "Investment",
  "DomesticEvent",
  "InternationalEvent",
]);

export type PublicPrivate = "Public" | "Private";
export const PublicPrivateSchema = z.enum(["Public", "Private"]);

export type Visibility =
  | "public"
  | "private_to_player_and_white_cell"
  | "white_cell_only";
export const VisibilitySchema = z.enum([
  "public",
  "private_to_player_and_white_cell",
  "white_cell_only",
]);

export type ProbabilityOutcome = "RMG" | "RmG" | "SQ" | "BmG" | "BMG";
export const ProbabilityOutcomeSchema = z.enum([
  "RMG",
  "RmG",
  "SQ",
  "BmG",
  "BMG",
]);

export type ReadinessLevel = 50 | 60 | 70 | 80 | 90 | 100;
// export const ReadinessLevelSchema = z.union([
//   z.literal(50),
//   z.literal(60),
//   z.literal(70),
//   z.literal(80),
//   z.literal(90),
//   z.literal(100),
// ]);
// TODO: make sure this version works when interpreted as a JSON schema for the OpenAI API structured outputs
export const ReadinessLevelSchema = z.literal([50, 60, 70, 80, 90, 100]);

export type ReliabilityLevel = "Certain" | "High" | "Medium" | "Low";
export const ReliabilityLevelSchema = z.enum([
  "Certain",
  "High",
  "Medium",
  "Low",
]);

export type JsonPrimitive = string | number | boolean | null;
export const JsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };
export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    JsonPrimitiveSchema,
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

export type Condition = {
  id: string | null;
  description: string;
  tag: RuleTag | null;
  expression: string | null;
};
export const ConditionSchema = z.object({
  id: z.nullable(z.string()),
  description: z.string(),
  tag: z.nullable(RuleTagSchema),
  expression: z.nullable(z.string()),
});

export type Location = {
  id: LocationId;
  label: string;
  aor_id: LocationId | null;
  parent_location_id: LocationId | null;
  country_owner: PlayerId | null;
  home_for: PlayerId[] | null;
  coordinates: [number, number] | null;
};
export const LocationSchema = z.object({
  id: LocationIdSchema,
  label: z.string(),
  aor_id: z.nullable(LocationIdSchema),
  parent_location_id: z.nullable(LocationIdSchema),
  country_owner: z.nullable(PlayerIdSchema),
  home_for: z.nullable(z.array(PlayerIdSchema)),
  coordinates: z.nullable(z.tuple([z.number(), z.number()])),
});

export type MovementEdge = {
  from: LocationId;
  to: LocationId;
  type: "adjacent" | "same_aor" | "scenario" | null;
};
export const MovementEdgeSchema = z.object({
  from: LocationIdSchema,
  to: LocationIdSchema,
  type: z.nullable(z.enum(["adjacent", "same_aor", "scenario"])),
});

export type Base = {
  id: string;
  owner: PlayerId;
  location_id: LocationId;
  aor_id: LocationId | null;
  out_of_area_discount: number | null;
  notes: string | null;
};
export const BaseSchema = z.object({
  id: z.string(),
  owner: PlayerIdSchema,
  location_id: LocationIdSchema,
  aor_id: z.nullable(LocationIdSchema),
  out_of_area_discount: z.nullable(z.number()),
  notes: z.nullable(z.string()),
});

export type ProxyForce = {
  id: string;
  sponsor: PlayerId;
  label: string;
  force_factors: number;
  modernization_level: number;
  location_id: LocationId;
  reliability: ReliabilityLevel;
  scope: string | null;
};
export const ProxyForceSchema = z.object({
  id: z.string(),
  sponsor: PlayerIdSchema,
  label: z.string(),
  force_factors: z.number(),
  modernization_level: z.number(),
  location_id: LocationIdSchema,
  reliability: ReliabilityLevelSchema,
  scope: z.nullable(z.string()),
});

export type PlayerState = {
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
  notes: string | null;
  allow_deficit: boolean | null;
};
export const PlayerStateSchema = z.object({
  id: PlayerIdSchema,
  label: z.string(),
  side: PlayerSideSchema,
  resource_points: z.number(),
  influence_points: z.number(),
  national_tech_level: z.number(),
  critical_capabilities: z.record(CapabilityIdSchema, z.number()),
  victory_condition: z.string(),
  card_decks: z.object({
    action_investment: z.array(CardIdSchema),
    domestic_event: z.array(CardIdSchema),
  }),
  notes: z.nullable(z.string()),
  allow_deficit: z.nullable(z.boolean()),
});

export type ForceCounter = {
  id: ForceId;
  owner: PlayerId;
  force_factors: number;
  modernization_level: number;
  location_id: LocationId;
  home_base_id: LocationId;
  readiness_level: ReadinessLevel | null;
  pinned: {
    active: boolean;
    remaining_turns: number | "indefinite" | null;
    area_of_interest_id: LocationId | null;
  };
  reset_required: boolean;
  reset_available_turn: number | null;
  procured_turn: number | null;
  proxy: boolean;
};
export const ForceCounterSchema = z.object({
  id: ForceIdSchema,
  owner: PlayerIdSchema,
  force_factors: z.number(),
  modernization_level: z.number(),
  location_id: LocationIdSchema,
  home_base_id: LocationIdSchema,
  readiness_level: z.nullable(ReadinessLevelSchema),
  pinned: z.object({
    active: z.boolean(),
    remaining_turns: z.union([z.number(), z.literal("indefinite"), z.null()]),
    area_of_interest_id: z.nullable(LocationIdSchema),
  }),
  reset_required: z.boolean(),
  reset_available_turn: z.nullable(z.number()),
  procured_turn: z.nullable(z.number()),
  proxy: z.boolean(),
});

export type MarkerDefinition = {
  id: string;
  label: string;
  description: string | null;
};
export const MarkerDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.nullable(z.string()),
});

export type PaceRule = {
  additional_cost_starts_after_card_number: number;
  additional_cost_per_card: number;
};
export const PaceRuleSchema = z.object({
  additional_cost_starts_after_card_number: z.number(),
  additional_cost_per_card: z.number(),
});

export type RandomEventRule = {
  enabled: boolean;
  timing: PhaseId[] | null;
  threshold: number | null;
};
export const RandomEventRuleSchema = z.object({
  enabled: z.boolean(),
  timing: z.nullable(z.array(PhaseIdSchema)),
  threshold: z.nullable(z.number()),
});

export type TableExtension = {
  table: string;
  row: string;
  column: string | null;
  value: JsonValue;
  tag: "SCENARIO_DEFINED";
};
export const TableExtensionSchema = z.object({
  table: z.string(),
  row: z.string(),
  column: z.nullable(z.string()),
  value: JsonValueSchema,
  tag: z.literal("SCENARIO_DEFINED"),
});

export type ScenarioRules = {
  optional_pace_of_play: PaceRule | null;
  activation_markers: boolean;
  random_events: RandomEventRule | null;
  random_red_sequence: boolean;
  random_red_sequence_order: "ascending" | "descending" | null;
  random_red_sequence_tie_rule: "player_id" | "white_cell" | null;
  table_extensions: TableExtension[];
  allow_us_emergency_deficit: boolean | null;
};
export const ScenarioRulesSchema = z.object({
  optional_pace_of_play: z.nullable(PaceRuleSchema),
  activation_markers: z.boolean(),
  random_events: z.nullable(RandomEventRuleSchema),
  random_red_sequence: z.boolean(),
  random_red_sequence_order: z.nullable(z.enum(["ascending", "descending"])),
  random_red_sequence_tie_rule: z.nullable(z.enum(["player_id", "white_cell"])),
  table_extensions: z.array(TableExtensionSchema),
  allow_us_emergency_deficit: z.nullable(z.boolean()),
});

export type CostValue =
  | number
  | null
  | {
      table_reference: string | null;
      expression: string | null;
      requires_adjudication: boolean | null;
    };
export const CostValueSchema = z.union([
  z.number(),
  z.null(),
  z.object({
    table_reference: z.nullable(z.string()),
    expression: z.nullable(z.string()),
    requires_adjudication: z.nullable(z.boolean()),
  }),
]);

export type CardCost = {
  resource_points: CostValue;
  additional_red_card_cost_applies: boolean;
};
export const CardCostSchema = z.object({
  resource_points: CostValueSchema,
  additional_red_card_cost_applies: z.boolean(),
});

export type CardResponse = {
  allowed_responders: string[];
  response_window: "immediate" | "same_phase" | "card_defined" | "white_cell";
  force_commitment_allowed: boolean;
  cost_rule: string | null;
};
export const CardResponseSchema = z.object({
  allowed_responders: z.array(z.string()),
  response_window: z.enum([
    "immediate",
    "same_phase",
    "card_defined",
    "white_cell",
  ]),
  force_commitment_allowed: z.boolean(),
  cost_rule: z.nullable(z.string()),
});

export type ModifierDefinition = {
  id: string;
  description: string;
  value: number | null;
  source: | "critical_capability_difference" | null
    | "card"
    | "readiness"
    | "white_cell";
};
export const ModifierDefinitionSchema = z.object({
  id: z.string(),
  description: z.string(),
  value: z.nullable(z.number()),
  source: z.nullable(
    z.enum([
      "critical_capability_difference",
      "card",
      "readiness",
      "white_cell",
    ]),
  ),
});

export type OutcomeRow = {
  outcome: ProbabilityOutcome | null;
  roll_min: number | null;
  roll_max: number | null;
  label: string | null;
  effects: Effect[];
  narrative: string | null;
};
export const OutcomeRowSchema = z.object({
  outcome: z.nullable(ProbabilityOutcomeSchema),
  roll_min: z.nullable(z.number()),
  roll_max: z.nullable(z.number()),
  label: z.nullable(z.string()),
  effects: z.array(z.lazy(() => EffectSchema)),
  narrative: z.nullable(z.string()),
});

export type ResolutionMethod =
  | "fixed_effect"
  | "card_d10_table"
  | "crt_a_then_card_outcome"
  | "rt_b_then_card_outcome"
  | "proxy_reliability"
  | "white_cell_adjudication";
export const ResolutionMethodSchema = z.enum([
  "fixed_effect",
  "card_d10_table",
  "crt_a_then_card_outcome",
  "rt_b_then_card_outcome",
  "proxy_reliability",
  "white_cell_adjudication",
]);

export type PinRule = {
  duration_turns: number | "indefinite";
  area_of_interest_id: LocationId | null;
};
export const PinRuleSchema = z.object({
  duration_turns: z.union([z.number(), z.literal("indefinite")]),
  area_of_interest_id: z.nullable(LocationIdSchema),
});

export type CardResolution = {
  method: ResolutionMethod[];
  table_reference: | "CRT_A" | null
    | "RT_B"
    | "ProxyReliability"
    | "DoDBudgetVariation"
    | null;
  die: "D10" | null;
  modifiers: ModifierDefinition[];
  critical_capabilities: CapabilityId[];
  outcome_map: OutcomeRow[];
  reset_rules_apply: boolean;
  pinning: PinRule | null;
};
export const CardResolutionSchema = z.object({
  method: z.array(ResolutionMethodSchema),
  table_reference: z.nullable(
    z.union([
      z.enum(["CRT_A", "RT_B", "ProxyReliability", "DoDBudgetVariation"]),
      z.null(),
    ]),
  ),
  die: z.nullable(z.literal("D10")),
  modifiers: z.array(ModifierDefinitionSchema),
  critical_capabilities: z.array(CapabilityIdSchema),
  outcome_map: z.array(OutcomeRowSchema),
  reset_rules_apply: z.boolean(),
  pinning: z.nullable(PinRuleSchema),
});

export type PlayConstraints = {
  frequency: string | null;
  phase_restrictions: PhaseId[];
  prerequisites: Condition[];
  unopposed_rule: {
    description: string;
    effects: Effect[] | null;
    requires_adjudication: boolean | null;
  } | null;
};
export const PlayConstraintsSchema = z.object({
  frequency: z.nullable(z.string()),
  phase_restrictions: z.array(PhaseIdSchema),
  prerequisites: z.array(ConditionSchema),
  unopposed_rule: z.nullable(
    z.object({
      description: z.string(),
      effects: z.nullable(z.array(z.lazy(() => EffectSchema))),
      requires_adjudication: z.nullable(z.boolean()),
    }),
  ),
});

export type Card = {
  id: CardId;
  type: CardType;
  subtype: string | null;
  owner: PlayerId | "WhiteCell" | null;
  public_private: PublicPrivate;
  private_conditions: Condition[];
  title: string;
  description: string;
  aor: LocationId | null;
  players_involved: PlayerId[];
  cost: CardCost;
  play_constraints: PlayConstraints;
  response: CardResponse;
  resolution: CardResolution;
  effects: Effect[];
  future_effects: ScheduledEffect[];
  notes: string | null;
};
export const CardSchema = z.object({
  id: CardIdSchema,
  type: CardTypeSchema,
  subtype: z.nullable(z.string()),
  owner: z.union([PlayerIdSchema, z.literal("WhiteCell"), z.null()]),
  public_private: PublicPrivateSchema,
  private_conditions: z.array(ConditionSchema),
  title: z.string(),
  description: z.string(),
  aor: z.nullable(LocationIdSchema),
  players_involved: z.array(PlayerIdSchema),
  cost: CardCostSchema,
  play_constraints: PlayConstraintsSchema,
  response: CardResponseSchema,
  resolution: CardResolutionSchema,
  effects: z.array(z.lazy(() => EffectSchema)),
  future_effects: z.array(z.lazy(() => ScheduledEffectSchema)),
  notes: z.nullable(z.string()),
});

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
  | "adjust_scenario_flag_number"
  | "set_visibility"
  | "create_scenario_flag"
  | "schedule_future_effect"
  | "expire_effect";
export const EffectTypeSchema = z.enum([
  "adjust_resource_points",
  "adjust_influence_points",
  "set_or_adjust_per_turn_resource_allocation",
  "set_national_tech_level",
  "adjust_national_tech_level",
  "set_critical_capability_mod_level",
  "adjust_critical_capability_mod_level",
  "procure_forces",
  "modernize_forces",
  "retire_forces",
  "move_forces",
  "deploy_or_redeploy_forces",
  "set_readiness_level",
  "adjust_readiness_level",
  "buy_back_readiness",
  "pay_readiness_sustainment",
  "pin_forces",
  "unpin_forces",
  "reset_forces",
  "create_or_modify_base",
  "create_proxy_force",
  "develop_proxy_force",
  "employ_proxy_force",
  "adjust_scenario_flag_number",
  "set_visibility",
  "create_scenario_flag",
  "schedule_future_effect",
  "expire_effect",
]);

export type Effect = {
  type: EffectType;
  target: PlayerId;
  value: JsonValue;
  timing:
    | "immediate"
    | "start_of_turn"
    | "end_of_turn"
    | "after_pinning_removed"
    | "card_defined";
  visibility: Visibility;
  source_card_id: CardId | null;
  requires_adjudication: boolean;
};
export const EffectSchema: z.ZodType<Effect> = z.lazy(() =>
  z.object({
    type: EffectTypeSchema,
    target: PlayerIdSchema,
    value: JsonValueSchema,
    timing: z.enum([
      "immediate",
      "start_of_turn",
      "end_of_turn",
      "after_pinning_removed",
      "card_defined",
    ]),
    visibility: VisibilitySchema,
    source_card_id: z.nullable(CardIdSchema),
    requires_adjudication: z.boolean(),
  }),
);

export type ScheduledEffect = {
  effect: Effect;
  trigger_turn: number | null;
  expiration_turn: number | null;
  trigger_condition: Condition | null;
};
export const ScheduledEffectSchema: z.ZodType<ScheduledEffect> = z.lazy(() =>
  z.object({
    effect: EffectSchema,
    trigger_turn: z.nullable(z.number()),
    expiration_turn: z.nullable(z.number()),
    trigger_condition: z.nullable(ConditionSchema),
  }),
);

export type GroundTruthItem = {
  id: string;
  source: CardId | "rule_id" | "white_cell";
  created_turn: number;
  visible_to: (PlayerId | "WhiteCell" | "Public")[];
  effect: Effect;
  trigger_turn: number | null;
  expiration_turn: number | null;
  trigger_condition: Condition | null;
  status: "pending" | "active" | "expired" | "resolved";
  narrative_note: string;
};
export const GroundTruthItemSchema = z.object({
  id: z.string(),
  source: z.union([
    CardIdSchema,
    z.literal("rule_id"),
    z.literal("white_cell"),
  ]),
  created_turn: z.number(),
  visible_to: z.array(
    z.union([PlayerIdSchema, z.literal("WhiteCell"), z.literal("Public")]),
  ),
  effect: EffectSchema,
  trigger_turn: z.nullable(z.number()),
  expiration_turn: z.nullable(z.number()),
  trigger_condition: z.nullable(ConditionSchema),
  status: z.enum(["pending", "active", "expired", "resolved"]),
  narrative_note: z.string(),
});

export type ForceInitialization = {
  id: ForceId;
  owner: PlayerId;
  force_factors: number;
  modernization_level: number;
  location_id: LocationId;
  home_base_id: LocationId;
  readiness_level: ReadinessLevel | null;
  proxy: boolean | null;
};
export const ForceInitializationSchema = z.object({
  id: ForceIdSchema,
  owner: PlayerIdSchema,
  force_factors: z.number(),
  modernization_level: z.number(),
  location_id: LocationIdSchema,
  home_base_id: LocationIdSchema,
  readiness_level: z.nullable(ReadinessLevelSchema),
  proxy: z.nullable(z.boolean()),
});

export type Scenario = {
  title: string;
  learning_objectives: string[];
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
};
export const ScenarioSchema = z.object({
  title: z.string(),
  learning_objectives: z.array(z.string()),
  players: z.array(PlayerStateSchema),
  map: z.object({
    locations: z.array(LocationSchema),
    movement_edges: z.array(MovementEdgeSchema),
    aor_boundaries: z.array(JsonValueSchema),
  }),
  starting_conditions: z.object({
    resources: z.record(PlayerIdSchema, z.number()),
    per_turn_resources: z.record(PlayerIdSchema, z.number()),
    influence: z.record(PlayerIdSchema, z.number()),
    national_tech_levels: z.record(PlayerIdSchema, z.number()),
    critical_capabilities: z.record(
      PlayerIdSchema,
      z.record(CapabilityIdSchema, z.number()),
    ),
    force_laydown: z.array(ForceInitializationSchema),
    bases: z.array(BaseSchema),
    proxy_forces: z.array(ProxyForceSchema),
  }),
  victory_conditions: z.record(PlayerIdSchema, z.string()),
  card_decks: z.object({
    action_investment: z.record(PlayerIdSchema, z.array(CardSchema)),
    domestic_event: z.record(PlayerIdSchema, z.array(CardSchema)),
    international_event: z.array(CardSchema),
  }),
  rules_in_effect: ScenarioRulesSchema,
  marker_chits: z.array(MarkerDefinitionSchema),
  max_turns: z.number(),
});

export type RollRecord = {
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
};
export const RollRecordSchema = z.object({
  id: z.string(),
  turn: z.number(),
  phase: PhaseIdSchema,
  die: z.literal("D10"),
  results: z.array(z.number()),
  modifier: z.number(),
  total: z.number(),
  formula: z.string(),
  purpose: z.string(),
  visibility: VisibilitySchema,
});

export type EventLogItem = {
  id: string;
  turn: number;
  phase: PhaseId;
  message: string;
  tags: RuleTag[];
  visibility: Visibility;
  player_id: PlayerId | "WhiteCell" | null;
  card_id: CardId | null;
  roll_id: string | null;
};
export const EventLogItemSchema = z.object({
  id: z.string(),
  turn: z.number(),
  phase: PhaseIdSchema,
  message: z.string(),
  tags: z.array(RuleTagSchema),
  visibility: VisibilitySchema,
  player_id: z.nullable(z.union([PlayerIdSchema, z.enum(["WhiteCell"])])),
  card_id: z.nullable(CardIdSchema),
  roll_id: z.nullable(z.string()),
});

export type AdjudicationRequest = {
  id: string;
  turn: number;
  phase: PhaseId;
  reason: string;
  rule_refs: string[];
  tags: RuleTag[];
  status: "pending" | "resolved";
  requested_by: PlayerId | "WhiteCell" | null;
  card_id: CardId | null;
  payload: JsonValue | null;
  resolution_note: string | null;
};
export const AdjudicationRequestSchema = z.object({
  id: z.string(),
  turn: z.number(),
  phase: PhaseIdSchema,
  reason: z.string(),
  rule_refs: z.array(z.string()),
  tags: z.array(RuleTagSchema),
  status: z.enum(["pending", "resolved"]),
  requested_by: z.nullable(PlayerIdSchema),
  card_id: z.nullable(CardIdSchema),
  payload: z.nullable(JsonValueSchema),
  resolution_note: z.nullable(z.string()),
});

export type RedSignalState = {
  player_id: PlayerId;
  card_ids: CardId[];
  brief_summary: string | null;
  activation_intent: Record<CardId, "Yes" | "No" | "Undeclared"> | null;
  completed: boolean;
};
export const RedSignalStateSchema = z.object({
  player_id: PlayerIdSchema,
  card_ids: z.array(CardIdSchema),
  brief_summary: z.nullable(z.string()),
  activation_intent: z.nullable(
    z.record(CardIdSchema, z.enum(["Yes", "No", "Undeclared"])),
  ),
  completed: z.boolean(),
});

export type RedPlayState = {
  player_id: PlayerId;
  played_card_ids: CardId[];
  skipped: boolean;
};
export const RedPlayStateSchema = z.object({
  player_id: PlayerIdSchema,
  played_card_ids: z.array(CardIdSchema),
  skipped: z.boolean(),
});

export type PendingReset = {
  id: string;
  force_ids: ForceId[];
  outcome: ProbabilityOutcome;
  status: "pending_after_pinning" | "resolved";
};
export const PendingResetSchema = z.object({
  id: z.string(),
  force_ids: z.array(ForceIdSchema),
  outcome: ProbabilityOutcomeSchema,
  status: z.enum(["pending_after_pinning", "resolved"]),
});

export type CardPlayRecord = {
  card_id: CardId;
  player_id: PlayerId;
  turn: number;
};
export const CardPlayRecordSchema = z.object({
  card_id: CardIdSchema,
  player_id: PlayerIdSchema,
  turn: z.number(),
});

export type GameState = {
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
  active_player_id: PlayerId | null;
  blue_subphase: "Investments" | "Actions" | null;
  red_sequence: PlayerId[];
  red_signals: Record<PlayerId, RedSignalState>;
  red_plays: Record<PlayerId, RedPlayState>;
  active_red_index: number;
  readiness_paid_turns: number[];
  event_log: EventLogItem[];
  rolls: RollRecord[];
  pending_adjudications: AdjudicationRequest[];
  pending_resets: PendingReset[];
  card_play_history: CardPlayRecord[];
  ground_truth: GroundTruthItem[];
  scenario_flags: Record<string, JsonValue>;
  summaries: {
    game_start: string | null;
    state_of_world: Record<number, string>;
  };
};
export const GameStateSchema = z.object({
  scenario_title: z.string(),
  turn: z.number(),
  phase: PhaseIdSchema,
  players: z.record(PlayerIdSchema, PlayerStateSchema),
  forces: z.record(ForceIdSchema, ForceCounterSchema),
  cards: z.record(CardIdSchema, CardSchema),
  locations: z.record(LocationIdSchema, LocationSchema),
  bases: z.record(z.string(), BaseSchema),
  proxy_forces: z.record(z.string(), ProxyForceSchema),
  per_turn_resources: z.record(PlayerIdSchema, z.number()),
  rules_in_effect: ScenarioRulesSchema,
  max_turns: z.number(),
  active_player_id: z.nullable(PlayerIdSchema),
  blue_subphase: z.nullable(z.enum(["Investments", "Actions"])),
  red_sequence: z.array(PlayerIdSchema),
  red_signals: z.record(PlayerIdSchema, RedSignalStateSchema),
  red_plays: z.record(PlayerIdSchema, RedPlayStateSchema),
  active_red_index: z.number(),
  readiness_paid_turns: z.array(z.number()),
  event_log: z.array(EventLogItemSchema),
  rolls: z.array(RollRecordSchema),
  pending_adjudications: z.array(AdjudicationRequestSchema),
  pending_resets: z.array(PendingResetSchema),
  card_play_history: z.array(CardPlayRecordSchema),
  ground_truth: z.array(GroundTruthItemSchema),
  scenario_flags: z.record(z.string(), JsonValueSchema),
  summaries: z.object({
    game_start: z.nullable(z.string()),
    state_of_world: z.record(z.coerce.number(), z.string()),
  }),
});

export type RuleIssueSeverity = "error" | "adjudication";
export const RuleIssueSeveritySchema = z.enum(["error", "adjudication"]);

export type RuleIssue = {
  id: string;
  severity: RuleIssueSeverity;
  message: string;
  rule_refs: string[];
  tags: RuleTag[];
};
export const RuleIssueSchema = z.object({
  id: z.string(),
  severity: RuleIssueSeveritySchema,
  message: z.string(),
  rule_refs: z.array(z.string()),
  tags: z.array(RuleTagSchema),
});

export type RuleValue<T> =
  | { ok: true; value: T }
  | { ok: false; issue: RuleIssue };
export const RuleValueSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.discriminatedUnion("ok", [
    z.object({ ok: z.literal(true), value: valueSchema }),
    z.object({ ok: z.literal(false), issue: RuleIssueSchema }),
  ]);

export type ForceCommitment = {
  force_id: ForceId;
  source: "in_theater" | "adjacent_theater" | "conus_reactive";
  out_of_area_arrival: boolean | null;
};
export const ForceCommitmentSchema = z.object({
  force_id: ForceIdSchema,
  source: z.enum(["in_theater", "adjacent_theater", "conus_reactive"]),
  out_of_area_arrival: z.nullable(z.boolean()),
});

export type CombatFactorsBreakdown = {
  force_id: ForceId;
  base_cf: number;
  final_cf: number;
  note: string;
};
export const CombatFactorsBreakdownSchema = z.object({
  force_id: ForceIdSchema,
  base_cf: z.number(),
  final_cf: z.number(),
  note: z.string(),
});

export type CombatFactorsResult = {
  total: number;
  breakdown: CombatFactorsBreakdown[];
  adjudications: RuleIssue[];
};
export const CombatFactorsResultSchema = z.object({
  total: z.number(),
  breakdown: z.array(CombatFactorsBreakdownSchema),
  adjudications: z.array(RuleIssueSchema),
});
