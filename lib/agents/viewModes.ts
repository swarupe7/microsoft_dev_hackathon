import type { ViewMode } from "./types";

/** Audience modes — same insight, different story emphasis. */
export const VIEW_MODES: ViewMode[] = [
  {
    id: "analyst",
    label: "Tactical analyst",
    description: "Metrics-first: structure, risk, and evidence.",
  },
  {
    id: "casual",
    label: "Casual fan",
    description: "Plain-language story of what just changed.",
  },
  {
    id: "club_home",
    label: "Northbridge fan",
    description: "Bias toward home-team emotion and hope.",
  },
  {
    id: "club_away",
    label: "Riverton fan",
    description: "Bias toward away-team emotion and hope.",
  },
  {
    id: "player",
    label: "Player focus",
    description: "Spotlight the most involved player in the window.",
  },
];

export function getViewMode(id: string): ViewMode {
  return VIEW_MODES.find((m) => m.id === id) ?? VIEW_MODES[0];
}
