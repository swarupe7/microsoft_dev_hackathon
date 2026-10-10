import type { HostId, MatchInsight, MatchState, TeamId } from "@/lib/match/types";

/** Ordered agent roles in the MatchMind pipeline. */
export type AgentId =
  | "event_analyst"
  | "tactical_state"
  | "insight"
  | "narrative"
  | "personalization";

export type ViewModeId =
  | "analyst"
  | "casual"
  | "club_home"
  | "club_away"
  | "player";

export interface ViewMode {
  id: ViewModeId;
  label: string;
  description: string;
}

export interface AgentStepLog {
  agentId: AgentId;
  agentName: string;
  status: "ok" | "skipped" | "error";
  summary: string;
  outputKeys: string[];
}

/** Shared blackboard the agents read/write (handoff contract). */
export interface AgentBoard {
  match: MatchState;
  hostId: HostId;
  viewMode: ViewModeId;
  focusPlayerId: string | null;
  /** Event Analyst */
  normalizedEvents: {
    id: string;
    minute: number;
    type: string;
    teamId: TeamId;
    playerName: string;
    zone: string;
  }[];
  latestEventId: string | null;
  /** Tactical State */
  controlTeam: TeamId | null;
  pressureTeam: TeamId | null;
  tempo: "slow" | "balanced" | "chaotic";
  possession: { home: number; away: number };
  /** Insight */
  insight: MatchInsight | null;
  /** Narrative (host voice, pre-personalization) */
  hostNarrative: string;
  /** Personalization (final audience copy) */
  personalizedNarrative: string;
  /** Trace */
  steps: AgentStepLog[];
}

/** Broadcast overlay packet — timed + machine-readable. */
export interface OverlayPacket {
  version: "1.0";
  producedAt: string;
  matchClock: { minute: number; second: number };
  score: { home: number; away: number };
  insight: {
    id: string;
    kind: string;
    title: string;
    whatHappened: string;
    whyItMatters: string;
    minuteStart: number;
    minuteEnd: number;
    teamId: TeamId | null;
    evidence: { label: string; value: string }[];
  };
  narrative: {
    hostId: HostId;
    viewMode: ViewModeId;
    text: string;
  };
  graphics: {
    headline: string;
    subline: string;
    accentTeam: TeamId | null;
    lowerThird: string;
  };
  agentTrace: { agentId: AgentId; summary: string }[];
}

export interface RecapMoment {
  minute: number;
  title: string;
  detail: string;
  teamId: TeamId | null;
  kind: "goal" | "pressure" | "momentum" | "milestone";
}

export interface MatchRecap {
  finalScore: { home: number; away: number };
  minutesPlayed: number;
  headline: string;
  moments: RecapMoment[];
  summary: string;
}
