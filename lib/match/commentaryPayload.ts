import type { HostId, MatchInsight } from "./types";

/** Verified facts sent to the model — nothing else may be invented. */
export interface CommentaryFacts {
  hostId: HostId;
  insight: {
    id: string;
    title: string;
    kind: MatchInsight["kind"];
    whatHappened: string;
    whyItMatters: string;
    minuteStart: number;
    minuteEnd: number;
    teamName: string | null;
    evidence: { label: string; value: string }[];
  };
  score: { home: number; away: number };
  possession: { home: number; away: number };
  teams: { home: string; away: string };
  clock: { minute: number; second: number };
}

export interface CommentaryRequestBody {
  facts: CommentaryFacts;
}

export type CommentarySource = "ai" | "rules";

export interface CommentaryResponseBody {
  commentary: string;
  source: CommentarySource;
  hostId: HostId;
  insightId: string;
  /** Human-readable note for the UI (e.g. fallback reason). */
  note?: string;
}

export function isHostId(value: unknown): value is HostId {
  return value === "blaze" || value === "raahi" || value === "tessa";
}

/** Lightweight shape check so the route rejects junk payloads. */
export function parseCommentaryRequest(
  body: unknown,
): { ok: true; facts: CommentaryFacts } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }

  const facts = (body as CommentaryRequestBody).facts;
  if (!facts || typeof facts !== "object") {
    return { ok: false, error: "Missing facts object." };
  }

  if (!isHostId(facts.hostId)) {
    return { ok: false, error: "Invalid hostId." };
  }

  if (!facts.insight || typeof facts.insight !== "object") {
    return { ok: false, error: "Missing insight." };
  }

  if (typeof facts.insight.whatHappened !== "string") {
    return { ok: false, error: "Insight is incomplete." };
  }

  return { ok: true, facts: facts as CommentaryFacts };
}
