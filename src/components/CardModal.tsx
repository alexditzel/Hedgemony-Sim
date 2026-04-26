import type { Card as GameCardData, GameState } from "../engine";
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

function outcomeLabel(value?: string): string {
  if (!value) return "—";
  return OUTCOME_LABELS[value] ?? value;
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
            <div className="stack" style={{ gap: "0.3rem" }}>
              {card.resolution.outcome_map.map((row, idx) => {
                const label = row.label ?? outcomeLabel(row.outcome);
                return (
                  <div key={idx} className="signal-item">
                    <span className="signal-item__id">{label}</span>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {row.narrative ?? (row.effects.map(describeEffect).filter(Boolean).join("; ") || "No mechanical effect.")}
                    </span>
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
