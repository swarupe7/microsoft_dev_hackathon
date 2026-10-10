import type { AgentBoard, OverlayPacket } from "./types";

/**
 * Build a timed, machine-readable overlay packet for broadcast graphics.
 * Only uses verified board fields — never invents stats.
 */
export function buildOverlayPacket(board: AgentBoard): OverlayPacket | null {
  if (!board.insight) return null;

  const insight = board.insight;
  const teamLabel =
    insight.teamId === "home"
      ? "NOR"
      : insight.teamId === "away"
        ? "RIV"
        : "MATCH";

  // Use match clock (not wall-clock Date) so SSR/prerender stays deterministic.
  const producedAt = `match-${board.match.minute}:${String(board.match.second).padStart(2, "0")}`;

  return {
    version: "1.0",
    producedAt,
    matchClock: {
      minute: board.match.minute,
      second: board.match.second,
    },
    score: { ...board.match.score },
    insight: {
      id: insight.id,
      kind: insight.kind,
      title: insight.title,
      whatHappened: insight.whatHappened,
      whyItMatters: insight.whyItMatters,
      minuteStart: insight.minuteStart,
      minuteEnd: insight.minuteEnd,
      teamId: insight.teamId,
      evidence: insight.evidence,
    },
    narrative: {
      hostId: board.hostId,
      viewMode: board.viewMode,
      text: board.personalizedNarrative || board.hostNarrative,
    },
    graphics: {
      headline: insight.title.toUpperCase(),
      subline: insight.whatHappened,
      accentTeam: insight.teamId,
      lowerThird: `${teamLabel} · ${insight.minuteEnd}' · ${board.viewMode}`,
    },
    agentTrace: board.steps.map((step) => ({
      agentId: step.agentId,
      summary: step.summary,
    })),
  };
}
