import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/lib/ai/commentaryPrompt";
import type { CommentaryFacts } from "@/lib/match/commentaryPayload";
import { narrateInsight } from "@/lib/match/hosts";
import type { MatchInsight, MatchState } from "@/lib/match/types";

export interface GenerateCommentaryResult {
  commentary: string;
  source: "ai" | "rules";
  note?: string;
}

interface ModelConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  /** Foundry often exposes .../openai/v1 — use that path style when present. */
  useV1Path: boolean;
}

/** Normalize portal-copied endpoints into a usable base URL. */
function normalizeEndpoint(raw: string): { endpoint: string; useV1Path: boolean } {
  let endpoint = raw.trim().replace(/\/$/, "");
  let useV1Path = false;

  if (endpoint.includes("/openai/v1")) {
    useV1Path = true;
    endpoint = endpoint.replace(/\/openai\/v1\/?$/, "");
  }

  // Classic Azure OpenAI host only — strip accidental path leftovers.
  endpoint = endpoint.replace(/\/openai\/?$/, "");

  return { endpoint, useV1Path };
}

/** Read Azure OpenAI / Foundry-compatible settings from the environment. */
function readModelConfig(): ModelConfig | null {
  const rawEndpoint =
    process.env.AZURE_OPENAI_ENDPOINT || process.env.FOUNDRY_ENDPOINT || "";
  const apiKey =
    process.env.AZURE_OPENAI_API_KEY || process.env.FOUNDRY_API_KEY || "";
  const deployment =
    process.env.AZURE_OPENAI_DEPLOYMENT ||
    process.env.FOUNDRY_DEPLOYMENT ||
    "";
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION || "2024-08-01-preview";

  if (!rawEndpoint || !apiKey || !deployment) return null;

  const { endpoint, useV1Path } = normalizeEndpoint(rawEndpoint);
  return { endpoint, apiKey, deployment, apiVersion, useV1Path };
}

/** Build a minimal MatchState so the rules narrator can reuse existing helpers. */
function factsToFallbackState(facts: CommentaryFacts): {
  insight: MatchInsight;
  state: MatchState;
} {
  const insight: MatchInsight = {
    id: facts.insight.id,
    title: facts.insight.title,
    kind: facts.insight.kind,
    whatHappened: facts.insight.whatHappened,
    whyItMatters: facts.insight.whyItMatters,
    minuteStart: facts.insight.minuteStart,
    minuteEnd: facts.insight.minuteEnd,
    teamId: null,
    evidence: facts.insight.evidence,
  };

  // Recover teamId from the focus team name when possible.
  if (facts.insight.teamName === facts.teams.home) insight.teamId = "home";
  if (facts.insight.teamName === facts.teams.away) insight.teamId = "away";

  const state: MatchState = {
    minute: facts.clock.minute,
    second: facts.clock.second,
    isRunning: false,
    possession: "home",
    score: { ...facts.score },
    events: [],
    stats: {
      home: {
        possessionSeconds: facts.possession.home,
        passes: 0,
        passCompleted: 0,
        shots: 0,
        shotsOnTarget: 0,
        goals: facts.score.home,
        tackles: 0,
        fouls: 0,
        corners: 0,
        attackingThirdEntries: 0,
      },
      away: {
        possessionSeconds: facts.possession.away,
        passes: 0,
        passCompleted: 0,
        shots: 0,
        shotsOnTarget: 0,
        goals: facts.score.away,
        tackles: 0,
        fouls: 0,
        corners: 0,
        attackingThirdEntries: 0,
      },
    },
    recentAttackingBursts: [],
  };

  return { insight, state };
}

export function rulesFallback(
  facts: CommentaryFacts,
  note?: string,
): GenerateCommentaryResult {
  const { insight, state } = factsToFallbackState(facts);
  return {
    commentary: narrateInsight(facts.hostId, insight, state),
    source: "rules",
    note,
  };
}

function buildRequest(config: ModelConfig, facts: CommentaryFacts): {
  url: string;
  body: Record<string, unknown>;
} {
  const messages = [
    { role: "system", content: buildSystemPrompt(facts) },
    { role: "user", content: buildUserPrompt(facts) },
  ];

  // gpt-5-mini expects max_completion_tokens (not max_tokens).
  // Keep a higher budget — some mini models spend tokens on internal reasoning first.
  const sharedBody = {
    messages,
    max_completion_tokens: 900,
  };

  // Newer Foundry "OpenAI v1" style endpoint.
  if (config.useV1Path) {
    return {
      url: `${config.endpoint}/openai/v1/chat/completions`,
      body: {
        ...sharedBody,
        model: config.deployment,
      },
    };
  }

  // Classic Azure OpenAI deployments path.
  return {
    url:
      `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}` +
      `/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`,
    body: {
      ...sharedBody,
      model: config.deployment,
    },
  };
}

/**
 * Call Azure OpenAI / Foundry chat completions when configured.
 * Always falls back to rule-based host text if the model is unavailable.
 */
export async function generateCommentary(
  facts: CommentaryFacts,
): Promise<GenerateCommentaryResult> {
  const config = readModelConfig();
  if (!config) {
    return rulesFallback(
      facts,
      "No Azure/Foundry credentials configured — using rule-based host.",
    );
  }

  const { url, body } = buildRequest(config, facts);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // Retry once with the alternate path style if the first format fails.
      const altConfig = { ...config, useV1Path: !config.useV1Path };
      const alt = buildRequest(altConfig, facts);
      const retry = await fetch(alt.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.apiKey,
        },
        body: JSON.stringify(alt.body),
      });

      if (!retry.ok) {
        await response.text();
        await retry.text();
        return rulesFallback(
          facts,
          `Model request failed (${response.status}/${retry.status}). Using rule-based host.`,
        );
      }

      const retryData = (await retry.json()) as unknown;
      const retryText = extractAssistantText(retryData);
      if (!retryText) {
        return rulesFallback(facts, "Empty model response — using rule-based host.");
      }
      return {
        commentary: retryText,
        source: "ai",
        note: "Generated from verified facts via Azure/Foundry model.",
      };
    }

    const data = (await response.json()) as unknown;
    const text = extractAssistantText(data);

    if (!text) {
      return rulesFallback(facts, "Empty model response — using rule-based host.");
    }

    return {
      commentary: text,
      source: "ai",
      note: "Generated from verified facts via Azure/Foundry model.",
    };
  } catch {
    return rulesFallback(facts, "Model call error — using rule-based host.");
  }
}

/** Pull assistant text from classic or newer Foundry response shapes. */
function extractAssistantText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const root = data as {
    choices?: {
      message?: { content?: unknown; refusal?: string };
      text?: string;
    }[];
    output_text?: string;
  };

  const choice = root.choices?.[0];
  const content = choice?.message?.content;

  if (typeof content === "string" && content.trim()) return content.trim();

  // Some APIs return content as an array of parts: [{ type: "text", text: "..." }]
  if (Array.isArray(content)) {
    const joined = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("")
      .trim();
    if (joined) return joined;
  }

  if (typeof choice?.text === "string" && choice.text.trim()) {
    return choice.text.trim();
  }

  if (typeof root.output_text === "string" && root.output_text.trim()) {
    return root.output_text.trim();
  }

  return "";
}

/** True when env vars for the model endpoint are present. */
export function isAiCommentaryConfigured(): boolean {
  return readModelConfig() !== null;
}
