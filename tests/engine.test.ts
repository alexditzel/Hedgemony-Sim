import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { basename } from "node:path";
import defaultScenario from "../src/data/defaultScenario.json";
import { canViewLog, canViewRoll } from "../src/components/visibility";
import {
  SequenceDiceRoller,
  advanceBlueToActions,
  annualResourceAllocation,
  beginBlueReadinessBill,
  beginRedInvestmentsAndActions,
  buyBackReadiness,
  calculateCombatFactors,
  calculateMovementCost,
  calculateUsReadinessBill,
  createInitialGameState,
  developProxyForce,
  getBudgetVariation,
  getConusDeploymentCost,
  getCrtAOutcome,
  getInTheaterCombatFactors,
  getModernizationCost,
  getProcurementCost,
  getProxyReliabilityChance,
  getProxyReliabilityResult,
  getReadinessBuyBackCost,
  getReadinessSustainmentCost,
  getRedChoiceOptions,
  getRtBOutcome,
  injectWhiteCellEvent,
  modernizeForces,
  payUsReadinessBill,
  playRedSignaledCard,
  procureForces,
  recordGameStartSummary,
  recordStateOfWorldSummary,
  requestBlueFreePlayAdjudication,
  resolveCard,
  resolveProxyParticipation,
  resolveWhiteCellAdjudication,
  setActiveBluePlayer,
  restoreResetRedForces,
  retireUsForces,
  selectCrtAColumn,
  selectRtBColumn,
  signalRedCards,
  skipRemainingRedCards,
  validateState,
  type GameState,
  type Scenario
} from "../src/engine";

const scenario = defaultScenario as unknown as Scenario;

function expectRuleValue<T>(result: { ok: true; value: T } | { ok: false }, value: T): void {
  expect(result).toMatchObject({ ok: true, value });
}

function freshState(): GameState {
  return createInitialGameState(scenario);
}

function startTurnThroughBlueReadiness(): GameState {
  let state = recordGameStartSummary(freshState(), "Opening summary.");
  for (const [playerId, cardIds] of Object.entries({
    RU: ["RU-ACT-01", "RU-ACT-02", "RU-INV-01"],
    PRC: ["PRC-ACT-01", "PRC-ACT-02", "PRC-INV-01"],
    DPRK: ["DPRK-ACT-01", "DPRK-ACT-02", "DPRK-INV-01"],
    IR: ["IR-ACT-01", "IR-ACT-02", "IR-INV-01"]
  })) {
    const result = signalRedCards(state, playerId, cardIds, `${playerId} brief.`);
    expect(result.issues).toHaveLength(0);
    state = result.state;
  }
  const blue = beginBlueReadinessBill(state);
  expect(blue.issues).toHaveLength(0);
  return blue.state;
}

function startRedPhase(): GameState {
  const paid = payUsReadinessBill(startTurnThroughBlueReadiness());
  expect(paid.issues).toHaveLength(0);
  const actionPhase = advanceBlueToActions(paid.state);
  expect(actionPhase.issues).toHaveLength(0);
  const red = beginRedInvestmentsAndActions(actionPhase.state, ["RU", "PRC", "DPRK", "IR"]);
  expect(red.issues).toHaveLength(0);
  return red.state;
}

describe("printed tables", () => {
  it("returns defined table values and rejects missing printed values", () => {
    expectRuleValue(getConusDeploymentCost(5, "proactive"), 3);
    expect(getConusDeploymentCost(16, "reactive").ok).toBe(false);
    expectRuleValue(getInTheaterCombatFactors(5, 4), 14);
    expectRuleValue(getProcurementCost(3, 4), 12);
    expect(getProcurementCost(11, 1).ok).toBe(false);
    expectRuleValue(getModernizationCost(5, 2), 6);
    expectRuleValue(getReadinessSustainmentCost(20, 50, "OCONUS"), 30);
    expectRuleValue(getReadinessBuyBackCost(4, 40, "OCONUS"), 10);
  });

  it("implements CRT A, RT B, budget variation, and proxy reliability tables", () => {
    expect(selectCrtAColumn(17, 17)).toEqual({ ok: true, value: "1:1" });
    expect(selectCrtAColumn(20, 5)).toEqual({ ok: true, value: "Blue >=4:1" });
    expect(selectCrtAColumn(0, 5).ok).toBe(false);
    expect(getCrtAOutcome(-6, "Blue >=4:1")).toBe("SQ");
    expect(getCrtAOutcome(14, "Red 3:1")).toBe("BmG");
    expect(selectRtBColumn(1, 5)).toEqual({ ok: true, value: "Red Advantage" });
    expect(selectRtBColumn(3, 4)).toEqual({ ok: true, value: "Parity" });
    expect(getRtBOutcome(12, "Parity")).toBe("BMG");
    expect(getBudgetVariation(0)).toBe(-2);
    expect(getBudgetVariation(8)).toBe(1);
    expect(getProxyReliabilityResult(1, "High")).toBe("Fail");
    expect(getProxyReliabilityResult(2, "High")).toBe("Success");
    expect(getProxyReliabilityChance("Low")).toBe(0.4);
  });
});

describe("scenario loading and validation", () => {
  it("loads all initial conditions from a single scenario object", () => {
    const state = freshState();
    expect(state.players.US.resource_points).toBe(40);
    expect(state.players.PRC.influence_points).toBe(40);
    expect(state.forces["US-CONUS-10"].force_factors).toBe(10);
    expect(state.cards["RU-ACT-01"].title).toBe("Limited Incursion");
    expect(state.locations.INDOPACOM_PRC.coordinates).toEqual([35.8617, 104.1954]);
    expect(validateState(state).filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("records required summaries and advances the turn loop", () => {
    let state = recordGameStartSummary(freshState(), "World summary.");
    expect(state.phase).toBe("RedSignaling");
    state = { ...state, phase: "StateOfWorldSummary" };
    state = recordStateOfWorldSummary(state, "Year-end summary.");
    expect(state.turn).toBe(2);
    expect(state.phase).toBe("RedSignaling");
    expect(state.summaries.state_of_world[1]).toBe("Year-end summary.");
  });

  it("loads every card from the cards folder into the playable scenario", () => {
    const state = freshState();
    const expectedCardIds = [
      "BLUE-01",
      "DPRK-29",
      "DPRK-30",
      "DPRK-31",
      "DPRK-32",
      "EVT-CON-40",
      "EVT-CON-41",
      "EVT-IR-11",
      "EVT-NATO-18",
      "EVT-RU-22",
      "PRC-30",
      "RU-27",
      "RU-28",
      "RU-29",
      "UAC-1",
      "US-10",
      "US-11"
    ];
    const files = readdirSync("cards").map((file) => basename(file, ".md"));
    expect(files).toHaveLength(expectedCardIds.length);
    expect(Object.keys(state.cards)).toEqual(expect.arrayContaining(expectedCardIds));
    expect(state.players.US.card_decks.action_investment).toEqual(expect.arrayContaining(["BLUE-01", "UAC-1", "US-10", "US-11"]));
    expect(state.players.DPRK.card_decks.action_investment).toEqual(
      expect.arrayContaining(["DPRK-29", "DPRK-30", "DPRK-31", "DPRK-32"])
    );
  });
});

describe("turn sequence and Red signaling", () => {
  it("keeps each Red player's revealed cards separate and exposes remaining choices plus skip", () => {
    let state = recordGameStartSummary(freshState(), "Opening summary.");
    let result = signalRedCards(state, "RU", ["RU-ACT-01", "RU-ACT-02", "RU-INV-01"], "RU brief.");
    expect(result.issues).toHaveLength(0);
    state = result.state;
    result = signalRedCards(state, "PRC", ["PRC-ACT-01", "PRC-ACT-02", "PRC-INV-01"], "PRC brief.");
    state = result.state;
    expect(state.red_signals.RU.card_ids).toEqual(["RU-ACT-01", "RU-ACT-02", "RU-INV-01"]);
    expect(state.red_signals.PRC.card_ids).toEqual(["PRC-ACT-01", "PRC-ACT-02", "PRC-INV-01"]);
    expect(getRedChoiceOptions(state, "RU").remaining.map((card) => card.id)).toEqual([
      "RU-ACT-01",
      "RU-ACT-02",
      "RU-INV-01"
    ]);
    expect(getRedChoiceOptions(state, "RU").canSkip).toBe(true);
  });

  it("enforces Red signaling mix when three cards are chosen", () => {
    const state = recordGameStartSummary(freshState(), "Opening summary.");
    const result = signalRedCards(state, "RU", ["RU-ACT-01", "RU-ACT-02"], "Two actions are allowed.");
    expect(result.issues).toHaveLength(0);
    const invalid = signalRedCards(state, "RU", ["RU-ACT-01", "RU-ACT-02", "RU-ACT-01"], "Duplicate.");
    expect(invalid.issues.length).toBeGreaterThan(0);
  });

  it("requires a played Red two-card set to contain an Action and an Investment before skipping", () => {
    let state = startRedPhase();
    let result = playRedSignaledCard(state, "PRC", "PRC-ACT-01", new SequenceDiceRoller([5]), {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
      red_commitments: [{ force_id: "PRC-INDO-5-M3", source: "in_theater" }],
      blue_players: ["US"],
      red_players: ["PRC"]
    });
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    state = result.state;
    result = playRedSignaledCard(state, "PRC", "PRC-ACT-02", new SequenceDiceRoller([5]), {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
      red_commitments: [{ force_id: "PRC-INDO-5-M2", source: "in_theater" }],
      blue_players: ["US"],
      red_players: ["PRC"]
    });
    state = result.state;
    const skip = skipRemainingRedCards(state, "PRC");
    expect(skip.issues[0].message).toContain("at least one Action and one Investment");
  });

  it("prevents a Red player who signaled two Actions from playing both and getting stuck", () => {
    let state = recordGameStartSummary(freshState(), "Opening summary.");
    for (const [playerId, cardIds] of Object.entries({
      RU: ["RU-ACT-01", "RU-ACT-02", "RU-INV-01"],
      PRC: ["PRC-ACT-01", "PRC-ACT-02"],
      DPRK: ["DPRK-ACT-01", "DPRK-ACT-02", "DPRK-INV-01"],
      IR: ["IR-ACT-01", "IR-ACT-02", "IR-INV-01"]
    })) {
      const result = signalRedCards(state, playerId, cardIds, `${playerId} brief.`);
      expect(result.issues).toHaveLength(0);
      state = result.state;
    }
    const blue = beginBlueReadinessBill(state);
    expect(blue.issues).toHaveLength(0);
    const paid = payUsReadinessBill(blue.state);
    expect(paid.issues).toHaveLength(0);
    const actionPhase = advanceBlueToActions(paid.state);
    expect(actionPhase.issues).toHaveLength(0);
    const red = beginRedInvestmentsAndActions(actionPhase.state, ["RU", "PRC", "DPRK", "IR"]);
    expect(red.issues).toHaveLength(0);
    state = red.state;

    const first = playRedSignaledCard(state, "PRC", "PRC-ACT-01", new SequenceDiceRoller([5]), {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
      red_commitments: [{ force_id: "PRC-INDO-5-M3", source: "in_theater" }],
      blue_players: ["US"],
      red_players: ["PRC"]
    });
    expect(first.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    state = first.state;

    expect(getRedChoiceOptions(state, "PRC")).toMatchObject({ remaining: [], canSkip: true });
    const second = playRedSignaledCard(state, "PRC", "PRC-ACT-02", new SequenceDiceRoller([5]));
    expect(second.issues[0].message).toContain("unable to finish");
    expect(second.state.red_plays.PRC.played_card_ids).toEqual(["PRC-ACT-01"]);

    const skip = skipRemainingRedCards(state, "PRC");
    expect(skip.issues).toHaveLength(0);
    expect(skip.state.red_plays.PRC.skipped).toBe(true);
  });

  it("charges a flat Red additional-card cost for each card after the first", () => {
    const state = startRedPhase();
    const afterOnePlayed = {
      ...state,
      players: {
        ...state.players,
        RU: { ...state.players.RU, resource_points: 15 }
      },
      red_plays: {
        ...state.red_plays,
        RU: { player_id: "RU", played_card_ids: ["RU-ACT-02"], skipped: false }
      }
    };
    const secondCard = resolveCard(afterOnePlayed, { acting_player_id: "RU", card_id: "RU-INV-01" }, new SequenceDiceRoller([5]));
    expect(secondCard.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(secondCard.state.players.RU.resource_points).toBe(11);

    const afterTwoPlayed = {
      ...state,
      players: {
        ...state.players,
        RU: { ...state.players.RU, resource_points: 15 }
      },
      red_plays: {
        ...state.red_plays,
        RU: { player_id: "RU", played_card_ids: ["RU-ACT-02", "RU-ACT-01"], skipped: false }
      }
    };
    const thirdCard = resolveCard(afterTwoPlayed, { acting_player_id: "RU", card_id: "RU-INV-01" }, new SequenceDiceRoller([5]));
    expect(thirdCard.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(thirdCard.state.players.RU.resource_points).toBe(11);
  });
});

describe("readiness, resources, and movement", () => {
  it("calculates and pays the U.S. readiness bill before Blue actions", () => {
    const state = startTurnThroughBlueReadiness();
    const bill = calculateUsReadinessBill(state);
    expect(bill.total).toBe(25);
    expect(bill.rows).toEqual(
      expect.arrayContaining([
        { location: "CONUS", readiness: 100, force_factors: 10, cost: 10 },
        { location: "CONUS", readiness: 80, force_factors: 4, cost: 3 },
        { location: "OCONUS", readiness: 100, force_factors: 6, cost: 12 }
      ])
    );
    const paid = payUsReadinessBill(state);
    expect(paid.state.players.US.resource_points).toBe(15);
    expect(paid.state.phase).toBe("BlueInvestmentsAndActions");
  });

  it("allows NATO/EU to become the active Blue player after the U.S. readiness bill", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness());
    expect(paid.state.active_player_id).toBe("US");
    const switched = setActiveBluePlayer(paid.state, "NATO_EU");
    expect(switched.issues).toHaveLength(0);
    expect(switched.state.active_player_id).toBe("NATO_EU");
    const played = resolveCard(
      switched.state,
      {
        acting_player_id: "NATO_EU",
        card_id: "NATO-INV-01"
      },
      new SequenceDiceRoller([5])
    );
    expect(played.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(played.state.players.NATO_EU.resource_points).toBe(8);
    expect(played.state.players.NATO_EU.influence_points).toBe(51);
  });

  it("enforces Blue investments before Blue actions", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const earlyRedPhase = beginRedInvestmentsAndActions(paid, ["RU", "PRC", "DPRK", "IR"]);
    expect(earlyRedPhase.issues[0].message).toContain("Blue investments must be ended");
    expect(earlyRedPhase.state).toBe(paid);

    const prematureAction = resolveCard(
      paid,
      {
        acting_player_id: "US",
        card_id: "US-ACT-01",
        blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
        red_commitments: [{ force_id: "PRC-INDO-5-M3", source: "in_theater" }],
        blue_players: ["US"],
        red_players: ["PRC"]
      },
      new SequenceDiceRoller([9])
    );
    expect(prematureAction.issues[0].message).toContain("until Blue investments are complete");
    expect(prematureAction.state).toBe(paid);

    const actionPhase = advanceBlueToActions(paid).state;
    const lateInvestment = resolveCard(actionPhase, { acting_player_id: "US", card_id: "US-INV-01" }, new SequenceDiceRoller([5]));
    expect(lateInvestment.issues[0].message).toContain("after Blue actions have begun");
    expect(lateInvestment.state).toBe(actionPhase);
  });

  it("requires explicit White Cell Red sequence input under default rules", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const actionPhase = advanceBlueToActions(paid).state;
    const missingSequence = beginRedInvestmentsAndActions(actionPhase);
    expect(missingSequence.issues[0].message).toContain("White Cell must choose");
    expect(missingSequence.state).toBe(actionPhase);
    expect(missingSequence.state.pending_adjudications).toHaveLength(0);

    const invalidSequence = beginRedInvestmentsAndActions(actionPhase, ["RU", "RU", "PRC", "IR"]);
    expect(invalidSequence.issues[0].message).toContain("exactly once");

    const chosenSequence = beginRedInvestmentsAndActions(actionPhase, ["PRC", "RU", "IR", "DPRK"]);
    expect(chosenSequence.issues).toHaveLength(0);
    expect(chosenSequence.state.phase).toBe("RedInvestmentsAndActions");
    expect(chosenSequence.state.red_sequence).toEqual(["PRC", "RU", "IR", "DPRK"]);
    expect(chosenSequence.state.active_player_id).toBe("PRC");
  });

  it("uses D10 rolls for optional random Red sequence and requires a roller", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const actionPhase = advanceBlueToActions({
      ...paid,
      rules_in_effect: {
        ...paid.rules_in_effect,
        random_red_sequence: true,
        random_red_sequence_order: "ascending",
        random_red_sequence_tie_rule: "player_id"
      }
    }).state;

    const withoutRoller = beginRedInvestmentsAndActions(actionPhase);
    expect(withoutRoller.issues[0].message).toContain("requires a D10 roller");

    const randomized = beginRedInvestmentsAndActions(actionPhase, undefined, new SequenceDiceRoller([8, 1, 5, 3]));
    expect(randomized.issues).toHaveLength(0);
    expect(randomized.state.red_sequence).toEqual(["PRC", "IR", "DPRK", "RU"]);
    expect(randomized.state.rolls.slice(-4).map((roll) => roll.formula)).toEqual([
      "D10(8) = 8",
      "D10(1) = 1",
      "D10(5) = 5",
      "D10(3) = 3"
    ]);
  });

  it("accounts for the 11 FF CONUS 100% readiness subtotal through scenario table extensions", () => {
    let state = startTurnThroughBlueReadiness();
    state = {
      ...state,
      forces: {
        ...state.forces,
        "US-EXTRA-100": {
          id: "US-EXTRA-100",
          owner: "US",
          force_factors: 1,
          modernization_level: 3,
          location_id: "CONUS",
          home_base_id: "CONUS",
          readiness_level: 100,
          pinned: { active: false, remaining_turns: null },
          reset_required: false,
          procured_turn: 1,
          proxy: false
        }
      }
    };
    const bill = calculateUsReadinessBill(state);
    expect(bill.issues).toHaveLength(0);
    expect(bill.rows).toContainEqual({ location: "CONUS", readiness: 100, force_factors: 11, cost: 11 });
    expect(bill.total).toBe(26);
  });

  it("turns missing table rows into resolvable White Cell adjudications instead of dead ends", () => {
    let state = startTurnThroughBlueReadiness();
    state = {
      ...state,
      rules_in_effect: {
        ...state.rules_in_effect,
        table_extensions: []
      },
      forces: {
        ...state.forces,
        "US-EXTRA-100": {
          id: "US-EXTRA-100",
          owner: "US",
          force_factors: 1,
          modernization_level: 3,
          location_id: "CONUS",
          home_base_id: "CONUS",
          readiness_level: 100,
          pinned: { active: false, remaining_turns: null },
          reset_required: false,
          procured_turn: 1,
          proxy: false
        }
      }
    };
    const blocked = payUsReadinessBill(state);
    expect(blocked.issues[0].message).toContain("US_CONUS_READINESS_SUSTAINMENT_COST");
    expect(blocked.state.pending_adjudications[0].payload).toEqual({
      kind: "table_extension",
      table: "US_CONUS_READINESS_SUSTAINMENT_COST",
      row: "11",
      column: "100"
    });
    const resolved = resolveWhiteCellAdjudication(blocked.state, blocked.state.pending_adjudications[0].id, "11");
    expect(resolved.issues).toHaveLength(0);
    const paid = payUsReadinessBill(resolved.state);
    expect(paid.issues).toHaveLength(0);
    expect(paid.state.players.US.resource_points).toBe(14);
  });

  it("calculates movement costs without inventing missing facts", () => {
    const state = freshState();
    expect(
      calculateMovementCost(state, {
        player_id: "US",
        force_ids: ["US-CONUS-10"],
        from_location_id: "CONUS",
        to_location_id: "INDOPACOM_PRC",
        timing: "proactive"
      }).cost
    ).toBe(5);
    expect(
      calculateMovementCost(state, {
        player_id: "US",
        force_ids: ["US-AFG-1"],
        from_location_id: "CENTCOM_AFGHANISTAN",
        to_location_id: "CENTCOM_IRAQ",
        timing: "proactive"
      }).cost
    ).toBe(0);
    expect(
      calculateMovementCost(state, {
        player_id: "RU",
        force_ids: ["RU-EUCOM-5-M2"],
        from_location_id: "EUCOM_RU",
        to_location_id: "CENTCOM_IRAN",
        timing: "proactive"
      }).cost
    ).toBe(1);
  });

  it("buys back readiness using location-specific printed costs", () => {
    const state = { ...freshState(), phase: "BlueInvestmentsAndActions" as const };
    const result = buyBackReadiness(state, ["US-CONUS-4"], 100);
    expect(result.cost).toBe(5);
    expect(result.state.forces["US-CONUS-4"].readiness_level).toBe(100);
    expect(result.state.players.US.resource_points).toBe(35);
  });

  it("does not allocate annual resources outside the annual allocation phase", () => {
    const state = freshState();
    const result = annualResourceAllocation(state, new SequenceDiceRoller([8]));
    expect(result.issues[0].message).toContain("Expected phase AnnualResourcesAllocation");
    expect(result.budgetRoll).toBeUndefined();
    expect(result.state).toBe(state);
    expect(result.state.players.US.resource_points).toBe(40);
  });
});

describe("combat resolution and card effects", () => {
  it("calculates combat factors with readiness and source rules", () => {
    const state = freshState();
    const us = calculateCombatFactors(state, "US", [
      { force_id: "US-CONUS-4", source: "in_theater" },
      { force_id: "US-PRC-1", source: "in_theater" }
    ]);
    expect(us.total).toBe(9);
    expect(us.breakdown.map((entry) => entry.final_cf)).toEqual([6, 3]);
    const prc = calculateCombatFactors(state, "PRC", [{ force_id: "PRC-INDO-5-M3", source: "in_theater" }]);
    expect(prc.total).toBe(11);
  });

  it("resolves RT B cards, records the die formula, applies effects, and pins committed forces", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const actionPhase = advanceBlueToActions(paid);
    expect(actionPhase.issues).toHaveLength(0);
    const result = resolveCard(
      actionPhase.state,
      {
        acting_player_id: "US",
        card_id: "US-ACT-01",
        blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
        red_commitments: [{ force_id: "PRC-INDO-5-M3", source: "in_theater" }],
        blue_players: ["US"],
        red_players: ["PRC"]
      },
      new SequenceDiceRoller([9])
    );
    expect(result.outcome).toBe("BmG");
    expect(result.roll?.formula).toBe("D10(9) = 9");
    expect(result.state.players.US.influence_points).toBe(51);
    expect(result.state.forces["US-PRC-1"].pinned.active).toBe(true);
  });

  it("resolves CRT A cards with best relevant Critical Capability modifier and reset rules", () => {
    const state = startRedPhase();
    const result = playRedSignaledCard(state, "RU", "RU-ACT-01", new SequenceDiceRoller([9]), {
      blue_commitments: [
        { force_id: "NATO-EUCOM-5", source: "in_theater" },
        { force_id: "US-EUCOM-1", source: "in_theater" }
      ],
      red_commitments: [
        { force_id: "RU-EUCOM-5-M2", source: "in_theater" },
        { force_id: "RU-EUCOM-4-M3", source: "in_theater" }
      ],
      blue_players: ["NATO_EU", "US"],
      red_players: ["RU"]
    });
    expect(result.roll?.modifier).toBe(-1);
    expect(result.outcome).toBe("BmG");
    expect(result.state.players.NATO_EU.influence_points).toBe(52);
    expect(result.state.forces["US-EUCOM-1"].readiness_level).toBe(100);
    expect(result.state.forces["NATO-EUCOM-5"].pinned.active).toBe(true);
    expect(result.state.forces["NATO-EUCOM-5"].reset_required).toBe(false);
    expect(result.state.pending_resets).toContainEqual(
      expect.objectContaining({ force_ids: ["NATO-EUCOM-5", "US-EUCOM-1", "RU-EUCOM-5-M2", "RU-EUCOM-4-M3"], outcome: "BmG" })
    );
    const afterSummary = recordStateOfWorldSummary(
      { ...result.state, phase: "StateOfWorldSummary" },
      "Pinned forces resolve reset."
    );
    expect(afterSummary.forces["US-EUCOM-1"].readiness_level).toBe(90);
    expect(afterSummary.forces["NATO-EUCOM-5"].reset_required).toBe(true);
  });

  it("tracks private outcomes in the ground-truth log", () => {
    const state = startRedPhase();
    const result = playRedSignaledCard(state, "DPRK", "DPRK-INV-01", new SequenceDiceRoller([5]));
    expect(result.state.players.DPRK.critical_capabilities.NUCLEAR).toBe(1);
    expect(result.state.ground_truth.some((item) => item.visible_to.includes("DPRK") && !item.visible_to.includes("Public"))).toBe(true);
  });

  it("filters private logs and rolls by viewer", () => {
    const state = startRedPhase();
    const result = playRedSignaledCard(state, "RU", "RU-ACT-02", new SequenceDiceRoller([5]));
    const privateLog = result.state.event_log.find((entry) => entry.visibility === "private_to_player_and_white_cell");
    const privateRoll = result.state.rolls.find((roll) => roll.visibility === "private_to_player_and_white_cell");
    expect(privateLog).toBeDefined();
    expect(privateRoll).toBeDefined();
    expect(canViewLog(privateLog!, "Public")).toBe(false);
    expect(canViewLog(privateLog!, "US")).toBe(false);
    expect(canViewLog(privateLog!, "RU")).toBe(true);
    expect(canViewLog(privateLog!, "WhiteCell")).toBe(true);
    expect(canViewRoll(privateRoll!, result.state, "Public")).toBe(false);
    expect(canViewRoll(privateRoll!, result.state, "US")).toBe(false);
    expect(canViewRoll(privateRoll!, result.state, "RU")).toBe(true);
    expect(canViewRoll(privateRoll!, result.state, "WhiteCell")).toBe(true);
  });

  it("requests White Cell adjudication for Blue free play and White Cell cards", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const requested = requestBlueFreePlayAdjudication(paid, "US", "Build a base with partner access.");
    expect(requested.state.pending_adjudications.at(-1)?.reason).toContain("Blue free-play action");
    const actionPhase = advanceBlueToActions(paid).state;
    const card = resolveCard(actionPhase, { acting_player_id: "US", card_id: "US-ACT-02" }, new SequenceDiceRoller([5]));
    expect(card.adjudications.length).toBeGreaterThan(0);
  });

  it("allows zero-cost White Cell event injection during the Blue turn", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const result = injectWhiteCellEvent(paid, "INT-EVT-01", "Regression test event.", new SequenceDiceRoller([5]));
    expect(result.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(result.state.players.US.resource_points).toBe(14);
    expect(result.state.players.PRC.resource_points).toBe(14);
    expect(result.state.event_log.some((entry) => entry.message.includes("White Cell injected event INT-EVT-01"))).toBe(true);
  });

  it("pauses for adjudication when a card D10 table has no matching outcome row", () => {
    const state = startRedPhase();
    const gapState: GameState = {
      ...state,
      cards: {
        ...state.cards,
        "DPRK-ACT-01": {
          ...state.cards["DPRK-ACT-01"],
          resolution: {
            ...state.cards["DPRK-ACT-01"].resolution,
            outcome_map: [
              {
                roll_min: 0,
                roll_max: 3,
                label: "Fail",
                effects: [
                  {
                    type: "adjust_influence_points",
                    target: "DPRK",
                    value: -1,
                    timing: "immediate",
                    visibility: "public",
                    requires_adjudication: false
                  }
                ]
              }
            ]
          }
        }
      }
    };
    const result = resolveCard(gapState, { acting_player_id: "DPRK", card_id: "DPRK-ACT-01" }, new SequenceDiceRoller([9]));
    expect(result.issues[0].message).toContain("no card-defined outcome row");
    expect(result.adjudications.length).toBeGreaterThan(0);
    expect(result.state.players.DPRK.influence_points).toBe(5);
  });

  it("blocks Critical Capability upgrades that exceed National Tech Level", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const firstUpgrade = resolveCard(paid, { acting_player_id: "US", card_id: "US-INV-01" }, new SequenceDiceRoller([5]));
    expect(firstUpgrade.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(firstUpgrade.state.players.US.critical_capabilities.C4ISR).toBe(4);

    const blockedUpgrade = resolveCard(firstUpgrade.state, { acting_player_id: "US", card_id: "US-INV-01" }, new SequenceDiceRoller([5]));
    expect(blockedUpgrade.issues[0].message).toContain("exceeds National Tech Level");
    expect(blockedUpgrade.adjudications.length).toBeGreaterThan(0);
    expect(blockedUpgrade.state.players.US.critical_capabilities.C4ISR).toBe(4);
    expect(validateState(blockedUpgrade.state).filter((issue) => issue.severity === "error")).toHaveLength(0);
  });

  it("resolves folder cards with deterministic effects, future effects, and frequency limits", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const actionPhase = advanceBlueToActions(paid).state;

    const ukraineSupport = resolveCard(actionPhase, { acting_player_id: "US", card_id: "BLUE-01" }, new SequenceDiceRoller([5]));
    expect(ukraineSupport.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(ukraineSupport.state.players.US.resource_points).toBe(14);
    expect(ukraineSupport.state.ground_truth).toContainEqual(
      expect.objectContaining({
        source: "BLUE-01",
        status: "pending",
        trigger_turn: 2
      })
    );
    const nextTurn = recordStateOfWorldSummary(
      { ...ukraineSupport.state, phase: "StateOfWorldSummary" },
      "Ukraine support takes effect."
    );
    expect(nextTurn.scenario_flags.RU_UKRAINE_LOSS_CHANCE_MODIFIER).toBe(1);
    expect(nextTurn.ground_truth.find((item) => item.source === "BLUE-01")?.status).toBe("resolved");

    const missileTest = resolveCard(actionPhase, { acting_player_id: "US", card_id: "US-10" }, new SequenceDiceRoller([3]));
    expect(missileTest.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(missileTest.state.players.RU.influence_points).toBe(13);
    expect(missileTest.state.players.PRC.influence_points).toBe(38);
    const repeatedMissileTest = resolveCard(missileTest.state, { acting_player_id: "US", card_id: "US-10" }, new SequenceDiceRoller([3]));
    expect(repeatedMissileTest.issues[0].message).toContain("once per game");

    const sanctions = resolveCard(actionPhase, { acting_player_id: "US", card_id: "US-11" }, new SequenceDiceRoller([5]));
    expect(sanctions.state.players.IR.influence_points).toBe(6);
    expect(sanctions.state.players.US.influence_points).toBe(48);
    expect(sanctions.state.scenario_flags.IR_JCPOA_BLOCKED).toBe(true);

    const infrastructureAttack = resolveCard(actionPhase, { acting_player_id: "US", card_id: "UAC-1" }, new SequenceDiceRoller([1]));
    expect(infrastructureAttack.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(infrastructureAttack.state.players.US.influence_points).toBe(51);
    expect(infrastructureAttack.adjudications.length).toBeGreaterThan(0);
  });

  it("supports Red folder cards that use RT B, ransomware tables, and card-defined limits", () => {
    const state = startRedPhase();
    const humanWaves = resolveCard(
      state,
      {
        acting_player_id: "RU",
        card_id: "RU-29",
        blue_commitments: [{ force_id: "NATO-EUCOM-5", source: "in_theater" }],
        red_commitments: [{ force_id: "RU-EUCOM-5-M2", source: "in_theater" }],
        blue_players: ["NATO_EU"],
        red_players: ["RU"]
      },
      new SequenceDiceRoller([9])
    );
    expect(humanWaves.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(humanWaves.outcome).toBe("BmG");
    expect(humanWaves.state.players.RU.influence_points).toBe(14);
    expect(humanWaves.state.forces["RU-HUMAN-WAVES-1"]).toMatchObject({
      owner: "RU",
      force_factors: 1,
      modernization_level: 1
    });

    const ransomware = resolveCard(state, { acting_player_id: "DPRK", card_id: "DPRK-30" }, new SequenceDiceRoller([4]));
    expect(ransomware.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(ransomware.state.players.DPRK.influence_points).toBe(6);
    expect(ransomware.adjudications.length).toBeGreaterThan(0);
    const repeatedRansomware = resolveCard(ransomware.state, { acting_player_id: "DPRK", card_id: "DPRK-30" }, new SequenceDiceRoller([4]));
    expect(repeatedRansomware.issues[0].message).toContain("once per two turns");

    const malware = resolveCard(state, { acting_player_id: "DPRK", card_id: "DPRK-31" }, new SequenceDiceRoller([4]));
    expect(malware.state.scenario_flags.DPRK_NEXT_RANSOMWARE_MODIFIER).toBe(2);
  });

  it("injects folder event cards and applies supported event effects", () => {
    const state = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const natoEvent = injectWhiteCellEvent(state, "EVT-NATO-18", "Nordic accession.", new SequenceDiceRoller([5]));
    expect(natoEvent.issues.filter((issue) => issue.severity === "error")).toHaveLength(0);
    expect(natoEvent.state.players.NATO_EU.influence_points).toBe(51);
    expect(natoEvent.state.players.NATO_EU.resource_points).toBe(11);
    expect(natoEvent.state.forces["NATO-NORDIC-1-M2"]).toMatchObject({
      owner: "NATO_EU",
      force_factors: 1,
      modernization_level: 2
    });

    const coup = injectWhiteCellEvent(state, "EVT-IR-11", "Coup.", new SequenceDiceRoller([5]));
    expect(coup.state.players.IR.resource_points).toBe(6);
    expect(coup.state.scenario_flags.IR_NO_ABROAD_ACTIONS_THIS_TURN).toBe(true);

    const regionalEvent = injectWhiteCellEvent(state, "EVT-CON-41", "Regional conflict.", new SequenceDiceRoller([5]));
    expect(regionalEvent.state.proxy_forces["ISRAEL-PROXY"]).toMatchObject({ sponsor: "US", force_factors: 2 });
    expect(regionalEvent.state.proxy_forces["HAMAS-PROXY"]).toMatchObject({ sponsor: "IR", force_factors: 1 });
    expect(regionalEvent.adjudications.length).toBeGreaterThan(0);
  });
});

describe("force development, proxies, reset, and annual allocation", () => {
  it("procures, modernizes, and retires forces through dedicated commands", () => {
    const blueState = { ...freshState(), phase: "BlueInvestmentsAndActions" as const };
    const procured = procureForces(blueState, {
      player_id: "US",
      force_factors: 1,
      modernization_level: 3,
      location_id: "CONUS",
      home_base_id: "CONUS",
      readiness_level: 90,
      id: "US-NEW-1"
    });
    expect(procured.cost).toBe(4);
    expect(procured.state.players.US.resource_points).toBe(36);
    expect(procured.state.forces["US-NEW-1"].procured_turn).toBe(1);
    expect(procured.state.forces["US-NEW-1"].readiness_level).toBe(90);
    const sameTurnModernize = modernizeForces(procured.state, {
      player_id: "US",
      force_ids: ["US-NEW-1"],
      target_modernization_level: 4
    });
    expect(sameTurnModernize.issues[0].message).toContain("same turn");

    const modernized = modernizeForces(freshState(), {
      player_id: "RU",
      force_ids: ["RU-EUCOM-5-M2"],
      target_modernization_level: 3
    });
    expect(modernized.cost).toBe(5);
    expect(modernized.state.forces["RU-EUCOM-5-M2"].modernization_level).toBe(3);

    const retired = retireUsForces(blueState, ["US-CONUS-4"]);
    expect(retired.state.forces["US-CONUS-4"]).toBeUndefined();
  });

  it("resolves proxy participation and proxy development consequences", () => {
    const participation = resolveProxyParticipation(freshState(), "IR-PROXY-01", "Medium", new SequenceDiceRoller([4]));
    expect(participation.outcome).toBe("Success");
    expect(participation.roll?.formula).toBe("D10(4) = 4");
    const development = developProxyForce(
      freshState(),
      {
        sponsor_id: "IR",
        proxy_id: "IR-PROXY-01",
        intended_ffs: 2,
        intended_mod_level: 2,
        sponsor_cost_share: 0.5,
        reliability: "Low"
      },
      new SequenceDiceRoller([0])
    );
    expect(development.delivered_ffs).toBe(1);
    expect(development.state.players.IR.resource_points).toBe(5);
  });

  it("requires Red players to pay to restore reset forces", () => {
    const state = startRedPhase();
    const resetState = {
      ...state,
      forces: {
        ...state.forces,
        "RU-EUCOM-5-M2": { ...state.forces["RU-EUCOM-5-M2"], reset_required: true }
      }
    };
    const result = restoreResetRedForces(resetState, "RU", ["RU-EUCOM-5-M2"]);
    expect(result.cost).toBe(5);
    expect(result.state.players.RU.resource_points).toBe(10);
    expect(result.state.forces["RU-EUCOM-5-M2"].reset_required).toBe(false);
  });

  it("rolls annual resources with inline formula and advances to summary", () => {
    const state = { ...freshState(), phase: "AnnualResourcesAllocation" as const };
    const result = annualResourceAllocation(state, new SequenceDiceRoller([8]));
    expect(result.budgetRoll?.formula).toBe("D10(8) = 8");
    expect(result.state.players.US.resource_points).toBe(71);
    expect(result.state.players.NATO_EU.resource_points).toBe(15);
    expect(result.state.phase).toBe("StateOfWorldSummary");
  });
});
