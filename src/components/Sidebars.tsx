import { useMemo } from "react";
import type { ReactNode } from "react";
import { entryValue, entryValues, type CriticalCapabilityLevel, type ForceCounter, type GameState, type PlayerId } from "../engine";
import { EmptyState, Section, Tag } from "./ui";
// Section is still used by CurrentTaskPanel and RedSignalDeckTrigger consumers; keep import.

interface CurrentTaskPanelProps {
  phaseLabel: string;
  subPhase?: string;
  task: string;
  why: string;
  advance?: ReactNode;
}

export function CurrentTaskPanel({ phaseLabel, subPhase, task, why, advance }: CurrentTaskPanelProps) {
  return (
    <Section title="Current Task" tone="blue">
      <div className="task-panel">
        <div className="task-panel__phase">{phaseLabel}</div>
        {subPhase ? <div className="task-panel__sub">{subPhase}</div> : null}
        <div className="task-panel__action">{task}</div>
        <div className="task-panel__why">{why}</div>
        {advance ? <div className="task-panel__advance">{advance}</div> : null}
      </div>
    </Section>
  );
}

interface StatPanelProps {
  state: GameState;
  visiblePlayers?: PlayerId[];
  onOpenBlueDeck?: () => void;
}

export function StatPanel({ state, visiblePlayers, onOpenBlueDeck }: StatPanelProps) {
  const players = useMemo(() => entryValues(state.players), [state.players]);
  const red = players.filter((p) => p.side === "Red");
  const usPlayer = entryValue(state.players, "US") ?? players.find((player) => player.side === "Blue");
  const usForces = useMemo(
    () => entryValues(state.forces).filter((force) => force.owner === usPlayer?.id),
    [state.forces, usPlayer?.id]
  );
  const totalForceFactors = usForces.reduce((sum, force) => sum + force.force_factors, 0);
  const totalRedIP = red.reduce((sum, p) => sum + p.influence_points, 0);
  const activeForces = usForces.filter((force) => force.pinned.active || force.reset_required);

  if (!usPlayer || (visiblePlayers && !visiblePlayers.includes(usPlayer.id))) {
    return (
      <div className="stat-panel">
        <EmptyState>No U.S. player stats are currently visible.</EmptyState>
      </div>
    );
  }

  return (
    <div className="stat-panel">
      <div className="us-stat-card">
        <div className="us-stat-card__head">
          <span className="player-row__chip player-row__chip--blue">{shortCode(usPlayer.id)}</span>
          <div>
            <div className="player-row__label">{usPlayer.label}</div>
            <div className="player-row__sub">Victory metric: Influence Points</div>
          </div>
        </div>
        {onOpenBlueDeck ? (
          <button type="button" className="signal-deck-trigger signal-deck-trigger--blue" onClick={onOpenBlueDeck}>
            <span className="signal-deck-trigger__count">{state.blue_subphase === "Actions" ? "A" : "I"}</span>
            <span className="signal-deck-trigger__label">Show current deck</span>
            <Tag tone="blue">VIEW</Tag>
          </button>
        ) : null}

        <div className="stat-grid stat-grid--compact">
          <StatCell label="Resource Points" value={usPlayer.resource_points} sub="Budget pool" />
          <StatCell label="Influence Points" value={usPlayer.influence_points} sub={`Red total ${totalRedIP}`} />
          <StatCell label="Force Factors" value={totalForceFactors} sub={`${usForces.length} counters`} />
          <StatCell label="National Tech Level" value={`NTL ${usPlayer.national_tech_level}`} sub="Modernization cap" />
        </div>

        <StatGroup title="Force Modernization Levels" items={summarizeModernization(usForces)} />
        <StatGroup title="Critical Capability Modernization Levels" items={summarizeCapabilities(usPlayer.critical_capabilities)} />
        <StatGroup title="Readiness Levels" items={summarizeReadiness(usForces)} />
        <StatGroup title="Force Posture and Deployment Locations" items={summarizePosture(usForces, state)} />
        <StatGroup title="Active Operations and Committed Forces" items={summarizeActiveForces(activeForces, state)} />
      </div>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string | number; sub: string }) {
  return (
    <div className="stat-cell">
      <div className="stat-cell__label">{label}</div>
      <div className="stat-cell__value">{value}</div>
      <div className="stat-cell__sub">{sub}</div>
    </div>
  );
}

function StatGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="us-stat-group">
      <h3 className="us-stat-group__title">{title}</h3>
      {items.length > 0 ? (
        <ul className="us-stat-list">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <div className="us-stat-list__empty">None reported</div>
      )}
    </section>
  );
}

function shortCode(id: string): string {
  if (id === "NATO_EU") return "NA";
  if (id === "DPRK") return "DK";
  if (id === "PRC") return "CN";
  if (id === "WhiteCell") return "WC";
  return id.slice(0, 2).toUpperCase();
}

function summarizeModernization(forces: ForceCounter[]): string[] {
  return summarizeByNumber(forces, (force) => force.modernization_level, (level, ffs) => `M${level}: ${ffs} FF`);
}

function summarizeReadiness(forces: ForceCounter[]): string[] {
  return summarizeByNumber(forces, (force) => force.readiness_level ?? 100, (level, ffs) => `${level}%: ${ffs} FF`);
}

function summarizeCapabilities(capabilities: CriticalCapabilityLevel[]): string[] {
  return [...capabilities]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((capability) => `${capabilityLabel(capability.id)}: M${capability.value}`);
}

function summarizePosture(forces: ForceCounter[], state: GameState): string[] {
  const totals = new Map<string, number>();
  for (const force of forces) {
    const location = entryValue(state.locations, force.location_id);
    const label = force.location_id === "CONUS"
      ? "USNORTHCOM/CONUS"
      : `${location?.label ?? force.location_id}`;
    const postureLabel = force.location_id === "CONUS" ? label : `${label} (forward)`;
    totals.set(postureLabel, (totals.get(postureLabel) ?? 0) + force.force_factors);
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, ffs]) => `${label}: ${ffs} FF`);
}

function summarizeActiveForces(forces: ForceCounter[], state: GameState): string[] {
  return forces.map((force) => {
    const location = entryValue(state.locations, force.location_id)?.label ?? force.location_id;
    const statuses = [
      force.pinned.active ? "committed/pinned" : "",
      force.reset_required ? "reset required" : ""
    ].filter(Boolean).join(", ");
    return `${force.id}: ${force.force_factors} FF at ${location} (${statuses})`;
  });
}

function summarizeByNumber(forces: ForceCounter[], valueFor: (force: ForceCounter) => number, labelFor: (value: number, ffs: number) => string): string[] {
  const totals = new Map<number, number>();
  for (const force of forces) {
    const value = valueFor(force);
    totals.set(value, (totals.get(value) ?? 0) + force.force_factors);
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => b - a)
    .map(([value, ffs]) => labelFor(value, ffs));
}

function capabilityLabel(id: string): string {
  if (id === "IAMD_BMD") return "Integrated Air and Missile Defense";
  if (id === "C4ISR") return "C4ISR";
  if (id === "SOF") return "Special Operations Forces";
  if (id === "LRF") return "Long-Range Fires";
  return id.replaceAll("_", " ");
}

interface RedSignalDeckProps {
  state: GameState;
  count: number;
  onOpen: () => void;
}

export function RedSignalDeckTrigger({ count, onOpen }: RedSignalDeckProps) {
  return (
    <button type="button" className="signal-deck-trigger" onClick={onOpen} aria-label="View revealed Red signals">
      <span className="signal-deck-trigger__count">{count}</span>
      <span className="signal-deck-trigger__label">Revealed Red Signals</span>
      <Tag tone="red">VIEW</Tag>
    </button>
  );
}
