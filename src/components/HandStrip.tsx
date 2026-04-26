import type { Card as GameCardData, GameState } from "../engine";
import { PlayerCard } from "./Card";
import { Tag } from "./ui";
import { phaseLabel } from "./factions";

interface HandStripProps {
  state: GameState;
  title: string;
  cards: GameCardData[];
  selectableCardIds?: Set<string>;
  selectedCardId?: string;
  onSelect?: (card: GameCardData) => void;
  onOpen?: (card: GameCardData) => void;
  emptyLabel?: string;
  rightSlot?: React.ReactNode;
}

export function HandStrip({
  state,
  title,
  cards,
  selectableCardIds,
  selectedCardId,
  onSelect,
  onOpen,
  emptyLabel = "No cards available.",
  rightSlot
}: HandStripProps) {
  return (
    <div className="hand-strip">
      <div className="hand-strip__header">
        <div className="row gap-md">
          <span className="hand-strip__title">{title}</span>
          <Tag tone="blue">{phaseLabel(state.phase)}{state.blue_subphase ? ` · ${state.blue_subphase}` : ""}</Tag>
        </div>
        <div className="row gap-sm">{rightSlot}</div>
      </div>
      <div className="hand-strip__cards">
        {cards.length === 0 ? (
          <div className="hand-empty">{emptyLabel}</div>
        ) : (
          cards.map((card) => {
            const isSelectable = !selectableCardIds || selectableCardIds.has(card.id);
            const isSelected = card.id === selectedCardId;
            return (
              <PlayerCard
                key={card.id}
                card={card}
                state={state}
                size="default"
                disabled={!isSelectable}
                selected={isSelected}
                onClick={isSelectable ? () => onSelect?.(card) : undefined}
                onOpen={() => onOpen?.(card)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
