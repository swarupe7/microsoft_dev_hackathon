import { AWAY_TEAM, HOME_TEAM } from "./teams";
import type { MatchState, Player, TeamId, Zone } from "./types";

/** Pitch uses the same 160×70 viewBox as the chalk-line SVG. */
export const PITCH_WIDTH = 160;
export const PITCH_HEIGHT = 70;

export interface PitchMarker {
  id: string;
  name: string;
  number: number;
  teamId: TeamId;
  color: string;
  /** SVG coordinates inside 160×70 pitch */
  x: number;
  y: number;
  isActive: boolean;
  hasBall: boolean;
  isGk: boolean;
}

export interface PassArrow {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  label: string;
}

/** Home attacks to the right (like reference tactical boards). */
const HOME_SLOTS: { position: Player["position"]; x: number; y: number; number: number }[] = [
  { position: "GK", x: 10, y: 35, number: 1 },
  { position: "DEF", x: 28, y: 18, number: 4 },
  { position: "DEF", x: 28, y: 52, number: 5 },
  { position: "MID", x: 52, y: 22, number: 8 },
  { position: "MID", x: 52, y: 48, number: 6 },
  { position: "FWD", x: 74, y: 20, number: 9 },
  { position: "FWD", x: 74, y: 50, number: 11 },
];

const AWAY_SLOTS: { position: Player["position"]; x: number; y: number; number: number }[] = [
  { position: "GK", x: 150, y: 35, number: 1 },
  { position: "DEF", x: 132, y: 18, number: 2 },
  { position: "DEF", x: 132, y: 52, number: 3 },
  { position: "MID", x: 108, y: 22, number: 8 },
  { position: "MID", x: 108, y: 48, number: 10 },
  { position: "FWD", x: 86, y: 20, number: 9 },
  { position: "FWD", x: 86, y: 50, number: 7 },
];

function zonePush(teamId: TeamId, zone: Zone | undefined, possession: TeamId): number {
  let push = 0;
  if (possession === teamId) push += teamId === "home" ? 5 : -5;
  if (zone === "attacking" && possession === teamId) {
    push += teamId === "home" ? 8 : -8;
  }
  if (zone === "defensive" && possession !== teamId) {
    push += teamId === "home" ? -4 : 4;
  }
  return push;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Build SVG-space player markers + ball + optional pass arrow from the latest event.
 */
export function buildPitchMarkers(match: MatchState): {
  players: PitchMarker[];
  ball: { x: number; y: number };
  passArrow: PassArrow | null;
  activeName: string | null;
} {
  const latest = match.events[0];
  const previous = match.events[1];
  const zone = latest?.zone;
  const activePlayerId = latest?.playerId ?? null;
  const homePush = zonePush("home", zone, match.possession);
  const awayPush = zonePush("away", zone, match.possession);
  const wobble = match.isRunning ? Math.sin(match.second / 3) * 1.4 : 0;

  const players: PitchMarker[] = [];

  HOME_TEAM.players.forEach((player, index) => {
    const slot = HOME_SLOTS[index] ?? HOME_SLOTS[HOME_SLOTS.length - 1];
    const isActive = player.id === activePlayerId;
    players.push({
      id: player.id,
      name: player.name,
      number: slot.number,
      teamId: "home",
      color: HOME_TEAM.color,
      x: clamp(slot.x + homePush + (isActive ? 2 : 0), 6, 154),
      y: clamp(slot.y + (index % 2 === 0 ? wobble : -wobble), 8, 62),
      isActive,
      hasBall: false,
      isGk: player.position === "GK",
    });
  });

  AWAY_TEAM.players.forEach((player, index) => {
    const slot = AWAY_SLOTS[index] ?? AWAY_SLOTS[AWAY_SLOTS.length - 1];
    const isActive = player.id === activePlayerId;
    players.push({
      id: player.id,
      name: player.name,
      number: slot.number,
      teamId: "away",
      color: AWAY_TEAM.color,
      x: clamp(slot.x + awayPush - (isActive ? 2 : 0), 6, 154),
      y: clamp(slot.y + (index % 2 === 0 ? -wobble : wobble), 8, 62),
      isActive,
      hasBall: false,
      isGk: player.position === "GK",
    });
  });

  const possessingMids = (
    match.possession === "home" ? HOME_TEAM.players : AWAY_TEAM.players
  ).filter((p) => p.position === "MID");

  let ballCarrier =
    players.find((p) => p.id === activePlayerId) ??
    players.find((p) => p.id === possessingMids[0]?.id) ??
    players.find((p) => p.teamId === match.possession);

  if (ballCarrier) {
    ballCarrier = { ...ballCarrier, hasBall: true, isActive: true };
    const idx = players.findIndex((p) => p.id === ballCarrier!.id);
    if (idx >= 0) players[idx] = ballCarrier;
  }

  const ball = ballCarrier
    ? {
        x: ballCarrier.x + (ballCarrier.teamId === "home" ? 3.2 : -3.2),
        y: ballCarrier.y + 2.2,
      }
    : { x: 80, y: 35 };

  // Draw a pass/move arrow when the last two events involve different players.
  let passArrow: PassArrow | null = null;
  if (latest && previous && latest.playerId !== previous.playerId) {
    const from = players.find((p) => p.id === previous.playerId);
    const to = players.find((p) => p.id === latest.playerId);
    if (from && to) {
      passArrow = {
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
        label: latest.playerName.split(" ").slice(-1)[0] ?? latest.playerName,
      };
    }
  }

  return {
    players,
    ball,
    passArrow,
    activeName: ballCarrier?.name ?? null,
  };
}
