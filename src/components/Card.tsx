import type { KeyboardEvent } from "react";
import type { Card as GameCardData, GameState, PlayerId } from "../engine";
import type { FactionTone } from "./factions";
import { playerLabel, sideToTone } from "./factions";

function toneForCardOwner(card: GameCardData, state: GameState): FactionTone {
  if (!card.owner) return "neutral";
  if (card.owner === "WhiteCell") return "white";
  return sideToTone(state.players[card.owner]?.side);
}

export type CardSize = "sm" | "compact" | "default" | "lg";

interface GameCardProps {
  card: GameCardData;
  size?: CardSize;
  tone?: FactionTone;
  imageUrl?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onOpen?: () => void;
  ownerLabel?: string;
}

function sizeClass(size: CardSize): string {
  if (size === "sm") return "gamecard--small";
  if (size === "compact") return "gamecard--compact";
  if (size === "lg") return "gamecard--large";
  return "";
}

export function GameCard({
  card,
  size = "default",
  tone,
  imageUrl,
  selected,
  disabled,
  onClick,
  onOpen,
  ownerLabel
}: GameCardProps) {
  const interactive = Boolean(onClick) && !disabled;
  const toneClass =
    (tone ?? defaultToneFor(card)) === "red" ? "gamecard--red" :
    (tone ?? defaultToneFor(card)) === "blue" ? "gamecard--blue" :
    (tone ?? defaultToneFor(card)) === "white" ? "gamecard--event" : "gamecard--neutral";

  function handleKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (!interactive) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
    if (event.key === "i" || event.key === "I") {
      event.preventDefault();
      onOpen?.();
    }
  }

  return (
    <div
      className={[
        "gamecard",
        sizeClass(size),
        toneClass,
        interactive ? "gamecard--interactive" : "",
        selected ? "gamecard--selected" : "",
        disabled ? "gamecard--disabled" : ""
      ]
        .filter(Boolean)
        .join(" ")}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-disabled={disabled || undefined}
      aria-pressed={selected || undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={handleKey}
      onDoubleClick={onOpen}
    >
      {onOpen ? (
        <button
          type="button"
          className="gamecard__info"
          aria-label={`View full text for ${card.title}`}
          title="View full card text"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          i
        </button>
      ) : null}
      <div className="gamecard__header">
        <span className="gamecard__id">{card.id}</span>
        <span className="gamecard__type">{card.type}</span>
      </div>
      <div>
        <div className="gamecard__title">{card.title}</div>
        {card.subtype ? <div className="gamecard__subtitle">{card.subtype}</div> : null}
      </div>
      {imageUrl ? <div className="gamecard__image" style={{ backgroundImage: `url(${imageUrl})` }} /> : null}
      <div className="gamecard__body">{card.description}</div>
      <div className="gamecard__footer">
        <span className="gamecard__cost">{costLabel(card)}</span>
        <span className="gamecard__aor">{ownerLabel ?? card.owner ?? "Common"}{card.aor ? ` · ${card.aor}` : ""}</span>
      </div>
    </div>
  );
}

function defaultToneFor(card: GameCardData): FactionTone {
  if (card.owner === null || card.owner === undefined) return "neutral";
  if (card.owner === "WhiteCell") return "white";
  return "neutral";
}

function costLabel(card: GameCardData): string {
  const cost = card.cost.resource_points;
  if (cost === null) return "FREE";
  if (typeof cost === "number") return `${cost} RP`;
  return "VAR";
}

interface CardBackProps {
  tone?: "blue" | "red";
  stamp?: string;
}
export function CardBack({ tone = "red", stamp = "Classified" }: CardBackProps) {
  return <div className={`gamecard-back ${tone === "blue" ? "gamecard-back--blue" : ""}`} data-stamp={stamp} />;
}

interface CardFlipProps {
  revealed: boolean;
  front: React.ReactNode;
  back: React.ReactNode;
}
export function CardFlip({ revealed, front, back }: CardFlipProps) {
  return (
    <div className={`cardflip ${revealed ? "cardflip--revealed" : ""}`}>
      <div className="cardflip__inner">
        <div className="cardflip__face cardflip__face--front">{back}</div>
        <div className="cardflip__face cardflip__face--back">{front}</div>
      </div>
    </div>
  );
}

interface CardWithOwnerProps {
  card: GameCardData;
  state: GameState;
  size?: CardSize;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  onOpen?: () => void;
  toneOverride?: FactionTone;
}

export function PlayerCard({ card, state, size, selected, disabled, onClick, onOpen, toneOverride }: CardWithOwnerProps) {
  const tone = toneOverride ?? toneForCardOwner(card, state);
  return (
    <GameCard
      card={card}
      size={size}
      tone={tone}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
      onOpen={onOpen}
      ownerLabel={card.owner ? playerLabel(state, card.owner as PlayerId | "WhiteCell") : "Shared"}
    />
  );
}
