import {
  getCrtAOutcome,
  getRtBOutcome,
  type Card as GameCardData,
  type CtrAColumn,
  type GameState,
  type OutcomeRow,
  type RtBColumn,
} from "../engine";
import { Modal, Tag } from "./ui";
import { playerLabel, sideToTone } from "./factions";
import type { FactionTone } from "./factions";

interface CardModalProps {
  card?: GameCardData;
  state: GameState;
  open: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}

function toneForCardOwner(card: GameCardData, state: GameState): FactionTone {
  if (!card.owner) return "neutral";
  if (card.owner === "WhiteCell") return "white";
  return sideToTone(state.players[card.owner]?.side);
}

const OUTCOME_LABELS: Record<string, string> = {
  RMG: "Red Major Gain",
  RmG: "Red minor gain",
  SQ: "Status Quo",
  BmG: "Blue minor gain",
  BMG: "Blue Major Gain",
  Success: "Success",
  Fail: "Fail"
};

function outcomeLabel(value: string | null): string {
  if (!value) return "—";
  return OUTCOME_LABELS[value] ?? value;
}

const CRT_A_COLUMNS: CtrAColumn[] = ["Red >=4:1", "Red 3:1", "Red 2:1", "1:1", "Blue 2:1", "Blue 3:1", "Blue >=4:1"];
const RT_B_COLUMNS: RtBColumn[] = ["Red Advantage", "Parity", "Blue Advantage"];

function rollRangeLabel(min?: number, max?: number): string {
  if (min === undefined || max === undefined) return "Fixed";
  if (min === max) return String(min);
  return `${min}-${max}`;
}

function fixedModifierForCard(card: GameCardData): number {
  return card.resolution.modifiers.reduce((sum, modifier) => sum + (modifier.value ?? 0), 0);
}

function compactRollFaces(faces: number[]): string {
  const sorted = [...faces].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (const face of sorted.slice(1)) {
    if (face === end + 1) {
      end = face;
      continue;
    }
    ranges.push(rollRangeLabel(start, end));
    start = face;
    end = face;
  }

  ranges.push(rollRangeLabel(start, end));
  return ranges.join(", ");
}

function outcomeRollDetails(card: GameCardData, row: OutcomeRow): Array<{ label: string; range: string }> {
  if (!row.outcome) return [];
  const modifier = fixedModifierForCard(card);
  const naturalRolls = Array.from({ length: 10 }, (_, index) => index + 1);

  if (card.resolution.table_reference === "RT_B") {
    return RT_B_COLUMNS.flatMap((column) => {
      const faces = naturalRolls.filter((face) => getRtBOutcome(face + modifier, column) === row.outcome);
      return faces.length > 0 ? [{ label: shortColumnLabel(column), range: compactRollFaces(faces) }] : [];
    });
  }

  if (card.resolution.table_reference === "CRT_A") {
    return CRT_A_COLUMNS.flatMap((column) => {
      const faces = naturalRolls.filter((face) => getCrtAOutcome(face + modifier, column) === row.outcome);
      return faces.length > 0 ? [{ label: shortColumnLabel(column), range: compactRollFaces(faces) }] : [];
    });
  }

  return [];
}

function shortColumnLabel(column: CtrAColumn | RtBColumn): string {
  return column
    .replace(" Advantage", " adv")
    .replace("Blue ", "Blue ")
    .replace("Red ", "Red ");
}

export function CardModal({ card, state, open, onClose, footer }: CardModalProps) {
  if (!card) return null;
  const tone = toneForCardOwner(card, state);
  const cost = card.cost.resource_points;
  const costLabel = cost === null ? "Free" : typeof cost === "number" ? `${cost} RP` : "Variable";
  return (
    <Modal open={open} onClose={onClose} title={`${card.id} · ${card.title}`} footer={footer} size="lg">
      <div className="stack-md">
        <div className="row gap-sm">
          <Tag tone={tone}>{card.type}</Tag>
          {card.subtype ? <Tag>{card.subtype}</Tag> : null}
          {card.aor ? <Tag>{card.aor}</Tag> : null}
          <Tag tone="neutral">Cost · {costLabel}</Tag>
        </div>

        <p style={{ lineHeight: 1.55, color: "var(--text-primary)" }}>{card.description}</p>

        {card.play_constraints.frequency ? (
          <div className="stack">
            <span className="section__title section__title--muted">Play frequency</span>
            <p className="muted" style={{ fontSize: "0.85rem" }}>{card.play_constraints.frequency}</p>
          </div>
        ) : null}

        {card.resolution.outcome_map.length > 0 ? (
          <div className="stack">
            <span className="section__title section__title--muted">Possible Outcomes</span>
            <div className="outcome-list">
              {card.resolution.outcome_map.map((row, idx) => {
                const label = row.label ?? outcomeLabel(row.outcome);
                const rollDetails = outcomeRollDetails(card, row);
                const hasExplicitRange = row.roll_min !== undefined && row.roll_max !== undefined;
                const rollLabel = hasExplicitRange ? rollRangeLabel(row.roll_min ?? undefined, row.roll_max ?? undefined) : rollDetails.length > 0 ? "Table" : "Fixed";
                return (
                  <div key={idx} className="outcome-item">
                    <div className="outcome-item__roll" aria-label={`D10 roll ${rollLabel}`}>
                      <span className="outcome-item__roll-label">D10</span>
                      <span className="outcome-item__roll-value">{rollLabel}</span>
                    </div>
                    <div className="outcome-item__body">
                      <span className="outcome-item__title">{label}</span>
                      <span className="outcome-item__effect">
                        {row.narrative ?? (row.effects.map(describeEffect).filter(Boolean).join("; ") || "No mechanical effect.")}
                      </span>
                      {rollDetails.length > 0 ? (
                        <span className="outcome-item__ranges" aria-label="Natural D10 roll ranges by table column">
                          {rollDetails.map((detail) => (
                            <span key={`${detail.label}-${detail.range}`} className="outcome-item__range">
                              <span className="outcome-item__range-label">{detail.label}</span>
                              <span className="outcome-item__range-value">{detail.range}</span>
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {card.players_involved.length > 0 ? (
          <div className="stack">
            <span className="section__title section__title--muted">Players Involved</span>
            <div className="row gap-sm">
              {card.players_involved.map((id) => (
                <Tag key={id} tone={sideToTone(state.players[id]?.side)}>
                  {playerLabel(state, id)}
                </Tag>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function describeEffect(effect: { type: string; target: string; value?: unknown }): string {
  const target = effect.target;
  switch (effect.type) {
    case "adjust_influence_points": {
      const v = typeof effect.value === "number" ? effect.value : 0;
      if (v === 0) return "";
      return `${target} influence ${v > 0 ? `+${v}` : v}`;
    }
    case "adjust_resource_points": {
      const v = typeof effect.value === "number" ? effect.value : 0;
      if (v === 0) return "";
      return `${target} resources ${v > 0 ? `+${v}` : v}`;
    }
    case "adjust_critical_capability_mod_level":
      if (effect.value && typeof effect.value === "object" && !Array.isArray(effect.value)) {
        const v = effect.value as { capability?: string; amount?: number };
        if (v.amount && v.capability) return `${target} ${v.capability} ${v.amount > 0 ? `+${v.amount}` : v.amount}`;
      }
      return `${target} capability adjusted`;
    case "set_or_adjust_per_turn_resource_allocation":
      return `${target} per-turn resources adjusted`;
    case "pin_forces":
      return `${target} forces pinned`;
    case "unpin_forces":
      return `${target} forces released`;
    case "reset_forces":
      return `${target} forces reset to home base`;
    case "create_scenario_flag":
      return `New status: ${target}`;
    case "adjust_scenario_flag_number":
      return `${target} status shifted`;
    case "procure_forces":
      return `New forces procured for ${target}`;
    default:
      return "";
  }
}
