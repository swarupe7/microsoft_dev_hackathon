import { narrateInsight } from "@/lib/match/hosts";
import type { AgentBoard, AgentStepLog } from "./types";

/**
 * Agent 4 — Narrative
 * Rewrites the verified insight in the selected host personality voice.
 */
export function runNarrativeAgent(board: AgentBoard): AgentBoard {
  if (!board.insight) {
    const step: AgentStepLog = {
      agentId: "narrative",
      agentName: "Narrative Agent",
      status: "skipped",
      summary: "No insight on the board — skipped host narration.",
      outputKeys: [],
    };
    return { ...board, hostNarrative: "", steps: [...board.steps, step] };
  }

  const hostNarrative = narrateInsight(board.hostId, board.insight, board.match);

  const step: AgentStepLog = {
    agentId: "narrative",
    agentName: "Narrative Agent",
    status: "ok",
    summary: `Host ${board.hostId} wrote ${hostNarrative.split(" ").length} words from verified insight only.`,
    outputKeys: ["hostNarrative"],
  };

  return {
    ...board,
    hostNarrative,
    steps: [...board.steps, step],
  };
}
