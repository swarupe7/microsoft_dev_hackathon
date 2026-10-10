"use client";

import { useEffect, useMemo, useState } from "react";
import {
  VIEW_MODES,
  buildMatchRecap,
  buildOverlayPacket,
  runMatchMindPipeline,
  type ViewModeId,
} from "@/lib/agents";
import type {
  CommentaryFacts,
  CommentaryResponseBody,
  CommentarySource,
} from "@/lib/match/commentaryPayload";
import {
  createInitialMatchState,
  possessionPercents,
  tickMatch,
} from "@/lib/match/engine";
import { HOSTS } from "@/lib/match/hosts";
import { buildPitchMarkers } from "@/lib/match/pitchPositions";
import { AWAY_TEAM, HOME_TEAM, getTeam } from "@/lib/match/teams";
import type { HostId, MatchInsight, MatchState } from "@/lib/match/types";

const EVENT_LABELS: Record<string, string> = {
  pass: "Pass",
  shot: "Shot",
  shot_on_target: "On target",
  goal: "Goal",
  tackle: "Tackle",
  foul: "Foul",
  corner: "Corner",
  possession_change: "Turnover",
};

function formatClock(minute: number, second: number): string {
  return `${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

/** Pack only verified fields for the commentary API. */
function buildCommentaryFacts(
  hostId: HostId,
  insight: MatchInsight,
  match: MatchState,
): CommentaryFacts {
  const possession = possessionPercents(match);

  return {
    hostId,
    insight: {
      id: insight.id,
      title: insight.title,
      kind: insight.kind,
      whatHappened: insight.whatHappened,
      whyItMatters: insight.whyItMatters,
      minuteStart: insight.minuteStart,
      minuteEnd: insight.minuteEnd,
      teamName: insight.teamId ? getTeam(insight.teamId).name : null,
      evidence: insight.evidence,
    },
    score: { ...match.score },
    possession,
    teams: { home: HOME_TEAM.name, away: AWAY_TEAM.name },
    clock: { minute: match.minute, second: match.second },
  };
}

export default function MatchDashboard() {
  const [match, setMatch] = useState<MatchState>(() => createInitialMatchState());
  const [hostId, setHostId] = useState<HostId>("blaze");
  const [viewMode, setViewMode] = useState<ViewModeId>("casual");
  const [showOverlay, setShowOverlay] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [copied, setCopied] = useState(false);
  const [commentary, setCommentary] = useState("");
  const [commentarySource, setCommentarySource] =
    useState<CommentarySource>("rules");
  const [commentaryNote, setCommentaryNote] = useState<string | undefined>();
  const [commentaryLoading, setCommentaryLoading] = useState(false);

  // Drive the synthetic match clock while running.
  useEffect(() => {
    if (!match.isRunning) return;
    const id = window.setInterval(() => {
      setMatch((prev) => tickMatch(prev));
    }, 450);
    return () => window.clearInterval(id);
  }, [match.isRunning]);

  // Multi-agent pipeline — shared board with explicit handoffs.
  const board = useMemo(
    () =>
      runMatchMindPipeline({
        match,
        hostId,
        viewMode,
        focusPlayerId: match.events[0]?.playerId ?? null,
      }),
    [match, hostId, viewMode],
  );

  const insight = board.insight!;
  const possession = board.possession;
  const activeHost = HOSTS.find((h) => h.id === hostId) ?? HOSTS[0];
  // Players + ball positions for the live pitch graphic.
  const pitchScene = useMemo(() => buildPitchMarkers(match), [match]);
  const overlay = useMemo(() => buildOverlayPacket(board), [board]);
  const recap = useMemo(() => buildMatchRecap(match), [match]);
  const localCommentary = board.personalizedNarrative || board.hostNarrative;

  // Optional cloud rewrite — still fact-bound; personalization stays local.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const delayMs = 700;

    const timer = window.setTimeout(async () => {
      setCommentary(localCommentary);
      setCommentarySource("rules");
      setCommentaryNote("Agent pipeline ready — checking model…");
      setCommentaryLoading(true);

      try {
        const facts = buildCommentaryFacts(hostId, insight, match);
        const response = await fetch("/api/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts }),
          signal: controller.signal,
        });

        if (!response.ok) throw new Error(`Commentary API ${response.status}`);

        const data = (await response.json()) as CommentaryResponseBody;
        if (cancelled) return;

        // Keep personalization layer on top of host/model draft.
        const blended =
          viewMode === "casual" || viewMode === "analyst"
            ? `${data.commentary}`
            : localCommentary;

        setCommentary(viewMode === "casual" ? data.commentary : blended);
        if (viewMode !== "casual" && viewMode !== "analyst") {
          setCommentary(localCommentary);
          setCommentarySource("rules");
          setCommentaryNote(
            `Personalization mode "${viewMode}" applied on the agent board.`,
          );
        } else {
          setCommentary(data.commentary);
          setCommentarySource(data.source);
          setCommentaryNote(data.note);
        }
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        setCommentary(localCommentary);
        setCommentarySource("rules");
        setCommentaryNote("Using multi-agent rules narrative.");
      } finally {
        if (!cancelled) setCommentaryLoading(false);
      }
    }, delayMs);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostId, insight.id, viewMode, localCommentary]);

  function startMatch() {
    setShowRecap(false);
    setMatch((prev) => ({ ...prev, isRunning: true }));
  }

  function pauseMatch() {
    setMatch((prev) => ({ ...prev, isRunning: false }));
  }

  function resetMatch() {
    setShowRecap(false);
    setMatch(createInitialMatchState());
  }

  async function copyOverlay() {
    if (!overlay) return;
    await navigator.clipboard.writeText(JSON.stringify(overlay, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="mm-stadium">
      <div className="mm-shell">
        {/* Stadium hero: brand + LED scoreboard */}
        <header className="mm-hero">
          <div className="mm-brand-block">
            <p className="mm-live-chip">
              <span className="mm-live-dot" aria-hidden />
              {match.isRunning ? "Live match" : "Matchday studio"}
            </p>
            <h1 className="mm-brand">MatchMind AI</h1>
            <p className="mm-tagline">
              Live synthetic match intelligence with explainable insights and host commentary.
            </p>
          </div>

          <div className="mm-led" aria-live="polite">
            <div className="mm-led-top">
              <span>Stadium board</span>
              <span>{match.isRunning ? "In play" : "Kickoff ready"}</span>
            </div>
            <div className="mm-led-grid">
              <div className="mm-led-club">
                <span className="mm-kit" style={{ background: HOME_TEAM.color }} />
                <span className="mm-led-name">{HOME_TEAM.shortName}</span>
              </div>
              <div className="mm-led-score">
                <strong>
                  {match.score.home}-{match.score.away}
                </strong>
                <span className="mm-led-clock">
                  {formatClock(match.minute, match.second)}
                </span>
              </div>
              <div className="mm-led-club is-away">
                <span className="mm-kit" style={{ background: AWAY_TEAM.color }} />
                <span className="mm-led-name">{AWAY_TEAM.shortName}</span>
              </div>
            </div>
            <div className="mm-controls">
              {!match.isRunning ? (
                <button type="button" className="mm-btn mm-btn-primary" onClick={startMatch}>
                  Kick off
                </button>
              ) : (
                <button type="button" className="mm-btn" onClick={pauseMatch}>
                  Pause
                </button>
              )}
              <button type="button" className="mm-btn" onClick={resetMatch}>
                Full time reset
              </button>
              <button
                type="button"
                className="mm-btn"
                onClick={() => setShowRecap((v) => !v)}
              >
                {showRecap ? "Hide recap" : "Match recap"}
              </button>
              <button
                type="button"
                className="mm-btn"
                onClick={() => setShowAgents((v) => !v)}
              >
                {showAgents ? "Hide agents" : "Agents"}
              </button>
            </div>
          </div>
        </header>

        {/* Pitch with SVG players (reference-style tactical board) */}
        <section className="mm-pitch-wrap" aria-label="Live pitch view">
          <div className="mm-pitch-frame">
            <div className="mm-pitch">
              <svg
                className="mm-pitch-svg"
                viewBox="0 0 160 70"
                preserveAspectRatio="none"
                role="img"
                aria-label="Football pitch with players"
              >
                <defs>
                  {/* Mowed grass stripes */}
                  <pattern id="mm-turf" width="8" height="70" patternUnits="userSpaceOnUse">
                    <rect width="4" height="70" fill="#2f8f3a" />
                    <rect x="4" width="4" height="70" fill="#4cba58" />
                  </pattern>
                  <marker
                    id="mm-pass-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="#5c3d1e" />
                  </marker>
                </defs>

                {/* Full turf — always green, never team-colour bands */}
                <rect x="0" y="0" width="160" height="70" fill="url(#mm-turf)" />

                {/* Chalk lines */}
                <g fill="none" stroke="white" strokeWidth="1.2" opacity="0.95">
                  <rect x="2" y="2" width="156" height="66" />
                  <line x1="80" y1="2" x2="80" y2="68" />
                  <circle cx="80" cy="35" r="9.5" />
                  <circle cx="80" cy="35" r="1" fill="white" stroke="none" />
                  <rect x="2" y="14" width="22" height="42" />
                  <rect x="2" y="24" width="8" height="22" />
                  <circle cx="18" cy="35" r="0.9" fill="white" stroke="none" />
                  <path d="M 24 27 A 8 8 0 0 1 24 43" />
                  <rect x="136" y="14" width="22" height="42" />
                  <rect x="150" y="24" width="8" height="22" />
                  <circle cx="142" cy="35" r="0.9" fill="white" stroke="none" />
                  <path d="M 136 27 A 8 8 0 0 0 136 43" />
                </g>

                {/* Pass / interaction arrow from previous event player → current */}
                {pitchScene.passArrow && (
                  <g>
                    <line
                      x1={pitchScene.passArrow.fromX}
                      y1={pitchScene.passArrow.fromY}
                      x2={pitchScene.passArrow.toX}
                      y2={pitchScene.passArrow.toY}
                      stroke="#5c3d1e"
                      strokeWidth="1.1"
                      markerEnd="url(#mm-pass-arrow)"
                      opacity="0.9"
                    />
                    <text
                      x={(pitchScene.passArrow.fromX + pitchScene.passArrow.toX) / 2}
                      y={(pitchScene.passArrow.fromY + pitchScene.passArrow.toY) / 2 - 2.5}
                      textAnchor="middle"
                      fill="#1a1203"
                      fontSize="3.2"
                      fontWeight="700"
                      style={{ fontFamily: "var(--font-score), sans-serif" }}
                    >
                      {pitchScene.passArrow.label}
                    </text>
                  </g>
                )}

                {/* Numbered player circles — home blue, away red, GK yellow like reference */}
                {pitchScene.players.map((player) => (
                  <g key={player.id} className="mm-player-svg">
                    {player.isActive && (
                      <circle
                        cx={player.x}
                        cy={player.y}
                        r="4.2"
                        fill="none"
                        stroke="#ffe14a"
                        strokeWidth="1.1"
                        opacity="0.95"
                      />
                    )}
                    <circle
                      cx={player.x}
                      cy={player.y}
                      r="3.1"
                      fill={player.isGk ? "#f5d76e" : player.color}
                      stroke="#ffffff"
                      strokeWidth="0.7"
                    />
                    <text
                      x={player.x}
                      y={player.y + 1.15}
                      textAnchor="middle"
                      fill={player.isGk ? "#1a1203" : "#ffffff"}
                      fontSize="3.1"
                      fontWeight="700"
                      style={{ fontFamily: "var(--font-score), sans-serif" }}
                    >
                      {player.number}
                    </text>
                    {player.hasBall && (
                      <text
                        x={player.x}
                        y={player.y - 4.6}
                        textAnchor="middle"
                        fill="#1a1203"
                        fontSize="2.8"
                        fontWeight="700"
                        style={{ fontFamily: "var(--font-score), sans-serif" }}
                      >
                        {player.name.split(" ").slice(-1)[0]}
                      </text>
                    )}
                  </g>
                ))}

                {/* Ball near active player */}
                <circle
                  cx={pitchScene.ball.x}
                  cy={pitchScene.ball.y}
                  r="1.35"
                  fill="#f5f5f5"
                  stroke="#222"
                  strokeWidth="0.45"
                />
                <circle cx={pitchScene.ball.x} cy={pitchScene.ball.y} r="0.45" fill="#222" />
              </svg>
            </div>
          </div>
          <div className="mm-pitch-caption">
            <span className="mm-end-label">
              <span className="mm-end-pip" style={{ background: HOME_TEAM.color }} />
              {HOME_TEAM.name}
            </span>
            <span>
              {pitchScene.activeName
                ? `On ball: ${pitchScene.activeName}`
                : `Possession ${possession.home}% – ${possession.away}%`}
              {" · "}
              tempo {board.tempo}
            </span>
            <span className="mm-end-label">
              {AWAY_TEAM.name}
              <span className="mm-end-pip" style={{ background: AWAY_TEAM.color }} />
            </span>
          </div>
        </section>

        {/* Compact agent rail — details only when expanded */}
        <section className="mm-agent-rail" aria-label="Multi-agent pipeline">
          <div className="mm-agent-chips">
            {board.steps.map((step, index) => (
              <span key={step.agentId} className="mm-agent-chip">
                <em>{index + 1}</em>
                {step.agentName.replace(" Agent", "")}
              </span>
            ))}
          </div>
          {showAgents && (
            <ul className="mm-agent-details">
              {board.steps.map((step) => (
                <li key={`${step.agentId}-detail`}>
                  <strong>{step.agentName}</strong>
                  <span>{step.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {showRecap && (
          <section className="mm-dugout mm-recap">
            <h2 className="mm-section-title">
              Match recap
              <span>{recap.moments.length} moments</span>
            </h2>
            <p className="mm-recap-headline">{recap.headline}</p>
            <ol className="mm-recap-list">
              {recap.moments.map((moment) => (
                <li key={`${moment.minute}-${moment.title}`}>
                  <strong>
                    {moment.minute}&apos; · {moment.title}
                  </strong>
                  <span>{moment.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="mm-broadcast">
          <div className="mm-stack">
            <section className="mm-dugout">
              <h2 className="mm-section-title">
                Match feed
                <span>{match.events.length} events</span>
              </h2>
              <ul className="mm-event-list">
                {match.events.length === 0 && (
                  <li className="mm-empty">
                    Hit kick off — passes, shots, and tackles will stream in like a live feed.
                  </li>
                )}
                {match.events.map((event) => {
                  const team = event.teamId === "home" ? HOME_TEAM : AWAY_TEAM;
                  return (
                    <li key={event.id} className="mm-event">
                      <span className="mm-event-time">{event.minute}&apos;</span>
                      <span
                        className="mm-event-tag"
                        style={{ ["--tag-accent" as string]: team.color }}
                      >
                        {EVENT_LABELS[event.type] ?? event.type}
                      </span>
                      <span className="mm-event-text">{event.description}</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="mm-dugout">
              <h2 className="mm-section-title">
                Match stats
                <span>Live totals</span>
              </h2>
              <div className="mm-stat-row">
                <span>{HOME_TEAM.shortName}</span>
                <div className="mm-bar">
                  <div
                    className="mm-bar-fill"
                    style={{ width: `${possession.home}%`, background: HOME_TEAM.color }}
                  />
                </div>
                <span>{AWAY_TEAM.shortName}</span>
              </div>
              <p className="mm-possession-label">
                Possession {possession.home}% – {possession.away}%
              </p>
              <StatTable match={match} />
            </section>
          </div>

          {/* Insight booth + personalization */}
          <section className="mm-booth">
            <h2 className="mm-section-title">
              Insight booth
              <span>
                {insight.minuteStart}&apos;–{insight.minuteEnd}&apos;
              </span>
            </h2>

            <article className="mm-insight">
              <h3>{insight.title}</h3>
              <p>
                <strong>What happened:</strong> {insight.whatHappened}
              </p>
              <p>
                <strong>Why it matters:</strong> {insight.whyItMatters}
              </p>
              <ul className="mm-evidence">
                {insight.evidence.slice(0, 4).map((item) => (
                  <li key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </li>
                ))}
              </ul>
            </article>

            <p className="mm-mode-label">Watching as</p>
            <div className="mm-modes" role="tablist" aria-label="Viewing mode">
              {VIEW_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={viewMode === mode.id}
                  className={`mm-mode ${viewMode === mode.id ? "is-active" : ""}`}
                  onClick={() => setViewMode(mode.id)}
                  title={mode.description}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            <div className="mm-hosts" role="tablist" aria-label="Host personality">
              {HOSTS.map((host) => (
                <button
                  key={host.id}
                  type="button"
                  role="tab"
                  aria-selected={hostId === host.id}
                  className={`mm-host ${hostId === host.id ? "is-active" : ""}`}
                  onClick={() => setHostId(host.id)}
                >
                  <strong>{host.name}</strong>
                  <span>{host.tagline}</span>
                </button>
              ))}
            </div>

            <div className="mm-commentary" aria-live="polite">
              <div className="mm-commentary-meta">
                <p className="mm-commentary-label">
                  On air · {activeHost.name} · {viewMode}
                </p>
                <span
                  className={`mm-source-badge ${
                    commentarySource === "ai" ? "is-ai" : "is-rules"
                  }`}
                >
                  {commentaryLoading
                    ? "Updating…"
                    : commentarySource === "ai"
                      ? "AI model"
                      : "Agent pipeline"}
                </span>
              </div>
              <p className="mm-commentary-text">{commentary || localCommentary}</p>
              <p className="mm-commentary-note">{commentaryNote ?? activeHost.style}</p>
            </div>

            <div className="mm-overlay-actions">
              <button
                type="button"
                className="mm-btn mm-btn-light"
                onClick={() => setShowOverlay((v) => !v)}
              >
                {showOverlay ? "Hide overlay JSON" : "Show overlay JSON"}
              </button>
              {overlay && (
                <button type="button" className="mm-btn mm-btn-light" onClick={copyOverlay}>
                  {copied ? "Copied" : "Copy overlay"}
                </button>
              )}
            </div>

            {showOverlay && overlay && (
              <pre className="mm-overlay-json">{JSON.stringify(overlay, null, 2)}</pre>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatTable({ match }: { match: MatchState }) {
  const rows: { label: string; home: number; away: number }[] = [
    { label: "Goals", home: match.stats.home.goals, away: match.stats.away.goals },
    { label: "Shots", home: match.stats.home.shots, away: match.stats.away.shots },
    {
      label: "On target",
      home: match.stats.home.shotsOnTarget,
      away: match.stats.away.shotsOnTarget,
    },
    {
      label: "Passes",
      home: match.stats.home.passCompleted,
      away: match.stats.away.passCompleted,
    },
    { label: "Tackles", home: match.stats.home.tackles, away: match.stats.away.tackles },
    { label: "Corners", home: match.stats.home.corners, away: match.stats.away.corners },
    {
      label: "Att. third",
      home: match.stats.home.attackingThirdEntries,
      away: match.stats.away.attackingThirdEntries,
    },
  ];

  return (
    <table className="mm-stats">
      <thead>
        <tr>
          <th>{HOME_TEAM.shortName}</th>
          <th>Stat</th>
          <th>{AWAY_TEAM.shortName}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td>{row.home}</td>
            <td>{row.label}</td>
            <td>{row.away}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
