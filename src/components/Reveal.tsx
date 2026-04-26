import { useEffect, useMemo, useState } from "react";
import type { Card as GameCardData, GameState } from "../engine";
import { CardBack, GameCard } from "./Card";
import { cardBackImageUrlForCard } from "./cardBacks";
import { playerLabel } from "./factions";

interface RedSignalRevealProps {
  state: GameState;
  playerId: string;
  cards: GameCardData[];
  onComplete: () => void;
  isCurrent?: boolean;
  onOpenCard?: (card: GameCardData) => void;
}

export function RedSignalReveal({ state, playerId, cards, onComplete, isCurrent, onOpenCard }: RedSignalRevealProps) {
  const cardsKey = useMemo(() => `${playerId}|${cards.map((card) => card.id).join(",")}`, [cards, playerId]);
  const cardCount = cards.length;
  const [revealed, setRevealed] = useState<boolean[]>(() => Array.from({ length: cardCount }, () => false));

  useEffect(() => {
    // Only run the flip animation when we transition to a new (playerId+cards) set.
    // Re-renders triggered by sibling modals (info modal close) must not retrigger the animation.
    setRevealed(Array.from({ length: cardCount }, () => false));
    const timers: number[] = [];
    Array.from({ length: cardCount }).forEach((_, idx) => {
      const id = window.setTimeout(() => {
        setRevealed((current) => {
          const next = current.slice();
          next[idx] = true;
          return next;
        });
      }, 350 + idx * 450);
      timers.push(id);
    });
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [cardsKey, cardCount]);

  return (
    <div className="reveal-stage">
      <div className="row gap-md">
        <span className="tag tag--red">{playerLabel(state, playerId)} signaled</span>
        <span className="muted" style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", letterSpacing: "0.08em" }}>
          {cards.length} card{cards.length === 1 ? "" : "s"} disclosed
        </span>
      </div>
      <div className="reveal-cards">
        {cards.map((card, idx) => (
          <Flip
            key={`${playerId}-${card.id}-${idx}`}
            revealed={revealed[idx] ?? false}
            front={<GameCard card={card} tone="red" size="default" onOpen={() => onOpenCard?.(card)} />}
            back={
              <CardBack
                tone="red"
                stamp={`Red ${idx + 1}/${cards.length}`}
                imageUrl={cardBackImageUrlForCard(card)}
                label={`${playerLabel(state, playerId)} ${card.type} card back`}
              />
            }
          />
        ))}
      </div>
      {isCurrent ? (
        <button type="button" className="btn-primary" onClick={onComplete}>
          Continue to Intelligence Briefing →
        </button>
      ) : null}
    </div>
  );
}

function Flip({ revealed, front, back }: { revealed: boolean; front: React.ReactNode; back: React.ReactNode }) {
  return (
    <div className={`cardflip ${revealed ? "cardflip--revealed" : ""}`}>
      <div className="cardflip__inner">
        <div className="cardflip__face cardflip__face--front">{back}</div>
        <div className="cardflip__face cardflip__face--back">{front}</div>
      </div>
    </div>
  );
}
