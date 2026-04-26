import { describe, expect, it } from "vitest";
import defaultScenario from "../src/data/defaultScenario.json";
import {
  SequenceDiceRoller,
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
  const red = beginRedInvestmentsAndActions(paid.state, ["RU", "PRC", "DPRK", "IR"]);
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
    const result = resolveCard(
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
    expect(result.state.forces["US-EUCOM-1"].readiness_level).toBe(90);
    expect(result.state.forces["NATO-EUCOM-5"].reset_required).toBe(true);
  });

  it("tracks private outcomes in the ground-truth log", () => {
    const state = startRedPhase();
    const result = playRedSignaledCard(state, "DPRK", "DPRK-INV-01", new SequenceDiceRoller([5]));
    expect(result.state.players.DPRK.critical_capabilities.NUCLEAR).toBe(1);
    expect(result.state.ground_truth.some((item) => item.visible_to.includes("DPRK") && !item.visible_to.includes("Public"))).toBe(true);
  });

  it("requests White Cell adjudication for Blue free play and White Cell cards", () => {
    const paid = payUsReadinessBill(startTurnThroughBlueReadiness()).state;
    const requested = requestBlueFreePlayAdjudication(paid, "US", "Build a base with partner access.");
    expect(requested.state.pending_adjudications.at(-1)?.reason).toContain("Blue free-play action");
    const card = resolveCard(paid, { acting_player_id: "US", card_id: "US-ACT-02" }, new SequenceDiceRoller([5]));
    expect(card.adjudications.length).toBeGreaterThan(0);
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
    expect(result.budgetRoll.formula).toBe("D10(8) = 8");
    expect(result.state.players.US.resource_points).toBe(71);
    expect(result.state.players.NATO_EU.resource_points).toBe(15);
    expect(result.state.phase).toBe("StateOfWorldSummary");
  });
});
