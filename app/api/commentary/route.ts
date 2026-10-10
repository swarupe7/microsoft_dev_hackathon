import { generateCommentary, isAiCommentaryConfigured } from "@/lib/ai/generateCommentary";
import { parseCommentaryRequest } from "@/lib/match/commentaryPayload";

/** Health/status helper so the UI can show whether AI is configured. */
export async function GET() {
  return Response.json({
    ok: true,
    aiConfigured: isAiCommentaryConfigured(),
    message: isAiCommentaryConfigured()
      ? "AI commentary endpoint ready."
      : "AI credentials missing — POST will use rule-based fallback.",
  });
}

/**
 * POST verified match facts; returns personality commentary.
 * Never trusts the model as a source of new match events or stats.
 */
export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseCommentaryRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  const result = await generateCommentary(parsed.facts);

  return Response.json({
    commentary: result.commentary,
    source: result.source,
    hostId: parsed.facts.hostId,
    insightId: parsed.facts.insight.id,
    note: result.note,
  });
}
