# Hedgemony Digital Ruleset

Source basis: `RAND_TL301.rulebook.pdf`, `RAND_TL301_rulebook_transcription.txt`, `RAND_TL301.guide.pdf`, `RAND_TL301_guide_full_transcription.txt`, and the extracted table/image files in `Hedgemony-Tables-and-Images/`.

This document is a structured rules specification for turning Hedgemony into a digital simulation. It preserves the rulebook/player-guide mechanics and tables, while making explicit where the printed game relies on the White Cell for adjudication or summary.

## 1. Implementation Contract

Hedgemony is a facilitated, scenario-driven, card-centered wargame. A digital implementation must support deterministic rules where printed procedures and tables exist, and must also support human/White Cell adjudication where the rules deliberately leave interpretation to facilitators.

Use these tags in code, logs, card data, and UI:

| Tag | Meaning |
|---|---|
| `DETERMINISTIC` | A printed rule or table fully determines the result. |
| `CARD_DEFINED` | The card supplies the conditions, procedure, cost, roll mapping, or final outcome. |
| `WHITE_CELL_ADJUDICATION` | The rulebook requires or permits the White Cell to decide, clarify, translate player intent, resolve ambiguity, assign conditions/costs, or shape play. |
| `SUMMARY_REQUIRED` | A facilitator/White Cell summary is required or expected. Store the summary as scenario/game narrative. |
| `SCENARIO_DEFINED` | The scenario supplies the value, restriction, timing, or permitted rule variant. |

No digital rule should silently invent a missing table value or assumption. If a value is outside the printed table range, the scenario must either supply an extended table/rule or the engine must request `WHITE_CELL_ADJUDICATION`.

## 2. Core Concepts and State Model

### 2.1 Sides and Players

The default scenario has two Blue players and four Red players.

| Player id | Label | Default side |
|---|---|---|
| `US` | United States | Blue |
| `NATO_EU` | NATO/EU | Blue |
| `RU` | Russia | Red |
| `PRC` | China | Red |
| `DPRK` | North Korea | Red |
| `IR` | Iran | Red |

Cards may override which actors are treated as Blue or Red for a specific action/event. Usually Blue means the United States, NATO/EU, and/or their allies/proxies, while Red means other forces and their allies/proxies.

### 2.2 Tracked Player State

Each player has:

```yaml
player_state:
  id: string
  side: Blue | Red | Other
  resource_points: integer          # RPs, carry over between turns
  influence_points: integer         # IPs
  national_tech_level: integer      # normally 1..7
  critical_capabilities:
    capability_id: mod_level        # scenario-defined; allow 0..7 because the default scenario includes DPRK Nuclear Forces 0
  victory_condition: expression     # scenario-defined
  card_decks:
    action_investment: [card_id]
    domestic_event: [card_id]       # normally White Cell controlled
  notes: text
```

Players may not spend more RPs than they have unless the scenario or White Cell explicitly permits it. U.S. emergency funding is a White Cell adjudication exception.

### 2.3 Forces

Hedgemony does not explicitly model ground, sea, air, space, cyber, special operations, or other force types as separate force categories. All military forces are abstracted as Force Factors (FFs). Force-type context is provided by players and/or the White Cell when an action is described.

Force counters exist in denominations 1, 2, 5, and 10 FFs.

```yaml
force_counter:
  id: string
  owner: player_id | proxy_id
  force_factors: 1 | 2 | 5 | 10 | integer
  modernization_level: integer      # Mod Level, 1..7 unless scenario says otherwise
  location_id: string               # AOR, country, AOI, or scenario-defined location
  home_base_id: string              # scenario-defined; used for free return and reset
  readiness_level: integer?         # U.S. only in printed rules; 50,60,70,80,90,100
  pinned:
    active: boolean
    remaining_turns: integer | indefinite | null
    area_of_interest_id: string?
  reset_required: boolean
  procured_turn: integer?
  proxy: boolean
```

Force Mod Level may not exceed the owning player's National Tech Level.

### 2.4 Capabilities

Default Critical Capability categories:

| Capability id | Label |
|---|---|
| `C4ISR` | Command, control, communications, computers, intelligence, surveillance, and reconnaissance |
| `LRF` | Long-range fires |
| `SOF` | Special operations forces |
| `IAMD_BMD` | Integrated Air and Missile Defense / Ballistic Missile Defense |
| `NUCLEAR` | Nuclear forces |

Critical Capabilities are scenario-defined. If an action/event calls for one or more Critical Capabilities, the difference between the best relevant Blue and Red Critical Capability Mod Levels modifies the CRT A die roll, unless the card says otherwise.

## 3. Scenario Schema

A Hedgemony scenario consists of:

```yaml
scenario:
  title: string
  learning_objectives: [text]
  security_environment: text
  players: [player_state_initialization]
  map:
    locations: [location]
    movement_edges: [edge]
    aor_boundaries: [boundary]
  starting_conditions:
    resources: { player_id: integer }
    per_turn_resources: { player_id: integer }
    influence: { player_id: integer }
    national_tech_levels: { player_id: integer }
    critical_capabilities: { player_id: { capability_id: integer } }
    force_laydown: [force_counter_initialization]
    bases: [base]
    proxy_forces: [proxy_force]
  victory_conditions: { player_id: expression }
  card_decks:
    action_investment: { player_id: [card] }
    domestic_event: { player_id: [card] }
    international_event: [card]
  rules_in_effect:
    optional_pace_of_play: pace_rule?
    activation_markers: boolean
    random_events: random_event_rule?
    random_red_sequence: boolean
    table_extensions: [table_extension]
  marker_chits: [marker_definition]
```

Scenario design must remain inside Hedgemony's modeled trade space: RPs, IPs, force posture, FFs, force Mod Levels, National Tech Level, Critical Capability Mod Levels, U.S. Readiness Levels, cards, and adjudicated/facilitated events. If a scenario requires fundamentally different outputs or mechanics, it is a new game rather than a Hedgemony scenario.

## 4. Map and Locations

The default game board is a stylized Unified Command Plan map. AOR boundaries regulate movement costs. The guide image identifies the following board AOR labels:

- `USNORTHCOM`
- `USEUCOM`
- `USCENTCOM`
- `USINDOPACOM`
- `USSOUTHCOM`
- `USAFRICOM`

The default scenario also uses nested/theater-specific labels such as `CONUS`, `INDOPACOM_PRC`, `INDOPACOM_DPRK`, `CENTCOM_IRAN`, `CENTCOM_AFGHANISTAN`, `CENTCOM_IRAQ`, and `EUCOM_RU`.

```yaml
location:
  id: string
  label: string
  aor_id: string?
  parent_location_id: string?
  country_owner: player_id?
  home_for: [player_id | force_counter_id]
```

Area of Interest (AOI) is a scenario/action-level location created when an action/event occurs. Pinned forces are tied to an AOI.

## 5. Turn Sequence

A game turn very roughly represents one year and corresponds to a notional DoD planning, programming, and budgeting cycle. Technology and force development timelines are compressed by design.

Default turn phases, in order:

1. Red Signaling Phase
2. Blue Investments and Actions Phase
3. Red Investments and Actions Phase
4. Annual Resources Allocation Phase
5. State-of-the-World Summary Phase

The board turn tracker supports turns 1 through 16; scenario design determines actual game length.

### 5.1 Game Start

At the beginning of a session, facilitators summarize the state of the world and players outline their strategies/objectives in writing.

Tag: `SUMMARY_REQUIRED`.

### 5.2 Red Signaling Phase

Default procedure:

- Each Red player may display up to three cards from its Action and Investment deck and places them face up. The default play guidance has each Red player select three when able.
- The signaled cards can be cards Red intends to play, false signals, or undecided options.
- When three cards are signaled, at least one signaled card must be an Action Card and at least one must be an Investment Card.
- Red players brief Blue on what Blue would likely know about Red intentions. Red "works for" Blue during this briefing and answers Blue questions according to likely intelligence knowledge and scenario guidance.
- Briefing order is chosen by the White Cell by default; it may be randomized by optional rule.
- White Cell may inject International or Domestic Events during or after signaling.

Tags: `SUMMARY_REQUIRED` for the intelligence-style briefing; `WHITE_CELL_ADJUDICATION` for briefing order and event injection unless randomized by optional rule.

### 5.3 Blue Investments and Actions Phase

Default procedure:

- Blue deliberates on posture, hedging, investments, and actions after Red signaling.
- U.S. pays the readiness bill before making any other investments or actions.
- U.S. and NATO/EU play and resolve any Investment Cards they choose, in any order.
- Then U.S. and NATO/EU execute and resolve actions in any order.
- Blue actions are mostly free-play. Blue articulates intent; the White Cell translates it into game terms and adjudication procedures.
- Blue may play as many affordable Action and Investment Cards as resources and card/rule conditions allow.
- Neither U.S. nor NATO/EU may run an RP deficit unless the scenario or White Cell allows it.
- If the U.S. lacks resources later in the turn to respond to a Red action or International Event, it may appeal for emergency funding. Whether to allocate and how much may be decided by White Cell and may be decided by die roll.

Tags: `DETERMINISTIC` for readiness payment; `CARD_DEFINED` for printed cards; `WHITE_CELL_ADJUDICATION` for free-play action translation and emergency funding.

### 5.4 Red Investments and Actions Phase

Default procedure:

- Each Red player chooses which of its three signaled cards, if any, to play, and in what order.
- Red player sequence is chosen by the White Cell by default; it may be randomized by optional rule.
- Cards are played and resolved one at a time.
- Under default rules, Red may stop playing cards at any point based on preceding outcomes.
- Red only pays for cards actually played.
- If a Red player plays more than one card in the turn, at least one played card must be an Action Card and one must be an Investment Card.
- For Red players, each additional card played after the first costs +1 RP per card, unless an optional pace rule or a specific card says otherwise.
- The Red Procure New Forces Investment Card does not count against Red per-turn card costs/limits and costs nothing to play; the player pays only the procurement cost from the table.
- White Cell may inject International or Domestic Events during the phase.

Tags: `CARD_DEFINED` for card contents; `WHITE_CELL_ADJUDICATION` for default sequencing and event injection.

### 5.5 Annual Resources Allocation Phase

Default procedure:

- Add each player's scenario-specified per-turn RP allocation to its existing resource pool.
- Unspent RPs carry over.
- Card/action/event outcomes may adjust allocations.
- U.S. baseline per-turn allocation may vary by the DoD Budget Variation table.

U.S. DoD Budget Variation:

| D10 roll | Change in allocation |
|---:|---:|
| 0-1 | -2 RP |
| 2-4 | -1 RP |
| 5-7 | no change |
| 8 | +1 RP |
| 9 | +2 RP |

Tags: `DETERMINISTIC`, unless an event/card/scenario alters allocation.

### 5.6 State-of-the-World Summary Phase

White Cell summarizes notable actions, events, and outcomes from the turn in real-world narrative terms.

Tag: `SUMMARY_REQUIRED`.

## 6. Cards

### 6.1 Card Types

All possible printed Hedgemony card classes must be supported:

| Card type | Controller | Typical use |
|---|---|---|
| `Action` | Player | Military, diplomatic, economic, gray zone, exercise, posturing, incursion, invasion, cyber, out-of-area operation, and other player actions |
| `Investment` | Player | Force procurement, force modernization, Critical Capability upgrades, National Tech Level investments, base construction, proxy development, infrastructure, and similar future-oriented spending |
| `Domestic Event` | White Cell | Player-specific positive or negative event |
| `International Event` | White Cell | Multi-player, regional, global, or cross-player event |

Cards may be Public or Private. Public outcomes are revealed to everyone. For Private investments, the fact of the investment is public but the outcome may be kept between the affected player and the White Cell. For Private Action or Event Cards, if no conditions are specified, or if the printed conditions are satisfied, the action/event and its outcome remain secret between the affected player and the White Cell unless the card says otherwise or later conditions reveal it. Some Action, Investment, and International Event cards may still be displayed for facilitation while the outcome is resolved privately. Private Domestic Events are typically handed directly to affected players. Private rolls should be hidden from other players.

### 6.2 Card Data Schema

```yaml
card:
  id: string                       # printed bottom-right card number, e.g., RU-01, PRC-22, EVT-CON-24
  type: Action | Investment | DomesticEvent | InternationalEvent
  subtype: string?                 # e.g., Major Action, Conflict Event, Procure New Forces
  owner: player_id | WhiteCell | null
  public_private: Public | Private
  private_conditions: [condition]
  title: string
  description: text
  aor: location_id?
  players_involved: [player_id]
  cost:
    resource_points: integer | table_reference | expression | null
    additional_red_card_cost_applies: boolean
  play_constraints:
    frequency: string?             # e.g., may play every turn
    phase_restrictions: [phase_id]
    prerequisites: [condition]
    unopposed_rule: rule?
  response:
    allowed_responders: [player_id | side]
    response_window: immediate | same_phase | card_defined | white_cell
    force_commitment_allowed: boolean
    cost_rule: rule_reference?
  resolution:
    method:
      - fixed_effect
      - card_d10_table
      - crt_a_then_card_outcome
      - rt_b_then_card_outcome
      - proxy_reliability
      - white_cell_adjudication
    table_reference: CRT_A | RT_B | ProxyReliability | DoDBudgetVariation | null
    die: D10?
    modifiers: [modifier]
    critical_capabilities: [capability_id]
    outcome_map: [outcome_row]      # maps D10 ranges or probability outcomes to effects
    reset_rules_apply: boolean
    pinning: pin_rule?
  effects: [effect]
  future_effects: [scheduled_effect]
  notes: text
```

### 6.3 Resolution Methods

Cards can resolve in these ways:

| Method | Procedure |
|---|---|
| `fixed_effect` | Apply the card's printed effect without an external table. |
| `card_d10_table` | Roll D10, apply card modifiers, use the card's own roll mapping. |
| `crt_a_then_card_outcome` | Compute/select CRT A column, roll D10 plus modifiers, obtain probability outcome, then map that outcome through the card's outcome table. |
| `rt_b_then_card_outcome` | Compute/select RT B column, roll D10 plus modifiers, obtain probability outcome, then map that outcome through the card's outcome table. |
| `proxy_reliability` | Roll D10 on Proxy Forces Reliability table for a specific reliability level. |
| `white_cell_adjudication` | White Cell supplies or confirms the procedure/outcome. Use when the rules or card are ambiguous, free-play is being translated, or scenario-specific facts are needed. |

The five baseline probability outcomes are:

| Code | Outcome |
|---|---|
| `RMG` | Red Major Gain |
| `RmG` | Red Minor Gain |
| `SQ` | Status Quo |
| `BmG` | Blue Minor Gain |
| `BMG` | Blue Major Gain |

### 6.4 Effect Schema

The simulation must support at least these effects:

```yaml
effect:
  type:
    - adjust_resource_points
    - adjust_influence_points
    - set_or_adjust_per_turn_resource_allocation
    - set_national_tech_level
    - adjust_national_tech_level
    - set_critical_capability_mod_level
    - adjust_critical_capability_mod_level
    - procure_forces
    - modernize_forces
    - retire_forces
    - move_forces
    - deploy_or_redeploy_forces
    - set_readiness_level
    - adjust_readiness_level
    - buy_back_readiness
    - pay_readiness_sustainment
    - pin_forces
    - unpin_forces
    - reset_forces
    - create_or_modify_base
    - create_proxy_force
    - develop_proxy_force
    - employ_proxy_force
    - set_visibility
    - create_scenario_flag
    - schedule_future_effect
    - expire_effect
  target: player_id | force_counter_id | proxy_id | location_id | card_id | scenario_flag
  value: integer | string | object
  timing: immediate | start_of_turn | end_of_turn | after_pinning_removed | card_defined
  visibility: public | private_to_player_and_white_cell | white_cell_only
  source_card_id: string?
  requires_adjudication: boolean
```

Use a ground-truth log for all private, future, temporary, and conditional outcomes.

```yaml
ground_truth_item:
  id: string
  source: card_id | rule_id | white_cell
  created_turn: integer
  visible_to: [player_id | WhiteCell | Public]
  effect: effect
  trigger_turn: integer?
  expiration_turn: integer?
  trigger_condition: condition?
  status: pending | active | expired | resolved
  narrative_note: text
```

## 7. Resources and Influence

RPs pay for force development, U.S. readiness, deployment, employment, card costs, investments, upgrades, events, proxy incentives, and other card-defined costs.

IPs are the single formal victory metric. They abstract a country/region's standing and ability to shape outcomes. IPs are not the primary learning objective; they motivate and track relative action outcomes.

Rules:

- Starting RPs, per-turn RPs, and starting IPs are scenario-defined.
- RPs not spent in a turn carry over.
- Players may never spend more RPs than they have unless scenario or White Cell permits.
- Card outcomes can add/subtract RPs and/or IPs immediately or on future turns.
- Victory Conditions can be absolute or relative and can allow multiple players to win.

## 8. Deployment, Redeployment, and Bases

### 8.1 General Movement Cost Rules

Rules:

- It costs nothing for any player to deploy/redeploy/reposition forces within an AOR or within their own country.
- Redeploying forces from one OCONUS AOR/location to another OCONUS AOR/location costs 1 RP per movement, regardless of the number of FFs moved or number of AORs traversed, unless a card specifies otherwise.
- The number of movements is determined by different originating locations and destination AORs, or by the number of different actions/events being responded to.
- Redeployment back to a force's home AOR/home base is always free unless the card in play or White Cell specifies otherwise.
- Red player out-of-area operation Action Cards include deployment costs, and multiple movements may require separate out-of-area operation cards/costs.
- Non-U.S. forces are assumed based in the AOR where they started unless scenario says otherwise.
- U.S. CONUS forces are based in CONUS. The home base of U.S. forces starting OCONUS is scenario-defined.

White Cell decides whether forces are collocated when that matters for movement cost.

Tag: `WHITE_CELL_ADJUDICATION`.

### 8.2 U.S. CONUS-Sourced Deployment Costs

Use these tables only for U.S. forces deployed from CONUS to another AOR.

If deployment from CONUS occurs during the U.S. Investments and Actions Phase, use the Proactive table. For proactive deployments, each destination AOR is a separate deployment.

If deployment from CONUS occurs in reaction to an event or Red action and cost is not specified on the card, use the Reactive table. For reactive deployments, each separate event/action being responded to is a separate deployment.

| FFs deployed | Proactive cost | Reactive cost |
|---:|---:|---:|
| 1 | 1 | 2 |
| 2 | 1 | 2 |
| 3 | 2 | 3 |
| 4 | 2 | 3 |
| 5 | 3 | 5 |
| 6 | 3 | 5 |
| 7 | 4 | 6 |
| 8 | 4 | 6 |
| 9 | 5 | 8 |
| 10 | 5 | 8 |
| 11 | 6 | 9 |
| 12 | 6 | 9 |
| 13 | 7 | 11 |
| 14 | 7 | 11 |
| 15 | 8 | 12 |

If FFs deployed exceed 15, the printed table does not define a value. The scenario must define an extension or request `WHITE_CELL_ADJUDICATION`.

### 8.3 Bases

Default scenario:

- RU and PRC may conduct out-of-area operations in certain AORs using Action Cards.
- RU and PRC may invest RPs to build a base in another AOR.
- A Red out-of-area base reduces the cost of all out-of-area operations in that AOR by 1 RP for the remainder of the game.
- U.S. has no default out-of-area operation/base construction cards because OCONUS deployments and existing bases are part of the default scenario.
- U.S. may attempt to build a base as a free-play action. White Cell defines conditions and costs case-by-case. U.S. base-building costs should be somewhat greater than Red costs, and payoff could be modeled as a reduction in some proportion of OCONUS readiness costs for the affected AOR. Uncertainty may use proxy reliability rules.

Tags: Red base effects are `CARD_DEFINED`; U.S. base construction is `WHITE_CELL_ADJUDICATION`.

## 9. Combat Factors from Force Factors

Combat Factors (CFs) are used for combat interactions and other card-defined interactions where force capability matters. CFs depend on FFs, Mod Level, source location, U.S. Readiness Level, and whether U.S. CONUS forces deployed reactively.

### 9.1 In-Theater Combat Factors

Use for forces already in theater when the action starts. Also use for forces flowing from adjacent theaters, then divide the result in half and round up.

| FFs | M1 | M2 | M3 | M4 | M5 | M6 | M7 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| 2 | 2 | 4 | 5 | 7 | 8 | 9 | 10 |
| 3 | 3 | 5 | 7 | 9 | 11 | 12 | 14 |
| 4 | 4 | 7 | 9 | 12 | 14 | 16 | 18 |
| 5 | 5 | 8 | 11 | 14 | 17 | 19 | 22 |
| 6 | 6 | 10 | 13 | 17 | 20 | 23 | 26 |
| 7 | 7 | 11 | 15 | 19 | 23 | 26 | 30 |
| 8 | 8 | 13 | 17 | 22 | 26 | 30 | 34 |
| 9 | 9 | 14 | 19 | 24 | 29 | 33 | 38 |
| 10 | 10 | 16 | 21 | 27 | 32 | 37 | 42 |
| 11 | 11 | 17 | 23 | 29 | 35 | 40 | 46 |
| 12 | 12 | 19 | 25 | 32 | 38 | 44 | 50 |
| 13 | 13 | 20 | 27 | 34 | 41 | 47 | 54 |
| 14 | 14 | 22 | 29 | 37 | 44 | 51 | 58 |
| 15 | 15 | 23 | 31 | 39 | 47 | 54 | 62 |

### 9.2 U.S. CONUS-Sourced Reactive Combat Factors

Use for U.S. forces reactively deployed from CONUS in response to an action/event. The printed note also says this table is used to calculate CFs for U.S. FFs whose readiness was bought back to a higher level on the same turn they are employed in an action involving CRT A.

| FFs | M1 | M2 | M3 | M4 | M5 | M6 | M7 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
| 2 | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| 3 | 2 | 3 | 5 | 6 | 8 | 9 | 11 |
| 4 | 3 | 5 | 6 | 9 | 11 | 12 | 14 |
| 5 | 3 | 6 | 8 | 10 | 13 | 15 | 17 |
| 6 | 4 | 7 | 9 | 12 | 16 | 18 | 20 |
| 7 | 5 | 8 | 11 | 14 | 18 | 20 | 24 |
| 8 | 6 | 9 | 12 | 16 | 20 | 24 | 27 |
| 9 | 6 | 10 | 14 | 18 | 23 | 26 | 30 |
| 10 | 7 | 12 | 15 | 20 | 25 | 29 | 33 |
| 11 | 8 | 12 | 17 | 21 | 28 | 32 | 36 |
| 12 | 9 | 14 | 18 | 24 | 30 | 35 | 40 |
| 13 | 9 | 15 | 20 | 25 | 32 | 37 | 43 |
| 14 | 10 | 16 | 21 | 27 | 35 | 40 | 46 |
| 15 | 11 | 17 | 23 | 29 | 37 | 43 | 49 |

### 9.3 U.S. Readiness Impact on Combat Factors

For U.S. CFs derived from FFs with less than 100 percent Readiness, use this table after calculating baseline CFs.

| Baseline CFs | 90% | 80% | 70% | 60% | 50% |
|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 0 | 0 | 0 |
| 2 | 1 | 1 | 1 | 0 | 0 |
| 3 | 2 | 2 | 1 | 1 | 1 |
| 4 | 3 | 3 | 2 | 1 | 1 |
| 5 | 4 | 3 | 2 | 2 | 1 |
| 6 | 5 | 4 | 3 | 2 | 1 |
| 7 | 6 | 5 | 4 | 3 | 2 |
| 8 | 7 | 5 | 4 | 3 | 2 |
| 9 | 8 | 6 | 5 | 4 | 3 |
| 10 | 9 | 7 | 5 | 4 | 3 |
| 15 | 13 | 10 | 8 | 6 | 4 |
| 20 | 18 | 14 | 11 | 8 | 6 |
| 25 | 22 | 17 | 13 | 10 | 7 |
| 30 | 26 | 20 | 16 | 12 | 9 |
| 35 | 30 | 23 | 18 | 14 | 10 |
| 40 | 35 | 27 | 21 | 16 | 12 |
| 45 | 39 | 30 | 23 | 18 | 13 |
| 50 | 43 | 33 | 26 | 20 | 15 |

If baseline CFs are not in the printed table, do not interpolate unless a scenario/table extension says to. Request `WHITE_CELL_ADJUDICATION`.

### 9.4 Combat Factor Procedures

Non-U.S. player:

1. Subtotal FFs by Mod Level.
2. Further subtotal by source: in theater or adjacent theater.
3. For each in-theater subtotal, use the In-Theater table.
4. For each adjacent-theater subtotal, use the In-Theater table, then divide by 2 and round up.
5. Sum resulting CFs.

U.S. player:

1. Subtotal FFs by unique combination of source, Readiness Level, and Mod Level.
2. Source categories are in theater, adjacent theater, and CONUS.
3. Use In-Theater table for forces already in theater on the turn the action started.
4. Use CONUS-Sourced Reactive table for forces reactively deployed from CONUS.
5. For adjacent-theater forces, use In-Theater table, then divide by 2 and round up.
6. For each group with less than 100 percent Readiness, apply the Readiness Impact table.
7. Sum resulting CFs.

## 10. CRT A: Combat Resolution Table A

Use CRT A for combat force-on-force interactions, or card-defined interactions whose outcome depends on force combat capability. The card normally specifies CRT A.

### 10.1 Column Selection

Unless the card says otherwise:

1. Calculate opposing CFs.
2. Divide the larger CF total by the smaller CF total and round down.
3. If the ratio is 1, use `1:1`.
4. If Blue has the larger CF total, use `Blue 2:1`, `Blue 3:1`, or `Blue >=4:1`.
5. If Red has the larger CF total, use `Red 2:1`, `Red 3:1`, or `Red >=4:1`.

If one side has zero CFs or no response, use the card's unopposed rule or request `WHITE_CELL_ADJUDICATION`; the printed CRT procedure does not define division by zero.

### 10.2 Die Roll and Modifiers

Roll D10. D10 values are 0-9 before modifiers. Add all applicable modifiers:

- Critical Capability difference when the card specifies relevant capabilities.
- Readiness Level die-roll modifiers if specified by the card/rules in play.
- Any card-defined modifiers.

For Critical Capability difference, use the difference between the best relevant Blue and Red Critical Capability Mod Levels. Higher Blue capability is positive; higher Red capability is negative, unless the card changes side mapping.

Use the modified roll row in CRT A. The table can use results below 0 or above 9 because of modifiers.

### 10.3 CRT A Table

| Modified D10 | Red >=4:1 | Red 3:1 | Red 2:1 | 1:1 | Blue 2:1 | Blue 3:1 | Blue >=4:1 |
|---:|---|---|---|---|---|---|---|
| < -5 | RMG | RMG | RMG | RMG | RMG | RMG | SQ |
| -5 | RMG | RMG | RMG | RMG | RMG | RmG | SQ |
| -4 | RMG | RMG | RMG | RMG | RMG | RmG | SQ |
| -3 | RMG | RMG | RMG | RMG | RMG | RmG | BmG |
| -2 | RMG | RMG | RMG | RMG | RmG | SQ | BmG |
| -1 | RMG | RMG | RMG | RMG | RmG | SQ | BmG |
| 0 | RMG | RMG | RMG | RMG | RmG | SQ | BmG |
| 1 | RMG | RMG | RMG | RmG | SQ | BmG | BmG |
| 2 | RMG | RMG | RmG | RmG | SQ | BmG | BmG |
| 3 | RMG | RMG | RmG | SQ | SQ | BmG | BMG |
| 4 | RMG | RmG | RmG | SQ | BmG | BmG | BMG |
| 5 | RMG | RmG | RmG | SQ | BmG | BmG | BMG |
| 6 | RMG | RmG | SQ | SQ | BmG | BMG | BMG |
| 7 | RmG | RmG | SQ | BmG | BmG | BMG | BMG |
| 8 | RmG | RmG | SQ | BmG | BMG | BMG | BMG |
| 9 | RmG | SQ | BmG | BMG | BMG | BMG | BMG |
| 10 | RmG | SQ | BmG | BMG | BMG | BMG | BMG |
| 11 | RmG | SQ | BmG | BMG | BMG | BMG | BMG |
| 12 | RmG | BmG | BMG | BMG | BMG | BMG | BMG |
| 13 | SQ | BmG | BMG | BMG | BMG | BMG | BMG |
| 14 | SQ | BmG | BMG | BMG | BMG | BMG | BMG |
| > 14 | SQ | BMG | BMG | BMG | BMG | BMG | BMG |

The CRT A result is normally only the probability outcome. Then consult the card's outcome table to apply IP/RP/force/other effects.

## 11. Pinned Forces, Losses, and Reset

### 11.1 Pinned Forces

Forces committed to an interaction involving CRT A may be pinned to the AOI for a duration, usually one or two turns. RT B interactions may also pin forces, though this is less likely. The card or White Cell specifies whether forces are pinned and for how long.

Pinned forces:

- May not move.
- May not respond to other actions/events unless those actions/events are within the existing AOI, as determined by White Cell.
- Use a marker indicating one turn, two turns, or indefinite duration.

Tag: `CARD_DEFINED` or `WHITE_CELL_ADJUDICATION`.

### 11.2 Losses

Hedgemony does not remove combat losses in a traditional wargame sense. Damage/losses are not tracked on force counters and losing forces are not permanently removed from the board by combat loss.

If a side suffers a major combat-related defeat, the card or White Cell may impose additional cost and/or turn penalty before the forces can be used again.

Tag: `CARD_DEFINED` or `WHITE_CELL_ADJUDICATION`.

### 11.3 Reset Rules

When a card says "Reset rules apply":

1. After the interaction, or after a Pinned marker is removed, 50 percent of forces committed to the conflict, rounded up, must be sent/reset to home bases for an additional turn.
2. Home base is either the force's starting permanent station or its home country/base, as determined by scenario start conditions or White Cell.
3. White Cell resolves home base disputes.
4. For U.S. forces, reduce Readiness as follows:

| CRT A outcome when reset applies | U.S. Readiness reduction |
|---|---:|
| Blue gain or Status Quo | -10 percentage points |
| Red Minor Gain | -20 percentage points |
| Red Major Gain | -30 percentage points |

5. U.S. player must use Readiness Buy-Back costs to restore higher Readiness.
6. Red players pay 1 RP for each reset FF to restore deployability.
7. Restored Red forces are ready for play on the following turn.

If a U.S. readiness reduction would go below the printed minimum 50 percent, the printed rule does not specify the result; request `WHITE_CELL_ADJUDICATION`.

## 12. RT B: Resolution Table B

Use RT B for noncombat interactions between opposing forces: presence, posturing, exercises, gray zone operations, and other card-defined noncombat interactions. Cards normally specify RT B.

### 12.1 Column Selection

Unless the card says otherwise:

1. Compare opposing FFs, not Mod Levels. Mod Levels do not apply unless the card says otherwise.
2. Divide the larger FF total by the smaller FF total and round down.
3. If the ratio is 1, use `Parity`.
4. If Blue has a ratio of 2 or more, use `Blue Advantage`.
5. If Red has a ratio of 2 or more, use `Red Advantage`.

For each force counter acting or responding from out of area, divide the FFs on the counter by 2 and round up on the turn of arrival. On subsequent turns, full FF capacity is available.

If one side has zero FFs or no response, use the card's unopposed rule or request `WHITE_CELL_ADJUDICATION`.

### 12.2 Die Roll

Roll D10, apply card modifiers, then look up the modified roll in RT B. Use the probability outcome to consult the card's outcome table.

### 12.3 RT B Table

| Modified D10 | Red Advantage | Parity | Blue Advantage |
|---:|---|---|---|
| < -4 | RMG | RMG | RmG |
| -4 | RMG | RMG | RmG |
| -3 | RMG | RMG | RmG |
| -2 | RMG | RmG | RmG |
| -1 | RMG | RmG | RmG |
| 0 | RMG | RmG | RmG |
| 1 | RmG | RmG | SQ |
| 2 | RmG | RmG | SQ |
| 3 | RmG | SQ | SQ |
| 4 | RmG | SQ | SQ |
| 5 | SQ | SQ | BmG |
| 6 | SQ | SQ | BmG |
| 7 | SQ | BmG | BmG |
| 8 | SQ | BmG | BmG |
| 9 | BmG | BmG | BMG |
| 10 | BmG | BmG | BMG |
| 11 | BmG | BmG | BMG |
| 12 | BmG | BMG | BMG |
| 13 | BmG | BMG | BMG |
| > 13 | BmG | BMG | BMG |

## 13. Procurement, Modernization, and Retirement

### 13.1 Procurement

Procurement increases force capacity by buying new FFs and may increase capability if new forces are bought at higher Mod Level.

Rules:

- A force's Mod Level may not exceed the player's National Tech Level.
- U.S. and NATO/EU may procure forces during the Blue Investments and Actions Phase; procured forces are available immediately.
- Other players may procure forces at the end of their turn by playing Procure New Forces; those forces are available on the next turn during their Investments and Actions Phase or in reaction to U.S./NATO/EU actions during Blue turns.
- Procure New Forces may be played every turn if resources are available.
- Red Procure New Forces does not count against Red per-turn card costs/limits and has no play cost beyond force cost.

Force Procurement Cost:

| FFs | M1 | M2 | M3 | M4 | M5 | M6 | M7 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| 2 | 4 | 6 | 8 | 10 | 12 | 14 | 16 |
| 3 | 6 | 8 | 10 | 12 | 14 | 16 | 18 |
| 4 | 8 | 11 | 14 | 17 | 20 | 23 | 26 |
| 5 | 10 | 13 | 16 | 19 | 22 | 25 | 28 |
| 6 | 12 | 16 | 20 | 24 | 28 | 32 | 36 |
| 7 | 14 | 18 | 22 | 26 | 30 | 34 | 38 |
| 8 | 16 | 21 | 26 | 31 | 36 | 41 | 46 |
| 9 | 18 | 23 | 28 | 33 | 38 | 43 | 48 |
| 10 | 20 | 26 | 32 | 38 | 44 | 50 | 56 |

If a procurement count exceeds 10 FFs, the printed table does not define a single-row value. The scenario may require multiple purchases, an extended table, or `WHITE_CELL_ADJUDICATION`.

### 13.2 Modernization

Modernization upgrades existing FFs to higher Mod Levels.

Rules:

- A modernization Investment Card specifies what percentage of existing FFs may be modernized. The permitted count is rounded down.
- Player specifies which FFs on the board are modernized.
- Cost is based on number of FFs and change in Mod Level.
- Resulting Mod Level may not exceed National Tech Level.
- Forces may not be modernized in the same turn in which they were procured.
- Pinned forces may not be modernized.
- Modernized forces are available immediately.
- Replace the existing force counter wherever it is on the board unless a card/event says otherwise.

Force Modernization Cost:

| FFs | +1 | +2 | +3 | +4 | +5 | +6 |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 2 | 3 | 4 | 5 | 6 |
| 2 | 2 | 3 | 4 | 5 | 6 | 7 |
| 3 | 3 | 4 | 5 | 6 | 7 | 8 |
| 4 | 4 | 5 | 6 | 7 | 8 | 9 |
| 5 | 5 | 6 | 7 | 8 | 9 | 10 |
| 6 | 6 | 7 | 8 | 9 | 10 | 11 |
| 7 | 7 | 8 | 9 | 10 | 11 | 12 |
| 8 | 8 | 9 | 10 | 11 | 12 | 13 |
| 9 | 9 | 10 | 11 | 12 | 13 | 14 |
| 10 | 10 | 11 | 12 | 13 | 14 | 15 |

If a modernization count exceeds 10 FFs, the printed table does not define a single-row value. The scenario may require multiple modernization batches, an extended table, or `WHITE_CELL_ADJUDICATION`.

### 13.3 Retirement

Only the U.S. player has the printed retirement option.

Rules:

- U.S. forces may be retired only if they start the turn in CONUS.
- U.S. readiness costs must be paid first at whatever Readiness Level those forces had at the beginning of the turn.
- During any Blue Investments and Actions Phase, U.S. may announce retirement as an action and remove one or more CONUS FFs from the board.
- Freed resources affect subsequent turns.
- Retired forces can only be restored by procurement.
- No printed constraint exists on frequency, but the choice should align with U.S. stated strategy objectives.

## 14. National Tech and Critical Capability Upgrades

National Tech Level represents a player's national S&T/R&D capability and capacity. It is the upper limit for Force Mod Levels and Critical Capability Mod Levels.

Rules:

- Force Mod Level may not exceed National Tech Level.
- Critical Capability Mod Level may not exceed National Tech Level unless scenario/card explicitly overrides.
- Players may invest to upgrade National Tech Level through scenario/card-defined rules, including costs, success probabilities, and timing.
- Critical Capability upgrade procedures are card/scenario-defined.
- Events may raise, lower, delay, or otherwise affect National Tech Level or upgrade costs/probabilities.

Tags: `CARD_DEFINED` and `SCENARIO_DEFINED`.

## 15. U.S. Readiness

Readiness is tracked explicitly only for U.S. forces. Non-U.S. readiness is abstracted through force structure and Mod Levels.

Readiness Levels in printed tables: 50%, 60%, 70%, 80%, 90%, 100%.

Rules:

- U.S. must pay readiness sustainment at the beginning of the Blue Investments and Actions Phase before making other investments/actions.
- U.S. may configure readiness force-by-force, including tiered readiness.
- It costs more to maintain OCONUS readiness than CONUS readiness.
- Lower readiness reduces CFs for combat and may affect noncombat/events if specified by a card.
- Reducing readiness costs nothing, but savings apply only on subsequent turns because the current turn's readiness bill is paid first.
- U.S. may buy back readiness to a higher level at any point in a turn when U.S. may take an action, react, or make an investment.
- After buy-back, higher sustainment costs apply on subsequent turns until readiness is reduced again.

### 15.1 Readiness Sustainment Cost

Compute:

1. Subtotal U.S. FFs in CONUS by Readiness Level.
2. Look up each subtotal in the CONUS sustainment table and sum.
3. Subtotal U.S. FFs deployed OCONUS by Readiness Level.
4. Look up each subtotal in the OCONUS sustainment table and sum.
5. Total readiness bill = CONUS total + OCONUS total.

CONUS Readiness Sustainment Cost:

| FFs | 100% | 90% | 80% | 70% | 60% | 50% |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 1 | 1 | 1 | 1 | 1 |
| 2 | 2 | 2 | 2 | 2 | 2 | 1 |
| 3 | 3 | 3 | 3 | 2 | 2 | 2 |
| 4 | 4 | 4 | 3 | 3 | 3 | 2 |
| 5 | 5 | 5 | 4 | 4 | 3 | 3 |
| 6 | 6 | 5 | 5 | 4 | 4 | 3 |
| 7 | 7 | 6 | 5 | 5 | 4 | 4 |
| 8 | 8 | 7 | 6 | 5 | 5 | 4 |
| 9 | 9 | 8 | 7 | 6 | 5 | 5 |
| 10 | 10 | 9 | 8 | 7 | 6 | 5 |
| 15 | 15 | 13 | 11 | 10 | 9 | 8 |
| 20 | 20 | 17 | 15 | 13 | 12 | 10 |
| 25 | 25 | 21 | 18 | 16 | 14 | 13 |
| 30 | 30 | 25 | 22 | 19 | 17 | 15 |

OCONUS Readiness Sustainment Cost:

| FFs | 100% | 90% | 80% | 70% | 60% | 50% |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 2 | 2 | 2 | 2 | 2 |
| 2 | 4 | 4 | 4 | 4 | 4 | 2 |
| 3 | 6 | 6 | 6 | 4 | 4 | 4 |
| 4 | 8 | 8 | 6 | 6 | 6 | 4 |
| 5 | 10 | 10 | 8 | 8 | 6 | 6 |
| 6 | 12 | 10 | 10 | 8 | 8 | 6 |
| 7 | 14 | 12 | 10 | 10 | 8 | 8 |
| 8 | 16 | 14 | 12 | 10 | 10 | 8 |
| 9 | 18 | 16 | 14 | 12 | 10 | 10 |
| 10 | 20 | 18 | 16 | 14 | 12 | 10 |
| 15 | 30 | 26 | 22 | 20 | 18 | 16 |
| 20 | 40 | 34 | 30 | 26 | 24 | 30 |
| 25 | 50 | 42 | 36 | 32 | 28 | 26 |
| 30 | 60 | 50 | 44 | 38 | 34 | 30 |

Note: the OCONUS 20 FF / 50% value is preserved as printed in the extracted rules table: 30.

If FF subtotal is not listed, do not interpolate unless scenario/table extension says to. Request `WHITE_CELL_ADJUDICATION`.

### 15.2 Readiness Buy-Back Cost

Use when U.S. raises a force group from a lower to a higher Readiness Level during a turn. Cost is based on location and percentage-point increase.

CONUS Readiness Buy-Back Cost:

| FFs | +10% | +20% | +30% | +40% | +50% |
|---:|---:|---:|---:|---:|---:|
| 1 | 1 | 2 | 3 | 4 | 5 |
| 2 | 2 | 3 | 4 | 5 | 6 |
| 3 | 3 | 4 | 5 | 6 | 7 |
| 4 | 4 | 5 | 6 | 7 | 8 |
| 5 | 5 | 6 | 7 | 8 | 9 |
| 6 | 6 | 7 | 8 | 9 | 10 |
| 7 | 7 | 8 | 9 | 10 | 11 |
| 8 | 8 | 9 | 10 | 11 | 12 |
| 9 | 9 | 10 | 11 | 12 | 13 |
| 10 | 10 | 11 | 12 | 13 | 14 |
| 15 | 15 | 16 | 17 | 18 | 19 |
| 20 | 20 | 21 | 22 | 23 | 24 |
| 25 | 25 | 26 | 27 | 28 | 29 |
| 30 | 30 | 31 | 32 | 33 | 34 |

OCONUS Readiness Buy-Back Cost:

| FFs | +10% | +20% | +30% | +40% | +50% |
|---:|---:|---:|---:|---:|---:|
| 1 | 2 | 3 | 4 | 6 | 7 |
| 2 | 3 | 4 | 6 | 7 | 8 |
| 3 | 4 | 6 | 7 | 8 | 10 |
| 4 | 6 | 7 | 8 | 10 | 11 |
| 5 | 7 | 8 | 10 | 11 | 12 |
| 6 | 8 | 10 | 11 | 12 | 14 |
| 7 | 10 | 11 | 12 | 14 | 15 |
| 8 | 11 | 12 | 14 | 15 | 16 |
| 9 | 12 | 14 | 15 | 16 | 17 |
| 10 | 14 | 15 | 16 | 17 | 19 |
| 15 | 20 | 21 | 23 | 24 | 25 |
| 20 | 27 | 28 | 29 | 30 | 32 |
| 25 | 33 | 34 | 36 | 37 | 38 |
| 30 | 40 | 41 | 42 | 43 | 45 |

If FF subtotal or readiness increase is not listed, do not interpolate unless scenario/table extension says to. Request `WHITE_CELL_ADJUDICATION`.

## 16. Proxy Forces

Proxy forces are third-party allied or partner forces that support a sponsor's actions. They may be called for on a card, instantiated case-by-case with White Cell, or scripted in a scenario.

Once represented on the board, proxy forces use gray counters and behave like other non-U.S. forces in combat and noncombat actions.

Scenario/White Cell must define or adjudicate:

- Whether proxies exist or can be created.
- Conditions for proxy participation.
- Proxy capabilities, Mod Levels, and number of FFs.
- Representation on board.
- RP commitment required from sponsor.
- Reliability level: Certain, High, Medium, Low.
- Scope/geographic restrictions.
- Whether sponsor forces must be present or participate.

Tags: `SCENARIO_DEFINED` and `WHITE_CELL_ADJUDICATION`.

### 16.1 Proxy Reliability Table

| D10 | Certain | High | Medium | Low |
|---:|---|---|---|---|
| 0 | Success | Fail | Fail | Fail |
| 1 | Success | Fail | Fail | Fail |
| 2 | Success | Success | Fail | Fail |
| 3 | Success | Success | Fail | Fail |
| 4 | Success | Success | Success | Fail |
| 5 | Success | Success | Success | Fail |
| 6 | Success | Success | Success | Success |
| 7 | Success | Success | Success | Success |
| 8 | Success | Success | Success | Success |
| 9 | Success | Success | Success | Success |

Reliability rates:

| Level | Success chance |
|---|---:|
| Certain | 100% |
| High | 80% |
| Medium | 60% |
| Low | 40% |

### 16.2 Proxy Participation

1. Determine whether the proxy agrees to participate through scenario, card, or case-by-case White Cell adjudication.
2. Assess reliability level.
3. Roll D10 on Proxy Reliability.
4. Success means the proxy participates.
5. Failure means the proxy does not participate.

### 16.3 Proxy Development

Use when a player wants a proxy to procure or modernize forces.

1. White Cell determines the percentage cost the sponsor must contribute.
2. Use Modernization/Procurement Cost tables to calculate force development cost and pay it.
3. Roll D10 on Proxy Reliability based on assessed development reliability.
4. Success means forces are delivered as intended.
5. Failed modernization: delivered Mod Level is one less than intended. If the intended change was +1, modernization failed completely.
6. Failed procurement: one fewer FF is delivered than intended. If intended procurement was 1 FF, no force is delivered.
7. Modernized or procured proxies are available for employment on the subsequent turn.

### 16.4 Proxy Employment

1. Determine whether sponsor forces must participate or be present.
2. Assess employment reliability.
3. Roll D10 on Proxy Reliability.
4. Success means proxy forces contribute as intended; resolve the action using the appropriate tables/card.
5. Failure means proxy forces do not participate or contribute.

## 17. Optional Rules

### 17.1 Red Pace of Play

Default: each Red card after the first costs +1 additional RP.

Optional pace rule can reduce this cost, delay it until after the second action, or remove it entirely.

Tag: `SCENARIO_DEFINED`.

### 17.2 Activation Markers and Red Right of Refusal

Default: Red may signal cards and later choose not to play them.

Optional rule:

- During Red Signaling, Red places an activation marker on each signaled card.
- Marker has `Activate?` face-up and hidden `Yes`/`No` intent face-down.
- During Red Investments and Actions, Red must play cards marked for activation if card conditions can be met, regardless of outcomes up to that point.

Tag: `SCENARIO_DEFINED`.

### 17.3 Random Events

Default: White Cell chooses whether/when to inject International or Domestic Events.

Optional rule:

- White Cell rolls at predesignated or ad hoc times to determine whether an event occurs.
- Event deck may be chosen randomly.
- Cards may be drawn randomly from one or more event decks.

Tag: `SCENARIO_DEFINED`.

### 17.4 Random Red Player Sequence

Default: White Cell selects Red Signaling and Red Investments/Actions sequence.

Optional rule:

- Each Red player rolls D10.
- Sequence is ascending or descending, chosen by White Cell/rule.
- White Cell determines order in ties.

Tag: `SCENARIO_DEFINED` with `WHITE_CELL_ADJUDICATION` for ties unless the scenario defines tie rules.

## 18. Default Scenario Data

The default scenario reflects game design conditions, not a real-world assessment.

### 18.1 Default Starting Conditions

| Parameter | US | NATO/EU | RU | PRC | DPRK | IR |
|---|---:|---:|---:|---:|---:|---:|
| Starting force size | 20 | 5 | 9 | 15 | 10 | 5 |
| National Tech Level | 4 | 4 | 4 | 4 | 1 | 2 |
| Starting resources | 40 | 10 | 15 | 15 | 5 | 8 |
| Per-turn resources | 30 | 5 | 5 | 4 | 3 | 4 |
| Starting Influence Points | 50 | 50 | 15 | 40 | 5 | 5 |

Default Critical Capability Mod Levels:

| Capability | US | NATO/EU | RU | PRC | DPRK | IR |
|---|---:|---:|---:|---:|---:|---:|
| LRF |  |  | 4 | 4 | 1 | 2 |
| C4ISR | 3 | 3 | 3 | 3 |  |  |
| IAMD/BMD | 3 | 3 |  |  |  |  |
| SOF | 3 |  |  |  |  | 1 |
| Nuclear Forces |  |  |  |  | 0 |  |

Default Initial Force Laydown:

| Location/AOR | US | NATO/EU | RU | PRC | DPRK | IR |
|---|---|---|---|---|---|---|
| CONUS | 14 x M3 |  |  |  |  |  |
| INDOPACOM (PRC) | 1 x M3 |  |  | 5 x M1; 5 x M2; 5 x M3 |  |  |
| INDOPACOM (DPRK) | 2 x M3 |  |  |  | 10 x M1 |  |
| CENTCOM (Iran) |  |  |  |  |  | 5 x M2 |
| CENTCOM (Afghanistan) | 1 x M3 |  |  |  |  |  |
| CENTCOM (Iraq) | 1 x M3 |  |  |  |  |  |
| EUCOM (RU) | 1 x M3 | 5 x M4 | 5 x M2; 4 x M3 |  |  |  |

### 18.2 Default Victory Conditions

| Player | Victory condition |
|---|---|
| US | IPs > IPs of everyone, and DPRK does not win |
| NATO/EU | IPs > IPs of RU, and RU does not win |
| RU | IPs >= US IPs - 5 |
| PRC | IPs >= US IPs - 3, and DPRK neither wins nor loses |
| DPRK | IPs > 15, or U.S. leaves Korean Peninsula; lose if IPs = 0 |
| IR | IPs > 20 |

## 19. Digital Adjudication and Summary Requirements

The digital simulation must explicitly pause for or record White Cell input in these cases:

- Translating Blue free-play actions into game abstraction.
- Resolving ambiguous card conditions.
- Deciding whether an Event Card is injected under default rules.
- Choosing Red player sequence under default rules.
- Determining Red signaling order under default rules.
- Deciding whether forces are collocated for movement cost.
- Defining or resolving home bases when unclear.
- Handling U.S. emergency funding requests.
- Defining U.S. base construction costs, conditions, and payoff.
- Assessing proxy reliability levels and participation/development/employment constraints.
- Extending or resolving values outside printed tables.
- Deciding pinning when not specified by card.
- Imposing additional cost/turn penalties for major defeat when card does not specify.
- Resolving any unopposed action that lacks a card-defined unopposed rule.
- Resolving any rule conflict or missing scenario fact.

The digital simulation must record summaries in these cases:

- Game-start state-of-world summary.
- Red Signaling Phase intelligence-style summaries.
- Public action/event backstory after resolution.
- State-of-the-World Summary Phase at the end of each turn.

## 20. Minimal Simulation Loop

```yaml
turn_loop:
  - phase: RedSignaling
    actions:
      - red_players_select_three_cards
      - validate_signal_mix_when_required
      - record_signal_brief_summaries
      - inject_events_if_white_cell_or_optional_random_rule
  - phase: BlueInvestmentsAndActions
    actions:
      - calculate_and_pay_us_readiness_bill
      - resolve_blue_investments
      - resolve_blue_actions_or_free_play_adjudication
      - inject_events_if_white_cell_or_optional_random_rule
  - phase: RedInvestmentsAndActions
    actions:
      - determine_red_player_sequence
      - for_each_red_player_resolve_selected_signaled_cards
      - apply_additional_red_card_costs
      - inject_events_if_white_cell_or_optional_random_rule
  - phase: AnnualResourcesAllocation
    actions:
      - roll_us_budget_variation
      - add_per_turn_resources
      - apply_allocation_modifiers
  - phase: StateOfWorldSummary
    actions:
      - record_turn_summary
      - update_ground_truth_and_future_effects
      - advance_turn
```

## 21. Validation Rules

Before and after every action/event resolution, validate:

- No player has negative RPs unless scenario/White Cell allowed a deficit.
- Force Mod Level <= owner National Tech Level.
- Critical Capability Mod Level <= National Tech Level unless scenario/card overrides.
- U.S. Readiness Level is one of 50, 60, 70, 80, 90, 100 unless scenario/card/White Cell says otherwise.
- Pinned forces do not move/respond outside their pinned AOI.
- Pinned forces are not modernized.
- Forces procured this turn are not modernized this turn.
- Private outcomes are visible only to allowed viewers.
- Future and temporary effects are in the ground-truth log.
- All table lookups are within printed or scenario-extended ranges.
- All required White Cell adjudications are either completed or explicitly pending.
