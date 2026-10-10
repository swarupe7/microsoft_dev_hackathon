import type { HostId, MatchState } from "@/lib/match/types";
import { runEventAnalyst } from "./eventAnalyst";
import { runInsightAgent } from "./insightAgent";
import { runNarrativeAgent } from "./narrativeAgent";
import { runPersonalizationAgent } from "./personalizationAgent";
import { runTacticalState } from "./tacticalState";
import type { AgentBoard, ViewModeId } from "./types";

export interface RunPipelineInput {
  match: MatchState;
  hostId: HostId;
  viewMode: ViewModeId;
  focusPlayerId?: string | null;
}

/** Empty shared board before the first agent writes. */
function createBoard(input: RunPipelineInput): AgentBoard {
  return {
    match: input.match,
    hostId: input.hostId,
    viewMode: input.viewMode,
    focusPlayerId: input.focusPlayerId ?? null,
    normalizedEvents: [],
    latestEventId: null,
    controlTeam: null,
    pressureTeam: null,
    tempo: "balanced",
    possession: { home: 50, away: 50 },
    insight: null,
    hostNarrative: "",
    personalizedNarrative: "",
    steps: [],
  };
}

/**
 * Multi-agent pipeline with explicit handoffs on a shared board:
 * Event Analyst → Tactical State → Insight → Narrative → Personalization
 */
export function runMatchMindPipeline(input: RunPipelineInput): AgentBoard {
  let board = createBoard(input);

  // Each agent reads prior outputs and appends its own step log.
  board = runEventAnalyst(board);
  board = runTacticalState(board);
  board = runInsightAgent(board);
  board = runNarrativeAgent(board);
  board = runPersonalizationAgent(board);

  return board;
}
