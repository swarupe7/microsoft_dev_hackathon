import { buildOverlayPacket, runMatchMindPipeline } from "@/lib/agents";
import type { ViewModeId } from "@/lib/agents";
import { isHostId } from "@/lib/match/commentaryPayload";
import type { MatchState } from "@/lib/match/types";

/**
 * POST current match snapshot → machine-readable broadcast overlay JSON.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = body as {
    match?: MatchState;
    hostId?: string;
    viewMode?: ViewModeId;
    focusPlayerId?: string | null;
  };

  if (!payload.match || !isHostId(payload.hostId)) {
    return Response.json(
      { error: "Requires match state and a valid hostId." },
      { status: 400 },
    );
  }

  const viewMode = payload.viewMode ?? "casual";
  const board = runMatchMindPipeline({
    match: payload.match,
    hostId: payload.hostId,
    viewMode,
    focusPlayerId: payload.focusPlayerId ?? null,
  });

  const overlay = buildOverlayPacket(board);
  if (!overlay) {
    return Response.json(
      { error: "No insight available to package as overlay yet." },
      { status: 422 },
    );
  }

  return Response.json({ overlay, agentSteps: board.steps });
}
