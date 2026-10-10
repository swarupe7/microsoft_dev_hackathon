import { possessionPercents } from "@/lib/match/engine";
import type { TeamId } from "@/lib/match/types";
import type { AgentBoard, AgentStepLog } from "./types";

/**
 * Agent 2 — Tactical State
 * Turns event stream + stats into control / pressure / tempo labels.
 */
export function runTacticalState(board: AgentBoard): AgentBoard {
  const possession = possessionPercents(board.match);
  const minute = board.match.minute;

  const homeBursts = board.match.recentAttackingBursts.filter(
    (b) => b.teamId === "home" && minute - b.minute <= 8,
  ).length;
  const awayBursts = board.match.recentAttackingBursts.filter(
    (b) => b.teamId === "away" && minute - b.minute <= 8,
  ).length;

  let pressureTeam: TeamId | null = null;
  if (homeBursts >= 4 && homeBursts > awayBursts + 1) pressureTeam = "home";
  if (awayBursts >= 4 && awayBursts > homeBursts + 1) pressureTeam = "away";

  let controlTeam: TeamId | null = null;
  if (Math.abs(possession.home - possession.away) >= 12) {
    controlTeam = possession.home > possession.away ? "home" : "away";
  }

  const recentShots = board.normalizedEvents.filter((e) =>
    e.type === "shot" || e.type === "shot_on_target" || e.type === "goal",
  ).length;
  const tempo =
    recentShots >= 3 ? "chaotic" : recentShots === 0 ? "slow" : "balanced";

  const step: AgentStepLog = {
    agentId: "tactical_state",
    agentName: "Tactical State",
    status: "ok",
    summary: `Control=${controlTeam ?? "shared"}, pressure=${pressureTeam ?? "none"}, tempo=${tempo}, possession ${possession.home}/${possession.away}.`,
    outputKeys: ["controlTeam", "pressureTeam", "tempo", "possession"],
  };

  return {
    ...board,
    possession,
    controlTeam,
    pressureTeam,
    tempo,
    steps: [...board.steps, step],
  };
}
