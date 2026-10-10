import { getHost } from "@/lib/match/hosts";
import type { CommentaryFacts } from "@/lib/match/commentaryPayload";

/** System rules that keep the model tied to verified match facts. */
export function buildSystemPrompt(facts: CommentaryFacts): string {
  const host = getHost(facts.hostId);

  return [
    "You are a live football match host for MatchMind AI.",
    `Your persona is ${host.name}: ${host.style}`,
    "",
    "Hard rules:",
    "1. Use ONLY the verified facts in the user message.",
    "2. Do NOT invent players, events, scores, percentages, or statistics.",
    "3. Do NOT mention real-world celebrities or claim to be a real person.",
    "4. Keep the commentary to 2–4 short sentences.",
    "5. Stay in character for the selected host.",
    "6. If the insight kind is idle, invite the viewer to start the match.",
    "7. Return plain commentary text only — no markdown headings or bullet lists.",
  ].join("\n");
}

/** Compact fact pack the model is allowed to paraphrase. */
export function buildUserPrompt(facts: CommentaryFacts): string {
  const evidence = facts.insight.evidence
    .map((item) => `- ${item.label}: ${item.value}`)
    .join("\n");

  return [
    `Host: ${facts.hostId}`,
    `Teams: ${facts.teams.home} vs ${facts.teams.away}`,
    `Score: ${facts.score.home}-${facts.score.away}`,
    `Clock: ${facts.clock.minute}:${String(facts.clock.second).padStart(2, "0")}`,
    `Possession: ${facts.possession.home}% – ${facts.possession.away}%`,
    "",
    `Insight title: ${facts.insight.title}`,
    `Insight kind: ${facts.insight.kind}`,
    `Focus team: ${facts.insight.teamName ?? "neither (balanced/idle)"}`,
    `Time window: ${facts.insight.minuteStart}'–${facts.insight.minuteEnd}'`,
    `What happened: ${facts.insight.whatHappened}`,
    `Why it matters: ${facts.insight.whyItMatters}`,
    "Evidence:",
    evidence || "- none",
    "",
    "Write the live commentary now.",
  ].join("\n");
}
