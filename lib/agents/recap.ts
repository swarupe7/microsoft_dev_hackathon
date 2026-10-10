import { getTeam } from "@/lib/match/teams";
import type { MatchEvent, MatchState } from "@/lib/match/types";
import type { MatchRecap, RecapMoment } from "./types";

/**
 * Build an automated match recap from verified events only (5–8 moments).
 */
export function buildMatchRecap(match: MatchState): MatchRecap {
  const moments: RecapMoment[] = [];

  // Goals first — highest narrative value.
  const goals = [...match.events]
    .filter((e) => e.type === "goal")
    .sort((a, b) => a.minute - b.minute);

  for (const goal of goals.slice(0, 4)) {
    moments.push(momentFromGoal(goal));
  }

  // Shot clusters / pressure snapshots if we still need slots.
  if (moments.length < 5) {
    const shots = match.events.filter(
      (e) => e.type === "shot" || e.type === "shot_on_target",
    );
    if (shots.length >= 3) {
      const last = shots[0];
      moments.push({
        minute: last.minute,
        title: "Chance flurry",
        detail: `${getTeam(last.teamId).name} forced multiple shots — tempo spiked.`,
        teamId: last.teamId,
        kind: "pressure",
      });
    }
  }

  if (moments.length < 6) {
    const tackles = match.events.filter((e) => e.type === "tackle");
    if (tackles.length >= 4) {
      const last = tackles[0];
      moments.push({
        minute: last.minute,
        title: "Defensive stand",
        detail: `${last.playerName} led a wave of recoveries for ${getTeam(last.teamId).name}.`,
        teamId: last.teamId,
        kind: "milestone",
      });
    }
  }

  // Possession milestone from final stats.
  if (moments.length < 7) {
    const homePoss = match.stats.home.possessionSeconds;
    const awayPoss = match.stats.away.possessionSeconds;
    const total = homePoss + awayPoss;
    if (total > 0) {
      const homePct = Math.round((homePoss / total) * 100);
      const lead = homePct >= 55 ? "home" : homePct <= 45 ? "away" : null;
      if (lead) {
        moments.push({
          minute: match.minute,
          title: "Possession story",
          detail: `${getTeam(lead).name} finished with the clearer share of the ball.`,
          teamId: lead,
          kind: "momentum",
        });
      }
    }
  }

  // Ensure at least a kickoff / status moment.
  if (moments.length === 0) {
    moments.push({
      minute: 0,
      title: "Match underway",
      detail: "Waiting for decisive moments — start or continue the simulation.",
      teamId: null,
      kind: "milestone",
    });
  }

  const trimmed = moments.slice(0, 8);
  const home = match.score.home;
  const away = match.score.away;
  const headline =
    home === away
      ? `Level at ${home}–${away}`
      : home > away
        ? `Northbridge edge it ${home}–${away}`
        : `Riverton edge it ${away}–${home}`;

  const summary = trimmed
    .map((m) => `${m.minute}' ${m.title}: ${m.detail}`)
    .join(" ");

  return {
    finalScore: { home, away },
    minutesPlayed: match.minute,
    headline,
    moments: trimmed,
    summary,
  };
}

function momentFromGoal(goal: MatchEvent): RecapMoment {
  return {
    minute: goal.minute,
    title: `Goal — ${goal.playerName}`,
    detail: `${getTeam(goal.teamId).name} strike at ${goal.minute}'.`,
    teamId: goal.teamId,
    kind: "goal",
  };
}
