import type { Team } from "./types";

/** Fictional clubs and squads used for the MVP (no real league data). */
export const HOME_TEAM: Team = {
  id: "home",
  name: "Northbridge FC",
  shortName: "NOR",
  color: "#0b3d91",
  players: [
    { id: "h-gk", name: "Owen Hart", teamId: "home", position: "GK" },
    { id: "h-d1", name: "Leo Marsh", teamId: "home", position: "DEF" },
    { id: "h-d2", name: "Kai Ortega", teamId: "home", position: "DEF" },
    { id: "h-m1", name: "Noah Quinn", teamId: "home", position: "MID" },
    { id: "h-m2", name: "Ellis Grant", teamId: "home", position: "MID" },
    { id: "h-f1", name: "Milo Shaw", teamId: "home", position: "FWD" },
    { id: "h-f2", name: "Rafa Cole", teamId: "home", position: "FWD" },
  ],
};

export const AWAY_TEAM: Team = {
  id: "away",
  name: "Riverton United",
  shortName: "RIV",
  color: "#c8102e",
  players: [
    { id: "a-gk", name: "Sam Voss", teamId: "away", position: "GK" },
    { id: "a-d1", name: "Jace Hale", teamId: "away", position: "DEF" },
    { id: "a-d2", name: "Theo Blake", teamId: "away", position: "DEF" },
    { id: "a-m1", name: "Arun Mehta", teamId: "away", position: "MID" },
    { id: "a-m2", name: "Finn Doyle", teamId: "away", position: "MID" },
    { id: "a-f1", name: "Zane Brooks", teamId: "away", position: "FWD" },
    { id: "a-f2", name: "Ivy Cross", teamId: "away", position: "FWD" },
  ],
};

export function getTeam(teamId: "home" | "away"): Team {
  return teamId === "home" ? HOME_TEAM : AWAY_TEAM;
}
