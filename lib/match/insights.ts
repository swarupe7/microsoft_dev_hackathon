import { getTeam } from "./teams";
import { possessionPercents } from "./engine";
import type { MatchInsight, MatchState, TeamId } from "./types";

/** Count attacking bursts for a team inside a minute window. */
function burstsInWindow(
  state: MatchState,
  teamId: TeamId,
  windowMinutes: number,
): number {
  const start = Math.max(0, state.minute - windowMinutes);
  return state.recentAttackingBursts.filter(
    (b) => b.teamId === teamId && b.minute >= start,
  ).length;
}

function shotsInWindow(state: MatchState, teamId: TeamId, windowMinutes: number): number {
  const start = Math.max(0, state.minute - windowMinutes);
  return state.events.filter(
    (e) =>
      e.teamId === teamId &&
      e.minute >= start &&
      (e.type === "shot" || e.type === "shot_on_target" || e.type === "goal"),
  ).length;
}

function latestGoal(state: MatchState) {
  return state.events.find((e) => e.type === "goal") ?? null;
}

/**
 * Derive one explainable insight from verified match state only.
 * The AI hosts later rewrite this — they must not invent new stats.
 */
export function deriveInsight(state: MatchState): MatchInsight {
  const minuteEnd = state.minute;
  const minuteStart = Math.max(0, minuteEnd - 8);
  const poss = possessionPercents(state);

  // Priority 1: recent goal
  const goal = latestGoal(state);
  if (goal && state.minute - goal.minute <= 3) {
    const team = getTeam(goal.teamId);
    return {
      id: `insight-goal-${goal.id}`,
      title: "Goal Impact",
      kind: "goal",
      teamId: goal.teamId,
      minuteStart: goal.minute,
      minuteEnd,
      whatHappened: `${goal.playerName} scored for ${team.name} at ${goal.minute}'.`,
      whyItMatters:
        "The scoreline has changed, so both sides must adjust risk — the trailing team needs quicker progression, while the leading side can manage territory.",
      evidence: [
        { label: "Scorer", value: goal.playerName },
        {
          label: "Score",
          value: `${state.score.home}–${state.score.away}`,
        },
        { label: "Match time", value: `${goal.minute}:${String(goal.second).padStart(2, "0")}` },
        {
          label: "Shots on target (team)",
          value: String(state.stats[goal.teamId].shotsOnTarget),
        },
      ],
    };
  }

  // Priority 2: sustained pressure (attacking bursts + shots)
  const homeBursts = burstsInWindow(state, "home", 8);
  const awayBursts = burstsInWindow(state, "away", 8);
  const pressureTeam: TeamId | null =
    homeBursts >= 4 && homeBursts > awayBursts + 1
      ? "home"
      : awayBursts >= 4 && awayBursts > homeBursts + 1
        ? "away"
        : null;

  if (pressureTeam) {
    const team = getTeam(pressureTeam);
    const shots = shotsInWindow(state, pressureTeam, 8);
    const entries = state.stats[pressureTeam].attackingThirdEntries;
    return {
      id: `insight-pressure-${pressureTeam}-${minuteEnd}`,
      title: "Sustained Pressure",
      kind: "pressure",
      teamId: pressureTeam,
      minuteStart,
      minuteEnd,
      whatHappened: `${team.name} have stacked ${pressureTeam === "home" ? homeBursts : awayBursts} attacking sequences in the last 8 minutes.`,
      whyItMatters:
        "Repeated entries into the final third usually force the opponent deeper and raise the chance of a chance or set piece.",
      evidence: [
        {
          label: "Attacking sequences (8 min)",
          value: String(pressureTeam === "home" ? homeBursts : awayBursts),
        },
        { label: "Shots in window", value: String(shots) },
        { label: "Attacking-third entries", value: String(entries) },
        {
          label: "Possession",
          value: `${poss[pressureTeam]}%`,
        },
      ],
    };
  }

  // Priority 3: momentum / possession tilt
  if (Math.abs(poss.home - poss.away) >= 16 && state.minute >= 5) {
    const lead: TeamId = poss.home > poss.away ? "home" : "away";
    const team = getTeam(lead);
    return {
      id: `insight-momentum-${lead}-${minuteEnd}`,
      title: "Possession Momentum",
      kind: "momentum",
      teamId: lead,
      minuteStart,
      minuteEnd,
      whatHappened: `${team.name} are controlling the ball with ${poss[lead]}% possession.`,
      whyItMatters:
        "A clear possession gap often means better rest defence and more time to build progressive attacks — unless the opponent is happy to counter.",
      evidence: [
        { label: "Northbridge possession", value: `${poss.home}%` },
        { label: "Riverton possession", value: `${poss.away}%` },
        {
          label: "Completed passes (leader)",
          value: String(state.stats[lead].passCompleted),
        },
        {
          label: "Tackles (leader)",
          value: String(state.stats[lead].tackles),
        },
      ],
    };
  }

  // Priority 4: balanced / early match default (still evidence-backed)
  if (state.events.length === 0) {
    return {
      id: "insight-idle",
      title: "Waiting for Kickoff",
      kind: "idle",
      teamId: null,
      minuteStart: 0,
      minuteEnd: 0,
      whatHappened: "No verified match events yet.",
      whyItMatters:
        "Insights only appear after the engine records real synthetic events — the host never invents actions.",
      evidence: [
        { label: "Events logged", value: "0" },
        { label: "Score", value: "0–0" },
      ],
    };
  }

  return {
    id: `insight-balance-${minuteEnd}`,
    title: "Even Contest",
    kind: "balance",
    teamId: null,
    minuteStart,
    minuteEnd,
    whatHappened:
      "Neither side has produced a clear pressure spike or score change in the current window.",
    whyItMatters:
      "An even spell often precedes a momentum swing — watch for clusters of shots or attacking-third recoveries.",
    evidence: [
      { label: "Possession", value: `${poss.home}% – ${poss.away}%` },
      {
        label: "Total shots",
        value: `${state.stats.home.shots} – ${state.stats.away.shots}`,
      },
      {
        label: "Events in feed",
        value: String(state.events.length),
      },
      {
        label: "Window",
        value: `${minuteStart}'–${minuteEnd}'`,
      },
    ],
  };
}
