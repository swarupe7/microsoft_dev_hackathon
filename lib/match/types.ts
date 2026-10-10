/** Shared types for the synthetic match engine and UI. */

export type TeamId = "home" | "away";

export type EventType =
  | "pass"
  | "shot"
  | "shot_on_target"
  | "goal"
  | "tackle"
  | "foul"
  | "corner"
  | "possession_change";

export type Zone = "defensive" | "midfield" | "attacking";

export interface Player {
  id: string;
  name: string;
  teamId: TeamId;
  position: "GK" | "DEF" | "MID" | "FWD";
}

export interface Team {
  id: TeamId;
  name: string;
  shortName: string;
  color: string;
  players: Player[];
}

export interface MatchEvent {
  id: string;
  minute: number;
  second: number;
  type: EventType;
  teamId: TeamId;
  playerId: string;
  playerName: string;
  zone: Zone;
  description: string;
}

export interface TeamStats {
  possessionSeconds: number;
  passes: number;
  passCompleted: number;
  shots: number;
  shotsOnTarget: number;
  goals: number;
  tackles: number;
  fouls: number;
  corners: number;
  attackingThirdEntries: number;
}

export interface MatchState {
  minute: number;
  second: number;
  isRunning: boolean;
  possession: TeamId;
  score: { home: number; away: number };
  events: MatchEvent[];
  stats: { home: TeamStats; away: TeamStats };
  recentAttackingBursts: { teamId: TeamId; minute: number }[];
}

export type HostId = "blaze" | "raahi" | "tessa";

export interface InsightEvidence {
  label: string;
  value: string;
}

export interface MatchInsight {
  id: string;
  title: string;
  whatHappened: string;
  whyItMatters: string;
  minuteStart: number;
  minuteEnd: number;
  evidence: InsightEvidence[];
  teamId: TeamId | null;
  kind: "pressure" | "momentum" | "goal" | "balance" | "idle";
}

export interface HostPersonality {
  id: HostId;
  name: string;
  tagline: string;
  style: string;
}
