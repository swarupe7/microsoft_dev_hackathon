import { getTeam } from "./teams";
import type {
  EventType,
  MatchEvent,
  MatchState,
  TeamId,
  TeamStats,
  Zone,
} from "./types";

/** Empty counters for one side at kickoff. */
export function createEmptyStats(): TeamStats {
  return {
    possessionSeconds: 0,
    passes: 0,
    passCompleted: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    tackles: 0,
    fouls: 0,
    corners: 0,
    attackingThirdEntries: 0,
  };
}

/** Fresh match state before kickoff. */
export function createInitialMatchState(): MatchState {
  return {
    minute: 0,
    second: 0,
    isRunning: false,
    possession: "home",
    score: { home: 0, away: 0 },
    events: [],
    stats: {
      home: createEmptyStats(),
      away: createEmptyStats(),
    },
    recentAttackingBursts: [],
  };
}

/** Simple seeded-looking random helper (not cryptographic). */
function chance(probability: number): boolean {
  return Math.random() < probability;
}

function pickPlayer(teamId: TeamId, preferAttack?: boolean) {
  const team = getTeam(teamId);
  const pool = preferAttack
    ? team.players.filter((p) => p.position === "MID" || p.position === "FWD")
    : team.players.filter((p) => p.position !== "GK");
  const list = pool.length > 0 ? pool : team.players;
  return list[Math.floor(Math.random() * list.length)];
}

function pickZone(type: EventType): Zone {
  if (type === "shot" || type === "shot_on_target" || type === "goal" || type === "corner") {
    return "attacking";
  }
  if (type === "tackle" || type === "foul") {
    return chance(0.5) ? "midfield" : "defensive";
  }
  if (chance(0.35)) return "attacking";
  if (chance(0.5)) return "midfield";
  return "defensive";
}

function eventDescription(
  type: EventType,
  playerName: string,
  teamName: string,
  zone: Zone,
): string {
  switch (type) {
    case "pass":
      return `${playerName} completes a ${zone} pass for ${teamName}.`;
    case "shot":
      return `${playerName} shoots from the ${zone} third — wide.`;
    case "shot_on_target":
      return `${playerName} forces a save with a shot on target.`;
    case "goal":
      return `GOAL! ${playerName} finds the net for ${teamName}.`;
    case "tackle":
      return `${playerName} wins the ball with a clean tackle.`;
    case "foul":
      return `${playerName} concedes a foul in the ${zone} third.`;
    case "corner":
      return `${teamName} win a corner after pressure in the box.`;
    case "possession_change":
      return `${teamName} regain possession through ${playerName}.`;
    default:
      return `${playerName} is involved in play.`;
  }
}

/** Choose the next synthetic event type from current possession context. */
function chooseEventType(state: MatchState): EventType {
  const inAttack = chance(0.42);
  if (inAttack) {
    if (chance(0.08)) return "goal";
    if (chance(0.22)) return "shot_on_target";
    if (chance(0.35)) return "shot";
    if (chance(0.25)) return "corner";
  }

  if (chance(0.12)) return "tackle";
  if (chance(0.08)) return "foul";
  if (chance(0.1)) return "possession_change";
  return "pass";
}

/** Apply one event onto stats/score (deterministic from the event fields). */
function applyEventToState(state: MatchState, event: MatchEvent): MatchState {
  const next: MatchState = {
    ...state,
    score: { ...state.score },
    stats: {
      home: { ...state.stats.home },
      away: { ...state.stats.away },
    },
    events: [event, ...state.events].slice(0, 80),
    recentAttackingBursts: [...state.recentAttackingBursts],
  };

  const teamStats = next.stats[event.teamId];
  const otherId: TeamId = event.teamId === "home" ? "away" : "home";

  switch (event.type) {
    case "pass":
      teamStats.passes += 1;
      teamStats.passCompleted += 1;
      if (event.zone === "attacking") {
        teamStats.attackingThirdEntries += 1;
        next.recentAttackingBursts.push({
          teamId: event.teamId,
          minute: event.minute,
        });
      }
      break;
    case "shot":
      teamStats.shots += 1;
      teamStats.attackingThirdEntries += 1;
      next.recentAttackingBursts.push({
        teamId: event.teamId,
        minute: event.minute,
      });
      break;
    case "shot_on_target":
      teamStats.shots += 1;
      teamStats.shotsOnTarget += 1;
      teamStats.attackingThirdEntries += 1;
      next.recentAttackingBursts.push({
        teamId: event.teamId,
        minute: event.minute,
      });
      break;
    case "goal":
      teamStats.shots += 1;
      teamStats.shotsOnTarget += 1;
      teamStats.goals += 1;
      next.score[event.teamId] += 1;
      teamStats.attackingThirdEntries += 1;
      next.recentAttackingBursts.push({
        teamId: event.teamId,
        minute: event.minute,
      });
      break;
    case "tackle":
      teamStats.tackles += 1;
      next.possession = event.teamId;
      break;
    case "foul":
      teamStats.fouls += 1;
      next.possession = otherId;
      break;
    case "corner":
      teamStats.corners += 1;
      teamStats.attackingThirdEntries += 1;
      break;
    case "possession_change":
      next.possession = event.teamId;
      break;
    default:
      break;
  }

  // Keep only recent bursts for pressure detection (last ~8 minutes of match time).
  next.recentAttackingBursts = next.recentAttackingBursts.filter(
    (burst) => event.minute - burst.minute <= 8,
  );

  return next;
}

/**
 * Advance the clock by one second of simulated time and maybe emit an event.
 * Call this from the UI on an interval while the match is running.
 */
export function tickMatch(state: MatchState): MatchState {
  if (!state.isRunning) return state;

  // Advance match clock (1 real tick ≈ 1 match second for a snappy demo).
  let { minute, second } = state;
  second += 1;
  if (second >= 60) {
    second = 0;
    minute += 1;
  }

  // Full-time stop for the prototype.
  if (minute >= 90) {
    return {
      ...state,
      minute: 90,
      second: 0,
      isRunning: false,
    };
  }

  let next: MatchState = {
    ...state,
    minute,
    second,
    stats: {
      home: { ...state.stats.home },
      away: { ...state.stats.away },
    },
  };

  // Possession clock accumulates every second.
  next.stats[next.possession].possessionSeconds += 1;

  // Emit an on-ball event roughly every 2–4 seconds of match time.
  const shouldEmit = second % 3 === 0 || chance(0.2);
  if (!shouldEmit) return next;

  const type = chooseEventType(next);
  let teamId: TeamId = next.possession;

  // Tackles / possession changes often belong to the defending side.
  if (type === "tackle" || type === "possession_change") {
    teamId = next.possession === "home" ? "away" : "home";
  }

  const player = pickPlayer(
    teamId,
    type === "shot" || type === "shot_on_target" || type === "goal",
  );
  const zone = pickZone(type);
  const team = getTeam(teamId);

  const event: MatchEvent = {
    id: `evt-${minute}-${second}-${Math.random().toString(36).slice(2, 8)}`,
    minute,
    second,
    type,
    teamId,
    playerId: player.id,
    playerName: player.name,
    zone,
    description: eventDescription(type, player.name, team.name, zone),
  };

  return applyEventToState(next, event);
}

/** Possession share as whole percentages that sum to 100 when both have time. */
export function possessionPercents(state: MatchState): {
  home: number;
  away: number;
} {
  const home = state.stats.home.possessionSeconds;
  const away = state.stats.away.possessionSeconds;
  const total = home + away;
  if (total === 0) return { home: 50, away: 50 };
  const homePct = Math.round((home / total) * 100);
  return { home: homePct, away: 100 - homePct };
}
