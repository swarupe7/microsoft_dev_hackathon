import type { AgentBoard, AgentStepLog } from "./types";

/**
 * Agent 1 — Event Analyst
 * Normalizes the latest synthetic events into a clean handoff list.
 */
export function runEventAnalyst(board: AgentBoard): AgentBoard {
  const normalized = board.match.events.slice(0, 12).map((event) => ({
    id: event.id,
    minute: event.minute,
    type: event.type,
    teamId: event.teamId,
    playerName: event.playerName,
    zone: event.zone,
  }));

  const step: AgentStepLog = {
    agentId: "event_analyst",
    agentName: "Event Analyst",
    status: "ok",
    summary:
      normalized.length === 0
        ? "No events yet — waiting for kickoff stream."
        : `Normalized ${normalized.length} recent events. Latest: ${normalized[0].type} by ${normalized[0].playerName}.`,
    outputKeys: ["normalizedEvents", "latestEventId"],
  };

  return {
    ...board,
    normalizedEvents: normalized,
    latestEventId: normalized[0]?.id ?? null,
    steps: [...board.steps, step],
  };
}
