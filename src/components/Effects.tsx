import type { Card as GameCardData, GameState, RollRecord } from "../engine";
import type { ScalarChange, StateDiff } from "./diff";
import { DiceResult } from "./Dice";
import { Tag } from "./ui";

interface EffectsSummaryProps {
  title: string;
  diff: StateDiff;
  state: GameState;
  card?: GameCardData;
  outcome?: string;
  rolls?: RollRecord[];
  narrative?: string;
}

export function EffectsSummary({ title, diff, state, card, outcome, rolls = [], narrative }: EffectsSummaryProps) {
  const players = diff.affectedPlayers
    .map((id) => state.players[id]?.label ?? id)
    .filter((value, index, list) => list.indexOf(value) === index);

  const hasContent = diff.scalars.length > 0 || diff.flags.length > 0 || rolls.length > 0;

  return (
    <div className="effects fade-in">
      <div className="row row--between" style={{ alignItems: "flex-start" }}>
        <div className="row gap-sm" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
          <span className="effects__title">{title}</span>
          {card ? <Tag>{card.id}</Tag> : null}
          {outcome ? <Tag tone="green">Outcome · {outcome}</Tag> : null}
        </div>
        {players.length > 0 ? (
          <div className="row gap-sm">
            {players.map((label) => (
              <Tag key={label}>{label}</Tag>
            ))}
          </div>
        ) : null}
      </div>

      {narrative ? <p className="effects__narrative">{narrative}</p> : null}

      {rolls.length > 0 ? (
        <div className="row gap-md">
          {rolls.map((roll) => (
            <DiceResult key={roll.id} roll={roll} inline />
          ))}
        </div>
      ) : null}

      {diff.scalars.length > 0 ? (
        <div className="effects__grid">
          {diff.scalars.map((change) => (
            <EffectRow key={change.key} change={change} />
          ))}
        </div>
      ) : null}

      {diff.flags.length > 0 ? (
        <div className="stack">
          {diff.flags.map((flag) => (
            <div key={flag.key} className="effect-row">
              <span className="effect-row__label">{flag.label}</span>
              <span className="effect-row__delta effect-row__delta--neutral">SET</span>
              <span className="effect-row__values">
                <span className="from">{describeValue(flag.before)}</span>
                <span className="arrow">→</span>
                <span>{describeValue(flag.after)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {!hasContent ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          No measurable change to public state. Effects may be tracked privately by the White Cell.
        </p>
      ) : null}
    </div>
  );
}

function EffectRow({ change }: { change: ScalarChange }) {
  const sign = change.delta > 0 ? "+" : change.delta < 0 ? "" : "";
  const direction = change.delta > 0 ? "up" : change.delta < 0 ? "down" : "neutral";
  const showNumeric = change.before !== change.after && (change.before !== 0 || change.after !== 0);
  return (
    <div className="effect-row">
      <span className="effect-row__label">
        <b style={{ color: "var(--text-primary)" }}>{change.scopeLabel}</b> · {change.label}
      </span>
      <span className={`effect-row__delta effect-row__delta--${direction}`}>
        {showNumeric ? `${sign}${change.delta}` : "•"}
      </span>
      <span className="effect-row__values">
        {showNumeric ? (
          <>
            <span className="from">{change.before}</span>
            <span className="arrow">→</span>
            <span>{change.after}</span>
          </>
        ) : (
          <span>—</span>
        )}
      </span>
    </div>
  );
}

function describeValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
