import { useMemo, useState } from "react";
import type { EventLogItem, GameState, RuleTag } from "../engine";
import { canViewLog, type ViewerId } from "./visibility";
import { Modal, Tag } from "./ui";
import { phaseLabel, playerTone } from "./factions";

type Filter = "all" | "blue" | "red" | "white" | "rolls";

interface EventLogPanelProps {
  state: GameState;
  viewer: ViewerId;
  onSelectEntry?: (entry: EventLogItem) => void;
  onOpenSummary?: (kind: "game_start" | "state_of_world", turn: number) => void;
}

const FILTER_LABELS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "blue", label: "Blue" },
  { id: "red", label: "Red" },
  { id: "white", label: "White Cell" },
  { id: "rolls", label: "Rolls" }
];

export function EventLogPanel({ state, viewer, onSelectEntry, onOpenSummary }: EventLogPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const visible = useMemo(() => state.event_log.filter((entry) => canViewLog(entry, viewer)), [state.event_log, viewer]);

  const filtered = useMemo(() => {
    return visible.filter((entry) => matchesFilter(entry, filter, state));
  }, [visible, filter, state]);

  return (
    <div>
      <div className="event-log__filter" role="tablist" aria-label="Event log filter">
        {FILTER_LABELS.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`event-log__filter-chip ${filter === option.id ? "event-log__filter-chip--active" : ""}`}
            onClick={() => setFilter(option.id)}
            aria-pressed={filter === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty-state">No events match this filter yet.</div>
      ) : (
        <ol className="event-log" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {filtered.slice().reverse().map((entry) => (
            <LogEntry key={entry.id} entry={entry} state={state} onSelectEntry={onSelectEntry} onOpenSummary={onOpenSummary} />
          ))}
        </ol>
      )}
    </div>
  );
}

function matchesFilter(entry: EventLogItem, filter: Filter, state: GameState): boolean {
  if (filter === "all") return true;
  if (filter === "rolls") return Boolean(entry.roll_id);
  if (filter === "white") return entry.tags.includes("WHITE_CELL_ADJUDICATION") || entry.player_id === undefined;
  const tone = playerTone(state, entry.player_id);
  if (filter === "blue") return tone === "blue";
  if (filter === "red") return tone === "red";
  return true;
}

function LogEntry({
  entry,
  state,
  onSelectEntry,
  onOpenSummary
}: {
  entry: EventLogItem;
  state: GameState;
  onSelectEntry?: (entry: EventLogItem) => void;
  onOpenSummary?: (kind: "game_start" | "state_of_world", turn: number) => void;
}) {
  const tone = entry.tags.includes("WHITE_CELL_ADJUDICATION") ? "white" : playerTone(state, entry.player_id);
  const dotClass =
    tone === "red" ? "event-log__pin--red" :
    tone === "blue" ? "event-log__pin--blue" :
    tone === "white" ? "event-log__pin--amber" : "";

  const summaryKind: "game_start" | "state_of_world" | undefined =
    entry.message.includes("Game-start") ? "game_start" :
    entry.message.includes("State-of-world summary recorded") ? "state_of_world" : undefined;

  const clickable = Boolean(onSelectEntry || (summaryKind && onOpenSummary));

  function handleClick() {
    if (summaryKind && onOpenSummary) {
      onOpenSummary(summaryKind, entry.turn);
    }
    if (onSelectEntry) {
      onSelectEntry(entry);
    }
  }

  return (
    <li
      className={`event-log__entry ${clickable ? "event-log__entry--clickable" : ""}`}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={(event) => {
        if (clickable && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          handleClick();
        }
      }}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : -1}
    >
      <div className="event-log__meta">
        <span className={`event-log__pin ${dotClass}`} aria-hidden />
        <span>T{entry.turn}</span>
        <span>·</span>
        <span>{phaseLabel(entry.phase)}</span>
        {tagBadges(entry.tags).map((tag, idx) => (
          <Tag key={idx} tone="neutral">{tag}</Tag>
        ))}
      </div>
      <div className="event-log__msg">{entry.message}</div>
    </li>
  );
}

function tagBadges(tags: RuleTag[]): string[] {
  return tags
    .filter((tag) => tag !== "DETERMINISTIC")
    .map((tag) => tag.replaceAll("_", " ").toLowerCase());
}

interface LogEntryModalProps {
  entry?: EventLogItem;
  state: GameState;
  open: boolean;
  onClose: () => void;
}

export function LogEntryModal({ entry, state, open, onClose }: LogEntryModalProps) {
  if (!entry) return null;
  const card = entry.card_id ? state.cards[entry.card_id] : undefined;
  const roll = entry.roll_id ? state.rolls.find((r) => r.id === entry.roll_id) : undefined;
  return (
    <Modal open={open} onClose={onClose} title={`Log · T${entry.turn} ${phaseLabel(entry.phase)}`}>
      <div className="stack-md">
        <p style={{ lineHeight: 1.5 }}>{entry.message}</p>
        {card ? (
          <div className="stack">
            <span className="section__title section__title--muted">Card</span>
            <p>{card.id} · {card.title}</p>
            <p className="muted" style={{ fontSize: "0.85rem", lineHeight: 1.5 }}>{card.description}</p>
          </div>
        ) : null}
        {roll ? (
          <div className="stack">
            <span className="section__title section__title--muted">Roll</span>
            <p style={{ fontFamily: "var(--font-mono)" }}>{roll.formula}</p>
            <p className="muted" style={{ fontSize: "0.82rem" }}>{roll.purpose}</p>
          </div>
        ) : null}
        <div className="row gap-sm">
          {entry.tags.map((tag) => <Tag key={tag}>{tag.replaceAll("_", " ")}</Tag>)}
        </div>
      </div>
    </Modal>
  );
}
