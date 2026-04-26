import type { GameState, PlayerId, RollRecord } from "../engine";

export interface ScalarChange {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  scope: PlayerId | "force" | "global";
  scopeLabel: string;
}

export interface FlagChange {
  key: string;
  label: string;
  before: unknown;
  after: unknown;
}

export interface StateDiff {
  scalars: ScalarChange[];
  flags: FlagChange[];
  newRolls: RollRecord[];
  newLogIds: string[];
  affectedPlayers: PlayerId[];
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function snapshotPlayers(state: GameState) {
  const snap: Record<string, { rp: number; ip: number; ntl: number; perTurn: number; capabilities: Record<string, number> }> = {};
  for (const [id, player] of Object.entries(state.players)) {
    snap[id] = {
      rp: player.resource_points,
      ip: player.influence_points,
      ntl: player.national_tech_level,
      perTurn: state.per_turn_resources[id] ?? 0,
      capabilities: { ...player.critical_capabilities }
    };
  }
  return snap;
}

export function snapshotForces(state: GameState) {
  const snap: Record<string, { readiness: number; location: string; pinned: boolean; modLevel: number; ffs: number; reset: boolean }> = {};
  for (const [id, force] of Object.entries(state.forces)) {
    snap[id] = {
      readiness: force.readiness_level ?? 100,
      location: force.location_id,
      pinned: force.pinned.active,
      modLevel: force.modernization_level,
      ffs: force.force_factors,
      reset: force.reset_required
    };
  }
  return snap;
}

export interface Snapshot {
  players: ReturnType<typeof snapshotPlayers>;
  forces: ReturnType<typeof snapshotForces>;
  flags: Record<string, unknown>;
  logLength: number;
  rollIds: Set<string>;
}

export function takeSnapshot(state: GameState): Snapshot {
  return {
    players: snapshotPlayers(state),
    forces: snapshotForces(state),
    flags: { ...state.scenario_flags },
    logLength: state.event_log.length,
    rollIds: new Set(state.rolls.map((roll) => roll.id))
  };
}

export function diffStates(before: Snapshot, after: GameState): StateDiff {
  const scalars: ScalarChange[] = [];
  const flags: FlagChange[] = [];
  const affected = new Set<PlayerId>();

  for (const [id, player] of Object.entries(after.players)) {
    const previous = before.players[id];
    const label = player.label;
    const checks: { key: string; label: string; before: number; after: number }[] = [];
    if (previous) {
      checks.push({ key: `rp:${id}`, label: "Resource Points", before: previous.rp, after: player.resource_points });
      checks.push({ key: `ip:${id}`, label: "Influence Points", before: previous.ip, after: player.influence_points });
      checks.push({ key: `ntl:${id}`, label: "National Tech Level", before: previous.ntl, after: player.national_tech_level });
      checks.push({
        key: `pt:${id}`,
        label: "Per-Turn RP",
        before: previous.perTurn,
        after: after.per_turn_resources[id] ?? 0
      });
      const capKeys = new Set([...Object.keys(previous.capabilities), ...Object.keys(player.critical_capabilities)]);
      for (const cap of capKeys) {
        const beforeVal = previous.capabilities[cap] ?? 0;
        const afterVal = player.critical_capabilities[cap] ?? 0;
        if (beforeVal !== afterVal) {
          checks.push({ key: `cc:${id}:${cap}`, label: `${cap} Mod Level`, before: beforeVal, after: afterVal });
        }
      }
    }
    for (const check of checks) {
      if (check.before !== check.after) {
        scalars.push({ ...check, delta: check.after - check.before, scope: id, scopeLabel: label });
        affected.add(id);
      }
    }
  }

  for (const [id, force] of Object.entries(after.forces)) {
    const previous = before.forces[id];
    if (!previous) {
      scalars.push({
        key: `force-new:${id}`,
        label: `${id} created`,
        before: 0,
        after: force.force_factors,
        delta: force.force_factors,
        scope: "force",
        scopeLabel: id
      });
      affected.add(force.owner);
      continue;
    }
    if (previous.readiness !== (force.readiness_level ?? 100)) {
      scalars.push({
        key: `readiness:${id}`,
        label: `${id} Readiness`,
        before: previous.readiness,
        after: force.readiness_level ?? 100,
        delta: (force.readiness_level ?? 100) - previous.readiness,
        scope: "force",
        scopeLabel: id
      });
      affected.add(force.owner);
    }
    if (previous.location !== force.location_id) {
      scalars.push({
        key: `loc:${id}`,
        label: `${id} relocated`,
        before: 0,
        after: 0,
        delta: 0,
        scope: "force",
        scopeLabel: `${id}: ${previous.location} → ${force.location_id}`
      });
    }
    if (previous.pinned !== force.pinned.active) {
      scalars.push({
        key: `pin:${id}`,
        label: force.pinned.active ? `${id} pinned` : `${id} unpinned`,
        before: 0,
        after: 0,
        delta: 0,
        scope: "force",
        scopeLabel: id
      });
    }
    if (previous.reset !== force.reset_required) {
      scalars.push({
        key: `reset:${id}`,
        label: force.reset_required ? `${id} reset required` : `${id} reset cleared`,
        before: 0,
        after: 0,
        delta: 0,
        scope: "force",
        scopeLabel: id
      });
    }
  }

  for (const id of Object.keys(before.forces)) {
    if (!after.forces[id]) {
      scalars.push({
        key: `force-removed:${id}`,
        label: `${id} retired`,
        before: 0,
        after: 0,
        delta: 0,
        scope: "force",
        scopeLabel: id
      });
    }
  }

  const flagKeys = new Set([...Object.keys(before.flags), ...Object.keys(after.scenario_flags)]);
  for (const key of flagKeys) {
    const beforeVal = before.flags[key];
    const afterVal = after.scenario_flags[key];
    if (beforeVal === undefined && afterVal === undefined) continue;
    const equal = JSON.stringify(beforeVal) === JSON.stringify(afterVal);
    if (!equal) {
      const beforeNum = asNumber(beforeVal, NaN);
      const afterNum = asNumber(afterVal, NaN);
      if (Number.isFinite(beforeNum) && Number.isFinite(afterNum)) {
        scalars.push({
          key: `flag:${key}`,
          label: key,
          before: beforeNum,
          after: afterNum,
          delta: afterNum - beforeNum,
          scope: "global",
          scopeLabel: "Scenario flag"
        });
      } else {
        flags.push({ key, label: key, before: beforeVal, after: afterVal });
      }
    }
  }

  const newRolls = after.rolls.filter((roll) => !before.rollIds.has(roll.id));
  const newLogIds = after.event_log.slice(before.logLength).map((entry) => entry.id);

  return {
    scalars,
    flags,
    newRolls,
    newLogIds,
    affectedPlayers: Array.from(affected)
  };
}
