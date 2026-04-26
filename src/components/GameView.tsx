import { useMemo, useState } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import {
  RandomDiceRoller,
  advanceRedActivePlayer,
  annualResourceAllocation,
  beginBlueReadinessBill,
  beginRedInvestmentsAndActions,
  calculateUsReadinessBill,
  createInitialGameState,
  getPlayerDeck,
  getPlayersBySide,
  getRedChoiceOptions,
  injectWhiteCellEvent,
  payUsReadinessBill,
  playRedSignaledCard,
  procureForces,
  recordGameStartSummary,
  recordStateOfWorldSummary,
  requestBlueFreePlayAdjudication,
  resolveCard,
  resolveWhiteCellAdjudication,
  signalRedCards,
  skipRemainingRedCards,
  validateState,
  type Card,
  type CardId,
  type ForceCommitment,
  type GameState,
  type PlayerId,
  type Scenario
} from "../engine";

interface GameViewProps {
  scenario: Scenario;
}

interface UiMessage {
  tone: "info" | "error";
  text: string;
}

const playerColors: Record<string, string> = {
  US: "#2563eb",
  NATO_EU: "#0f766e",
  RU: "#b91c1c",
  PRC: "#dc2626",
  DPRK: "#7f1d1d",
  IR: "#9a3412",
  WhiteCell: "#525252"
};

function commitmentsFor(cardId: CardId): Partial<{
  blue_commitments: ForceCommitment[];
  red_commitments: ForceCommitment[];
  blue_players: PlayerId[];
  red_players: PlayerId[];
  proxy_id: string;
}> {
  if (cardId === "US-ACT-01") {
    return {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
      red_commitments: [{ force_id: "PRC-INDO-5-M3", source: "in_theater" }],
      blue_players: ["US"],
      red_players: ["PRC"]
    };
  }
  if (cardId === "NATO-ACT-01") {
    return {
      blue_commitments: [{ force_id: "NATO-EUCOM-5", source: "in_theater" }],
      red_commitments: [{ force_id: "RU-EUCOM-5-M2", source: "in_theater" }],
      blue_players: ["NATO_EU"],
      red_players: ["RU"]
    };
  }
  if (cardId === "RU-ACT-01") {
    return {
      blue_commitments: [
        { force_id: "NATO-EUCOM-5", source: "in_theater" },
        { force_id: "US-EUCOM-1", source: "in_theater" }
      ],
      red_commitments: [
        { force_id: "RU-EUCOM-5-M2", source: "in_theater" },
        { force_id: "RU-EUCOM-4-M3", source: "in_theater" }
      ],
      blue_players: ["NATO_EU", "US"],
      red_players: ["RU"]
    };
  }
  if (cardId === "PRC-ACT-01" || cardId === "PRC-ACT-02") {
    return {
      blue_commitments: [{ force_id: "US-PRC-1", source: "in_theater" }],
      red_commitments: [
        { force_id: "PRC-INDO-5-M2", source: "in_theater" },
        { force_id: "PRC-INDO-5-M3", source: "in_theater" }
      ],
      blue_players: ["US"],
      red_players: ["PRC"]
    };
  }
  if (cardId === "IR-ACT-01") {
    return {
      blue_commitments: [{ force_id: "US-IRQ-1", source: "in_theater" }],
      red_commitments: [{ force_id: "IR-CENTCOM-5", source: "in_theater" }],
      blue_players: ["US"],
      red_players: ["IR"]
    };
  }
  if (cardId === "IR-ACT-02") {
    return { proxy_id: "IR-PROXY-01" };
  }
  return {};
}

function makeTokenIcon(owner: string, count: number): L.DivIcon {
  const color = playerColors[owner] ?? "#404040";
  return L.divIcon({
    className: "force-token",
    html: `<span style="background:${color}">${owner}<b>${count}</b></span>`,
    iconSize: [58, 26],
    iconAnchor: [29, 13]
  });
}

export function GameView({ scenario }: GameViewProps) {
  const [state, setState] = useState<GameState>(() => createInitialGameState(scenario));
  const [selectedSignals, setSelectedSignals] = useState<Record<PlayerId, CardId[]>>({});
  const [summaryText, setSummaryText] = useState("");
  const [briefText, setBriefText] = useState("");
  const [freePlayIntent, setFreePlayIntent] = useState("");
  const [whiteCellText, setWhiteCellText] = useState("");
  const [message, setMessage] = useState<UiMessage | undefined>();
  const roller = useMemo(() => new RandomDiceRoller(), []);

  const validationIssues = validateState(state);
  const activeRedPlayer = state.phase === "RedInvestmentsAndActions" ? state.active_player_id : undefined;
  const activePlayer = state.active_player_id ? state.players[state.active_player_id] : undefined;
  const latestRoll = state.rolls.at(-1);

  function applyResult(next: GameState, errorText?: string): void {
    const errors = validateState(next).filter((issue) => issue.severity === "error");
    setState(next);
    if (errorText) {
      setMessage({ tone: "error", text: errorText });
    } else if (errors.length > 0) {
      setMessage({ tone: "error", text: errors[0].message });
    } else {
      setMessage(undefined);
    }
  }

  function showIssues(issues: { message: string }[]): boolean {
    if (issues.length === 0) {
      return false;
    }
    setMessage({ tone: "error", text: issues.map((issue) => issue.message).join(" ") });
    return true;
  }

  function toggleSignal(playerId: PlayerId, cardId: CardId): void {
    const current = selectedSignals[playerId] ?? [];
    const next = current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId].slice(0, 3);
    setSelectedSignals({ ...selectedSignals, [playerId]: next });
  }

  function submitSignal(playerId: PlayerId): void {
    const result = signalRedCards(state, playerId, selectedSignals[playerId] ?? [], briefText);
    if (!showIssues(result.issues)) {
      applyResult(result.state);
      setBriefText("");
    }
  }

  function playBlueCard(card: Card, playerId: PlayerId): void {
    if (card.id === "US-INV-02") {
      const procured = procureForces(state, {
        player_id: "US",
        force_factors: 1,
        modernization_level: 3,
        location_id: "CONUS",
        home_base_id: "CONUS",
        readiness_level: 90
      });
      if (!showIssues(procured.issues)) {
        applyResult(procured.state);
      }
      return;
    }
    if (card.id === "US-ACT-02") {
      const request = requestBlueFreePlayAdjudication(state, playerId, freePlayIntent || "Blue free-play action");
      applyResult(request.state);
      setFreePlayIntent("");
      return;
    }
    const result = resolveCard(state, { acting_player_id: playerId, card_id: card.id, ...commitmentsFor(card.id) }, roller);
    if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
      applyResult(result.state);
    }
  }

  function playRedCard(card: Card): void {
    if (!activeRedPlayer) {
      return;
    }
    const result = playRedSignaledCard(state, activeRedPlayer, card.id, roller, commitmentsFor(card.id));
    if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
      applyResult(result.state);
    }
  }

  function skipRed(): void {
    if (!activeRedPlayer) {
      return;
    }
    const result = skipRemainingRedCards(state, activeRedPlayer);
    if (!showIssues(result.issues)) {
      applyResult(result.state);
    }
  }

  function resolveFirstAdjudication(): void {
    const request = state.pending_adjudications.find((entry) => entry.status === "pending");
    if (!request) {
      return;
    }
    const result = resolveWhiteCellAdjudication(state, request.id, whiteCellText || "Resolved by White Cell.");
    if (!showIssues(result.issues)) {
      applyResult(result.state);
      setWhiteCellText("");
    }
  }

  const signaledCards = Object.values(state.red_signals).flatMap((signal) =>
    signal.card_ids.map((id) => ({ playerId: signal.player_id, card: state.cards[id] }))
  );
  const tokenGroups = Object.values(state.forces).reduce<Record<string, { location: string; owner: string; ffs: number }[]>>(
    (groups, force) => {
      const entries = groups[force.location_id] ?? [];
      const existing = entries.find((entry) => entry.owner === force.owner);
      if (existing) {
        existing.ffs += force.force_factors;
      } else {
        entries.push({ location: force.location_id, owner: force.owner, ffs: force.force_factors });
      }
      groups[force.location_id] = entries;
      return groups;
    },
    {}
  );

  return (
    <div className="app-shell">
      <header className="top-row" aria-label="Opponent signaled cards">
        <strong>Revealed Red Signals</strong>
        <div className="signal-strip">
          {signaledCards.length === 0 ? (
            <span className="muted">No Red cards signaled yet.</span>
          ) : (
            signaledCards.map(({ playerId, card }) => (
              <span className="signal-pill" key={`${playerId}-${card.id}`}>
                {playerId}: {card.title}
              </span>
            ))
          )}
        </div>
      </header>

      <aside className="left-sidebar">
        <h2>Event Log</h2>
        <div className="log-list">
          {state.event_log
            .slice()
            .reverse()
            .map((entry) => (
              <article key={entry.id}>
                <small>
                  Turn {entry.turn} · {entry.phase}
                </small>
                <p>{entry.message}</p>
              </article>
            ))}
        </div>
      </aside>

      <main className="main-panel">
        <section className="active-panel">
          <PanelHeader state={state} activePlayerName={activePlayer?.label} latestRollFormula={latestRoll?.formula} />
          {message && <p className={`message ${message.tone}`}>{message.text}</p>}
          {state.pending_adjudications.some((entry) => entry.status === "pending") && (
            <WhiteCellPanel
              request={state.pending_adjudications.find((entry) => entry.status === "pending")}
              value={whiteCellText}
              onChange={setWhiteCellText}
              onResolve={resolveFirstAdjudication}
            />
          )}
          {state.phase === "GameStart" && (
            <GameStartPanel
              value={summaryText}
              onChange={setSummaryText}
              onSubmit={() => {
                applyResult(recordGameStartSummary(state, summaryText || "White Cell summarized the opening state of the world."));
                setSummaryText("");
              }}
            />
          )}
          {state.phase === "RedSignaling" && (
            <RedSignalingPanel
              state={state}
              selectedSignals={selectedSignals}
              briefText={briefText}
              onBriefChange={setBriefText}
              onToggleSignal={toggleSignal}
              onSubmitSignal={submitSignal}
              onBeginBlue={() => {
                const result = beginBlueReadinessBill(state);
                if (!showIssues(result.issues)) {
                  applyResult(result.state);
                }
              }}
            />
          )}
          {state.phase === "BlueReadinessBill" && (
            <ReadinessPanel
              state={state}
              onPay={() => {
                const result = payUsReadinessBill(state);
                const blockingIssues = result.issues.filter((issue) => issue.severity === "error");
                if (!showIssues(blockingIssues)) {
                  applyResult(result.state);
                  if (result.issues.some((issue) => issue.severity === "adjudication")) {
                    setMessage({
                      tone: "info",
                      text: "White Cell table adjudication is required before the readiness bill can be paid. Enter a numeric table value, resolve it, then pay again."
                    });
                  }
                }
              }}
            />
          )}
          {state.phase === "BlueInvestmentsAndActions" && (
            <BlueActionPanel
              state={state}
              freePlayIntent={freePlayIntent}
              onFreePlayIntent={setFreePlayIntent}
              onPlayCard={playBlueCard}
              onInjectEvent={(cardId) => {
                const result = injectWhiteCellEvent(state, cardId, "Injected from White Cell panel.", roller);
                if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
                  applyResult(result.state);
                }
              }}
              onEndBlue={() => {
                const result = beginRedInvestmentsAndActions(state);
                if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
                  applyResult(result.state);
                }
              }}
            />
          )}
          {state.phase === "RedInvestmentsAndActions" && activeRedPlayer && (
            <RedActionPanel
              state={state}
              playerId={activeRedPlayer}
              onPlayCard={playRedCard}
              onSkip={skipRed}
              onNext={() => applyResult(advanceRedActivePlayer(state))}
            />
          )}
          {state.phase === "AnnualResourcesAllocation" && (
            <AnnualResourcesPanel
              onAllocate={() => {
                const result = annualResourceAllocation(state, roller);
                if (!showIssues(result.issues)) {
                  applyResult(result.state);
                }
              }}
            />
          )}
          {state.phase === "StateOfWorldSummary" && (
            <StateSummaryPanel
              value={summaryText}
              onChange={setSummaryText}
              onSubmit={() => {
                applyResult(recordStateOfWorldSummary(state, summaryText || "White Cell summarized the state of the world."));
                setSummaryText("");
              }}
            />
          )}
          {state.phase === "GameOver" && <p>The scenario has reached its maximum turn.</p>}
        </section>

        <section className="map-panel" aria-label="World map">
          <MapContainer center={[25, 35]} zoom={2} minZoom={2} scrollWheelZoom className="map">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {Object.entries(tokenGroups).flatMap(([locationId, entries]) => {
              const location = state.locations[locationId];
              const coordinates = location?.coordinates;
              if (!coordinates) {
                return [];
              }
              return entries.map((entry, index) => (
                <Marker
                  key={`${locationId}-${entry.owner}`}
                  position={[coordinates[0] + index * 0.9, coordinates[1] + index * 0.9]}
                  icon={makeTokenIcon(entry.owner, entry.ffs)}
                >
                  <Popup>
                    {entry.owner} · {entry.ffs} FF
                    <br />
                    {location.label}
                  </Popup>
                </Marker>
              ));
            })}
          </MapContainer>
        </section>
      </main>

      <aside className="right-sidebar">
        <h2>Stats</h2>
        <dl className="stat-grid">
          <div>
            <dt>Turn</dt>
            <dd>{state.turn}</dd>
          </div>
          <div>
            <dt>Phase</dt>
            <dd>{state.phase}</dd>
          </div>
        </dl>
        <h3>Players</h3>
        <div className="player-stats">
          {Object.values(state.players).map((player) => (
            <article key={player.id} className={player.id === state.active_player_id ? "active-stat" : ""}>
              <strong>{player.label}</strong>
              <span>{player.side}</span>
              <span>{player.resource_points} RP</span>
              <span>{player.influence_points} IP</span>
              <span>NTL {player.national_tech_level}</span>
            </article>
          ))}
        </div>
        <h3>Validation</h3>
        {validationIssues.length === 0 ? (
          <p className="muted">No validation issues.</p>
        ) : (
          <ul className="issue-list">
            {validationIssues.slice(0, 5).map((issue) => (
              <li key={issue.id}>{issue.message}</li>
            ))}
          </ul>
        )}
      </aside>

      <footer className="bottom-row">
        <strong>{activePlayer ? `${activePlayer.label} Cards` : "Active Player Cards"}</strong>
        <div className="hand-strip">
          {activePlayer ? (
            getPlayerDeck(state, activePlayer.id).map((card) => (
              <span key={card.id} className="hand-card">
                {card.id}: {card.title}
              </span>
            ))
          ) : (
            <span className="muted">No active player.</span>
          )}
        </div>
      </footer>
    </div>
  );
}

function PanelHeader({
  state,
  activePlayerName,
  latestRollFormula
}: {
  state: GameState;
  activePlayerName?: string;
  latestRollFormula?: string;
}) {
  return (
    <div className="panel-header">
      <div>
        <p className="eyebrow">Turn {state.turn}</p>
        <h1>{state.phase}</h1>
        {activePlayerName && <p>Active: {activePlayerName}</p>}
      </div>
      {latestRollFormula && (
        <div className="roll-formula">
          <span>Latest Roll</span>
          <strong>{latestRollFormula}</strong>
        </div>
      )}
    </div>
  );
}

function GameStartPanel({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return (
    <div className="control-stack">
      <label>
        Opening White Cell summary
        <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      <button type="button" onClick={onSubmit}>
        Record Summary
      </button>
    </div>
  );
}

function RedSignalingPanel({
  state,
  selectedSignals,
  briefText,
  onBriefChange,
  onToggleSignal,
  onSubmitSignal,
  onBeginBlue
}: {
  state: GameState;
  selectedSignals: Record<PlayerId, CardId[]>;
  briefText: string;
  onBriefChange: (value: string) => void;
  onToggleSignal: (playerId: PlayerId, cardId: CardId) => void;
  onSubmitSignal: (playerId: PlayerId) => void;
  onBeginBlue: () => void;
}) {
  const redPlayers = getPlayersBySide(state, "Red");
  const nextPlayer = redPlayers.find((player) => !state.red_signals[player.id]?.completed);
  if (!nextPlayer) {
    return (
      <div className="control-stack">
        <p>All Red players have signaled. The revealed cards remain separated by Red player in the top row.</p>
        <button type="button" onClick={onBeginBlue}>
          Begin Blue Readiness Bill
        </button>
      </div>
    );
  }
  const selected = selectedSignals[nextPlayer.id] ?? [];
  return (
    <div className="control-stack">
      <h2>{nextPlayer.label} Signaling</h2>
      <p className="muted">Choose up to three. If choosing three, include at least one Action and one Investment.</p>
      <div className="card-list">
        {getPlayerDeck(state, nextPlayer.id).map((card) => (
          <label key={card.id} className="card-choice">
            <input
              type="checkbox"
              checked={selected.includes(card.id)}
              onChange={() => onToggleSignal(nextPlayer.id, card.id)}
            />
            <span>
              <strong>{card.title}</strong>
              <small>
                {card.id} · {card.type} · Cost {typeof card.cost.resource_points === "number" ? card.cost.resource_points : "card"}
              </small>
            </span>
          </label>
        ))}
      </div>
      <label>
        Intelligence-style brief
        <textarea value={briefText} onChange={(event) => onBriefChange(event.target.value)} />
      </label>
      <button type="button" onClick={() => onSubmitSignal(nextPlayer.id)}>
        Signal Selected Cards
      </button>
    </div>
  );
}

function ReadinessPanel({ state, onPay }: { state: GameState; onPay: () => void }) {
  const bill = calculateUsReadinessBill(state);
  return (
    <div className="control-stack">
      <h2>U.S. Readiness Bill</h2>
      <div className="table-like">
        {bill.rows.map((row) => (
          <div key={`${row.location}-${row.readiness}`}>
            <span>{row.location}</span>
            <span>{row.force_factors} FF</span>
            <span>{row.readiness}%</span>
            <strong>{row.cost} RP</strong>
          </div>
        ))}
      </div>
      <p>Total: {bill.total} RP</p>
      <button type="button" onClick={onPay}>
        Pay Readiness Bill
      </button>
    </div>
  );
}

function BlueActionPanel({
  state,
  freePlayIntent,
  onFreePlayIntent,
  onPlayCard,
  onInjectEvent,
  onEndBlue
}: {
  state: GameState;
  freePlayIntent: string;
  onFreePlayIntent: (value: string) => void;
  onPlayCard: (card: Card, playerId: PlayerId) => void;
  onInjectEvent: (cardId: CardId) => void;
  onEndBlue: () => void;
}) {
  const bluePlayers = getPlayersBySide(state, "Blue");
  const events = Object.values(state.cards).filter((card) => card.type === "InternationalEvent" || card.type === "DomesticEvent");
  return (
    <div className="control-stack">
      <h2>Blue Investments and Actions</h2>
      <label>
        Blue free-play intent
        <input value={freePlayIntent} onChange={(event) => onFreePlayIntent(event.target.value)} />
      </label>
      {bluePlayers.map((player) => (
        <section className="player-section" key={player.id}>
          <h3>{player.label}</h3>
          <div className="action-grid">
            {getPlayerDeck(state, player.id).map((card) => (
              <button type="button" key={card.id} onClick={() => onPlayCard(card, player.id)}>
                <strong>{card.title}</strong>
                <span>{card.type}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <section className="player-section">
        <h3>White Cell Event Injection</h3>
        <div className="action-grid">
          {events.map((card) => (
            <button type="button" key={card.id} onClick={() => onInjectEvent(card.id)}>
              <strong>{card.title}</strong>
              <span>{card.type}</span>
            </button>
          ))}
        </div>
      </section>
      <button type="button" onClick={onEndBlue}>
        End Blue Phase
      </button>
    </div>
  );
}

function RedActionPanel({
  state,
  playerId,
  onPlayCard,
  onSkip,
  onNext
}: {
  state: GameState;
  playerId: PlayerId;
  onPlayCard: (card: Card) => void;
  onSkip: () => void;
  onNext: () => void;
}) {
  const signal = state.red_signals[playerId];
  const play = state.red_plays[playerId];
  const options = getRedChoiceOptions(state, playerId);
  return (
    <div className="control-stack">
      <h2>{state.players[playerId].label} Investments and Actions</h2>
      <p>Chosen signal set: {signal?.card_ids.map((id) => state.cards[id]?.title ?? id).join(", ")}</p>
      <p>Played: {play?.played_card_ids.length ? play.played_card_ids.join(", ") : "none"}</p>
      {!play?.skipped && (
        <div className="action-grid">
          {options.remaining.map((card) => (
            <button type="button" key={card.id} onClick={() => onPlayCard(card)}>
              <strong>{card.title}</strong>
              <span>
                {card.type} · {card.id}
              </span>
            </button>
          ))}
          <button type="button" onClick={onSkip}>
            Skip Remaining
          </button>
        </div>
      )}
      {play?.skipped && (
        <button type="button" onClick={onNext}>
          Next Red Player
        </button>
      )}
    </div>
  );
}

function AnnualResourcesPanel({ onAllocate }: { onAllocate: () => void }) {
  return (
    <div className="control-stack">
      <h2>Annual Resource Allocation</h2>
      <p>Roll the U.S. DoD budget variation and add each player’s per-turn RP allocation.</p>
      <button type="button" onClick={onAllocate}>
        Allocate Resources
      </button>
    </div>
  );
}

function StateSummaryPanel({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return (
    <div className="control-stack">
      <h2>State of the World Summary</h2>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" onClick={onSubmit}>
        Record Summary and Advance
      </button>
    </div>
  );
}

function WhiteCellPanel({
  request,
  value,
  onChange,
  onResolve
}: {
  request?: { reason: string; rule_refs: string[] };
  value: string;
  onChange: (value: string) => void;
  onResolve: () => void;
}) {
  if (!request) {
    return null;
  }
  return (
    <section className="white-cell">
      <h2>White Cell Evaluation</h2>
      <p>{request.reason}</p>
      <small>{request.rule_refs.join(", ")}</small>
      <small>For table adjudications, enter the numeric table value to add as a scenario-defined extension.</small>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" onClick={onResolve}>
        Resolve Adjudication
      </button>
    </section>
  );
}
