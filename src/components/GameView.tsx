import { useEffect, useMemo, useState } from "react";
import * as L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import {
  RandomDiceRoller,
  READINESS_LEVELS,
  advanceBlueToActions,
  advanceRedActivePlayer,
  annualResourceAllocation,
  beginBlueReadinessBill,
  beginRedInvestmentsAndActions,
  calculateUsReadinessBill,
  createInitialGameState,
  getPlayerDeck,
  getPlayersBySide,
  payUsReadinessBill,
  playRedSignaledCard,
  placeholderRedPlayDecision,
  placeholderRedSequenceDecision,
  placeholderRedSignalDecision,
  placeholderWhiteCellAdjudicationResolution,
  placeholderWhiteCellSummary,
  procureForces,
  recordGameStartSummary,
  recordStateOfWorldSummary,
  requestBlueFreePlayAdjudication,
  resolveCard,
  resolveWhiteCellAdjudication,
  setActiveBluePlayer,
  setUsForceReadiness,
  signalRedCards,
  skipRemainingRedCards,
  validateState,
  type Card,
  type CardId,
  type ForceCommitment,
  type GameState,
  type PlayerId,
  type ReadinessLevel,
  type Scenario
} from "../engine";
import { canViewLog, canViewRoll, type ViewerId } from "./visibility";

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
  const [freePlayIntent, setFreePlayIntent] = useState("");
  const [viewer, setViewer] = useState<ViewerId>("Public");
  const [message, setMessage] = useState<UiMessage | undefined>();
  const roller = useMemo(() => new RandomDiceRoller(), []);

  const validationIssues = validateState(state);
  const activePlayer = state.active_player_id ? state.players[state.active_player_id] : undefined;
  const activeBluePlayer = activePlayer?.side === "Blue" ? activePlayer : undefined;
  const latestRoll = state.rolls
    .slice()
    .reverse()
    .find((roll) => canViewRoll(roll, state, viewer));
  const visibleLog = state.event_log.filter((entry) => canViewLog(entry, viewer));

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

  useEffect(() => {
    const pendingAdjudication = state.pending_adjudications.find((entry) => entry.status === "pending");
    if (pendingAdjudication) {
      const result = resolveWhiteCellAdjudication(
        state,
        pendingAdjudication.id,
        placeholderWhiteCellAdjudicationResolution(pendingAdjudication)
      );
      if (!showIssues(result.issues)) {
        applyResult(result.state);
      }
      return;
    }

    if (state.phase === "GameStart") {
      applyResult(recordGameStartSummary(state, placeholderWhiteCellSummary("game_start", state.turn)));
      return;
    }

    if (state.phase === "RedSignaling") {
      const nextPlayer = getPlayersBySide(state, "Red").find((player) => !state.red_signals[player.id]?.completed);
      if (nextPlayer) {
        const decision = placeholderRedSignalDecision(state, nextPlayer.id);
        const result = signalRedCards(state, nextPlayer.id, decision.cardIds, decision.briefSummary, decision.activationIntent);
        if (!showIssues(result.issues)) {
          applyResult(result.state);
        }
        return;
      }

      const result = beginBlueReadinessBill(state);
      if (!showIssues(result.issues)) {
        applyResult(result.state);
      }
      return;
    }

    if (state.phase === "RedInvestmentsAndActions" && state.active_player_id) {
      const playerId = state.active_player_id;
      if (state.red_plays[playerId]?.skipped) {
        applyResult(advanceRedActivePlayer(state));
        return;
      }

      const decision = placeholderRedPlayDecision(state, playerId);
      if (decision.kind === "play") {
        const result = playRedSignaledCard(state, playerId, decision.cardId, roller, commitmentsFor(decision.cardId));
        if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
          applyResult(result.state);
        }
        return;
      }

      const result = skipRemainingRedCards(state, playerId);
      if (!showIssues(result.issues)) {
        applyResult(result.state);
      }
      return;
    }

    if (state.phase === "AnnualResourcesAllocation") {
      const result = annualResourceAllocation(state, roller);
      if (!showIssues(result.issues)) {
        applyResult(result.state);
      }
      return;
    }

    if (state.phase === "StateOfWorldSummary") {
      applyResult(recordStateOfWorldSummary(state, placeholderWhiteCellSummary("state_of_world", state.turn)));
    }
  }, [state, roller]);

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
    const result = resolveCard(state, { acting_player_id: playerId, card_id: card.id, ...commitmentsFor(card.id) }, roller);
    if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
      applyResult(result.state);
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
        <label className="compact-label">
          View as
          <select value={viewer} onChange={(event) => setViewer(event.target.value as ViewerId)}>
            <option value="Public">Public</option>
            <option value="WhiteCell">White Cell</option>
            {Object.values(state.players).map((player) => (
              <option value={player.id} key={player.id}>
                {player.label}
              </option>
            ))}
          </select>
        </label>
        <div className="log-list">
          {visibleLog
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
          {(state.phase === "GameStart" ||
            state.phase === "RedSignaling" ||
            state.phase === "RedInvestmentsAndActions" ||
            state.phase === "AnnualResourcesAllocation" ||
            state.phase === "StateOfWorldSummary" ||
            state.pending_adjudications.some((entry) => entry.status === "pending")) && (
            <p className="muted">Resolving automated Red and White Cell steps.</p>
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
                      text: "White Cell table adjudication is being resolved automatically."
                    });
                  }
                }
              }}
              onSetReadiness={(forceId, readinessLevel) => {
                const result = setUsForceReadiness(state, forceId, readinessLevel);
                if (!showIssues(result.issues)) {
                  applyResult(result.state);
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
              onSelectPlayer={(playerId) => {
                const result = setActiveBluePlayer(state, playerId);
                if (!showIssues(result.issues)) {
                  applyResult(result.state);
                }
              }}
              onAdvanceToActions={() => {
                const result = advanceBlueToActions(state);
                if (!showIssues(result.issues)) {
                  applyResult(result.state);
                }
              }}
              onFreePlay={(playerId, subphase) => {
                const fallback = `Blue free-play ${subphase.toLowerCase()}`;
                const request = requestBlueFreePlayAdjudication(state, playerId, freePlayIntent || fallback);
                applyResult(request.state);
                setFreePlayIntent("");
              }}
              onEndBlue={() => {
                const sequence = state.rules_in_effect.random_red_sequence ? undefined : placeholderRedSequenceDecision(state);
                const result = beginRedInvestmentsAndActions(state, sequence, roller);
                if (!showIssues(result.issues.filter((issue) => issue.severity === "error"))) {
                  applyResult(result.state);
                }
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
        <strong>{activeBluePlayer ? `${activeBluePlayer.label} Cards` : "Blue Player Cards"}</strong>
        <div className="hand-strip">
          {activeBluePlayer ? (
            getPlayerDeck(state, activeBluePlayer.id).map((card) => (
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

function ReadinessPanel({
  state,
  onPay,
  onSetReadiness
}: {
  state: GameState;
  onPay: () => void;
  onSetReadiness: (forceId: string, readinessLevel: ReadinessLevel) => void;
}) {
  const bill = calculateUsReadinessBill(state);
  const usForces = Object.values(state.forces)
    .filter((force) => force.owner === "US")
    .sort((left, right) => left.id.localeCompare(right.id));
  return (
    <div className="control-stack">
      <h2>U.S. Readiness Bill</h2>
      <div className="table-like">
        {usForces.map((force) => {
          const location = state.locations[force.location_id];
          const readiness = force.readiness_level ?? 100;
          return (
            <div key={force.id}>
              <span>{force.id}</span>
              <span>{location?.label ?? force.location_id}</span>
              <span>{force.force_factors} FF</span>
              <select
                value={readiness}
                onChange={(event) => onSetReadiness(force.id, Number(event.target.value) as ReadinessLevel)}
              >
                {READINESS_LEVELS.map((level) => (
                  <option value={level} key={level}>
                    {level}%
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
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
  onSelectPlayer,
  onAdvanceToActions,
  onFreePlay,
  onEndBlue
}: {
  state: GameState;
  freePlayIntent: string;
  onFreePlayIntent: (value: string) => void;
  onPlayCard: (card: Card, playerId: PlayerId) => void;
  onSelectPlayer: (playerId: PlayerId) => void;
  onAdvanceToActions: () => void;
  onFreePlay: (playerId: PlayerId, subphase: "Investments" | "Actions") => void;
  onEndBlue: () => void;
}) {
  const bluePlayers = getPlayersBySide(state, "Blue");
  const activeBluePlayer =
    bluePlayers.find((player) => player.id === state.active_player_id) ?? bluePlayers[0];
  const visibleCards = activeBluePlayer
    ? getPlayerDeck(state, activeBluePlayer.id).filter((card) =>
        state.blue_subphase === "Actions" ? card.type === "Action" : card.type === "Investment"
      )
    : [];
  return (
    <div className="control-stack">
      <h2>Blue {state.blue_subphase ?? "Investments"} Phase</h2>
      <div className="segmented-control" aria-label="Active Blue player">
        {bluePlayers.map((player) => (
          <button
            type="button"
            key={player.id}
            className={player.id === activeBluePlayer?.id ? "selected" : ""}
            onClick={() => onSelectPlayer(player.id)}
          >
            {player.label}
          </button>
        ))}
      </div>
      <label>
        {activeBluePlayer?.label ?? "Blue"} free-play {state.blue_subphase?.toLowerCase() ?? "request"}
        <input value={freePlayIntent} onChange={(event) => onFreePlayIntent(event.target.value)} />
      </label>
      {activeBluePlayer && state.blue_subphase && (
        <button type="button" onClick={() => onFreePlay(activeBluePlayer.id, state.blue_subphase ?? "Investments")}>
          Request Free Play {state.blue_subphase === "Actions" ? "Action" : "Investment"}
        </button>
      )}
      {activeBluePlayer && (
        <section className="player-section">
          <h3>{activeBluePlayer.label}</h3>
          <div className="action-grid">
            {visibleCards.map((card) => (
              <button type="button" key={card.id} onClick={() => onPlayCard(card, activeBluePlayer.id)}>
                <strong>{card.title}</strong>
                <span>{card.type}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {state.blue_subphase === "Investments" && (
        <button type="button" onClick={onAdvanceToActions}>
          Begin Blue Actions
        </button>
      )}
      {state.blue_subphase === "Actions" && (
        <button type="button" onClick={onEndBlue}>
          End Blue Actions
        </button>
      )}
    </div>
  );
}
