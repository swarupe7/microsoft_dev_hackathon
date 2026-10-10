import type { HostId, HostPersonality, MatchInsight, MatchState } from "./types";
import { getTeam } from "./teams";

/** Original host personas (not real people / celebrity likenesses). */
export const HOSTS: HostPersonality[] = [
  {
    id: "blaze",
    name: "Blaze Carter",
    tagline: "High-energy entertainment host",
    style: "Loud, fun, story-first — like a viral live streamer calling the game.",
  },
  {
    id: "raahi",
    name: "Raahi Kapoor",
    tagline: "Regional Hinglish host",
    style: "Warm, conversational Hinglish — big moments feel like watching with friends.",
  },
  {
    id: "tessa",
    name: "Tessa Moore",
    tagline: "Tactical analyst",
    style: "Calm, precise, evidence-led — explains structure and risk.",
  },
];

export function getHost(id: HostId): HostPersonality {
  return HOSTS.find((h) => h.id === id) ?? HOSTS[0];
}

/**
 * Rewrite a verified insight in the selected host's voice.
 * Only uses fields already present on the insight / scoreboard.
 */
export function narrateInsight(
  hostId: HostId,
  insight: MatchInsight,
  state: MatchState,
): string {
  const teamName = insight.teamId ? getTeam(insight.teamId).name : "both sides";
  const scoreline = `${state.score.home}–${state.score.away}`;
  const windowLabel = `${insight.minuteStart}'–${insight.minuteEnd}'`;
  const evidenceBits = insight.evidence
    .slice(0, 3)
    .map((e) => `${e.label}: ${e.value}`)
    .join(" · ");

  if (hostId === "blaze") {
    if (insight.kind === "goal") {
      return `LET'S GOOO — ${teamName} just lit this place up! It's ${scoreline} and the story flipped in a heartbeat. ${insight.whatHappened} That's the moment fans clip and send to the group chat.`;
    }
    if (insight.kind === "pressure") {
      return `Pressure alert! ${teamName} are camping in the final third (${windowLabel}). ${insight.whyItMatters} Receipts: ${evidenceBits}.`;
    }
    if (insight.kind === "momentum") {
      return `Main character energy from ${teamName} right now. They're bossing the ball and the vibe of the match. ${insight.whatHappened}`;
    }
    if (insight.kind === "idle") {
      return `We're warming up the hype machine — hit Start match and the story begins.`;
    }
    return `It's a chess match out there — ${insight.whatHappened} Stay locked; the next swing is coming.`;
  }

  if (hostId === "raahi") {
    if (insight.kind === "goal") {
      return `Arre wah! ${teamName} ne goal maar diya — score ab ${scoreline} hai. ${insight.whatHappened} Full ground energy aa gaya yaar.`;
    }
    if (insight.kind === "pressure") {
      return `Dekho ${windowLabel} mein ${teamName} kitna pressure bana rahe hain. ${insight.whyItMatters} Numbers bhi same story bol rahe hain: ${evidenceBits}.`;
    }
    if (insight.kind === "momentum") {
      return `${teamName} ka control clear hai. ${insight.whatHappened} Thoda sa grip mil gaya hai match pe.`;
    }
    if (insight.kind === "idle") {
      return `Abhi kickoff nahi hua — Start match dabao, phir maza aayega.`;
    }
    return `Abhi match balanced chal raha hai. ${insight.whatHappened} Thoda wait karo, twist aane wala hai.`;
  }

  // Tessa — tactical analyst
  if (insight.kind === "goal") {
    return `Score update (${scoreline}). ${insight.whatHappened} Structurally this forces the trailing side to increase progressive risk, which can open transitions the other way.`;
  }
  if (insight.kind === "pressure") {
    return `Between ${windowLabel}, ${teamName} show a sustained territorial phase. ${insight.whyItMatters} Supporting metrics: ${evidenceBits}.`;
  }
  if (insight.kind === "momentum") {
    return `Possession differential favours ${teamName}. ${insight.whatHappened} Watch whether that possession converts into shots rather than sterile circulation.`;
  }
  if (insight.kind === "idle") {
    return `No verified events yet. Commentary will attach only to engine-produced facts once the match starts.`;
  }
  return `Current phase is contested. ${insight.whatHappened} Evidence window ${windowLabel}: ${evidenceBits}.`;
}
