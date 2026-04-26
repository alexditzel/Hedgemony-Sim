import type { ReactNode } from "react";
import type { Card as GameCardData, GameState, RedSignalState } from "../engine";
import { phaseLabel, playerLabel } from "./factions";
import { Tag } from "./ui";

interface NewspaperProps {
  name: string;
  edition: string;
  kicker?: string;
  headline: string;
  lede: string;
  byline?: string;
}

export function Newspaper({ name, edition, kicker, headline, lede, byline }: NewspaperProps) {
  return (
    <article className="newspaper" aria-label={`${name} headline`}>
      <header className="newspaper__masthead">
        <span className="newspaper__name">{name}</span>
        <span className="newspaper__meta">{edition}</span>
      </header>
      {kicker ? <div className="newspaper__kicker">{kicker}</div> : null}
      <h2 className="newspaper__headline">{headline}</h2>
      <p className="newspaper__lede">{lede}</p>
      {byline ? <div className="newspaper__byline">{byline}</div> : null}
    </article>
  );
}

interface BriefingProps {
  title: string;
  subtitle?: string;
  serial?: string;
  stamp?: string;
  children: ReactNode;
}

export function IntelBriefing({ title, subtitle, serial = "OPSUM", stamp = "OFFICIAL · BLUE", children }: BriefingProps) {
  return (
    <article className="briefing fade-in">
      <header className="briefing__header">
        <div className="briefing__seal" aria-hidden>J2</div>
        <div className="briefing__masthead">
          <span className="briefing__masthead-line">SERIAL · {serial}</span>
          <span className="briefing__masthead-line">PRECEDENCE · ROUTINE</span>
        </div>
        <span className="briefing__stamp">{stamp}</span>
      </header>
      <h2 className="briefing__title">{title}</h2>
      {subtitle ? <div className="briefing__subtitle">{subtitle}</div> : null}
      <div>{children}</div>
    </article>
  );
}

interface BriefingSectionProps {
  title: string;
  children: ReactNode;
}

export function BriefingSection({ title, children }: BriefingSectionProps) {
  return (
    <section className="briefing__section">
      <div className="briefing__section-title">{title}</div>
      {children}
    </section>
  );
}

interface SignaledIntelProps {
  state: GameState;
  signals: RedSignalState[];
}

export function RedSignalIntel({ state, signals }: SignaledIntelProps) {
  if (signals.length === 0) {
    return <p className="muted">No Red signals are on record for this turn.</p>;
  }
  return (
    <div className="briefing__signal-list">
      {signals.flatMap((signal) =>
        signal.card_ids.map((cardId) => {
          const card = state.cards[cardId];
          if (!card) return null;
          return (
            <div className="briefing__signal-row" key={`${signal.player_id}-${cardId}`}>
              <span className="briefing__signal-id">{cardId}</span>
              <div>
                <div className="briefing__signal-meta">
                  <Tag tone="red">{playerLabel(state, signal.player_id)}</Tag>{" "}
                  <span style={{ marginLeft: "0.4rem" }}>{card.type}{card.subtype ? ` · ${card.subtype}` : ""}</span>
                </div>
                <div className="briefing__signal-title">{card.title}</div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.4, marginTop: "0.2rem", color: "var(--text-secondary)" }}>
                  {card.description}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

interface NewspaperPairProps {
  state: GameState;
  summary: string;
  edition: string;
}

export function WorldStateNewspapers({ state, summary, edition }: NewspaperPairProps) {
  const usPlayer = state.players["US"];
  const naPlayer = state.players["NATO_EU"];
  const turnLabel = `Turn ${state.turn} · ${phaseLabel(state.phase)}`;
  return (
    <div className="newspaper-wrap">
      <Newspaper
        name="The Atlantic Tribune"
        edition={`Vol. III · ${edition}`}
        kicker="World"
        headline={"Analysts Watch Posture Shifts as Turn Opens"}
        lede={`${summary} Capitals from ${usPlayer?.label ?? "Washington"} to ${naPlayer?.label ?? "Brussels"} weigh competing pressures as the new cycle begins. Markets and ministries reread their playbooks.`}
        byline={`${turnLabel} · Front Page`}
      />
      <Newspaper
        name="Global Wire Daily"
        edition={`No. ${1000 + state.turn} · ${edition}`}
        kicker="Security"
        headline="Allies Recalibrate as Adversaries Signal Intent"
        lede={`Open-source watchers note movement of forces and shifting tones from ${ /* abstract */ "Moscow, Beijing, Tehran, and Pyongyang"}. Public statements remain vague; analysts caution against reading them as final.`}
        byline={`${turnLabel} · Wire Desk`}
      />
    </div>
  );
}

interface CardEffectListProps {
  card: GameCardData;
}

export function CardEffectList({ card }: CardEffectListProps) {
  if (card.effects.length === 0 && card.future_effects.length === 0) {
    return <p className="muted" style={{ fontSize: "0.85rem" }}>No deterministic effects.</p>;
  }
  return (
    <ul className="briefing__bullets">
      {card.effects.map((effect, idx) => (
        <li key={idx}>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{effect.type}</code> → {effect.target}
        </li>
      ))}
      {card.future_effects.map((scheduled, idx) => (
        <li key={`future-${idx}`}>
          <em>Future:</em> <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem" }}>{scheduled.effect.type}</code> → {scheduled.effect.target}
          {scheduled.trigger_turn ? ` (turn ${scheduled.trigger_turn})` : ""}
        </li>
      ))}
    </ul>
  );
}
