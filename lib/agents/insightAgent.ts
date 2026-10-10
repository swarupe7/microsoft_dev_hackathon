import { deriveInsight } from "@/lib/match/insights";
import type { AgentBoard, AgentStepLog } from "./types";

/**
 * Agent 3 — Insight
 * Produces explainable "what / why / evidence" from verified state only.
 */
export function runInsightAgent(board: AgentBoard): AgentBoard {
  const insight = deriveInsight(board.match);

  const step: AgentStepLog = {
    agentId: "insight",
    agentName: "Insight Agent",
    status: "ok",
    summary: `${insight.title} (${insight.kind}) with ${insight.evidence.length} evidence points.`,
    outputKeys: ["insight"],
  };

  return {
    ...board,
    insight,
    steps: [...board.steps, step],
  };
}
