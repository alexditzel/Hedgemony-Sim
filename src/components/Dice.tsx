import type { RollRecord } from "../engine";

interface DiceResultProps {
  roll?: RollRecord;
  pendingLabel?: string;
  inline?: boolean;
}

export function DiceResult({ roll, pendingLabel = "Awaiting roll", inline }: DiceResultProps) {
  if (!roll) {
    return (
      <div className={`dice-result ${inline ? "dice-result--inline" : ""}`}>
        <div className="dice-result__face dice-result__face--pending" aria-hidden />
        <div>
          <div className="dice-result__purpose">{pendingLabel}</div>
          <div className="dice-result__formula">D10 — pending</div>
        </div>
      </div>
    );
  }
  const face = roll.results[0];
  return (
    <div className={`dice-result ${inline ? "dice-result--inline" : ""}`} title={roll.purpose}>
      <div className="dice-result__face">{face}</div>
      <div>
        <div className="dice-result__purpose">{roll.purpose}</div>
        <div className="dice-result__formula">{roll.formula}</div>
      </div>
    </div>
  );
}

interface DiceResultListProps {
  rolls: RollRecord[];
  emptyLabel?: string;
}
export function DiceResultList({ rolls, emptyLabel = "No rolls yet." }: DiceResultListProps) {
  if (rolls.length === 0) {
    return <div className="empty-state">{emptyLabel}</div>;
  }
  return (
    <div className="stack">
      {rolls.slice(-6).reverse().map((roll) => (
        <DiceResult key={roll.id} roll={roll} />
      ))}
    </div>
  );
}
