import type { MafiaPlayerView, PlayerRole, PlayerView } from "@/lib/game/types";

export function toPlayerView(p: MafiaPlayerView): PlayerView {
  return {
    userId: p.userId,
    displayName: p.displayName,
    isEliminated: p.isEliminated,
    isOutsider: null,
    joinOrder: p.joinOrder,
  };
}

// Raw hex (not CSS vars) so callers can append an 8-digit-hex alpha suffix,
// e.g. `${roleGlow(role)}33`. A `var(--x)33` string is invalid CSS and silently drops.
export const MAFIA_GLOW = "#e64a5e";
export const TOWN_GLOW = "#8ff0c4";
export const SHERIFF_GLOW = "#f3cd7e"; // gold, the investigator
export const ANGEL_GLOW = "#a99cff"; // lavender, the protector

export function roleGlow(role: PlayerRole | null): string {
  switch (role) {
    case "mafia":
      return MAFIA_GLOW;
    case "sheriff":
      return SHERIFF_GLOW;
    case "angel":
      return ANGEL_GLOW;
    default:
      return TOWN_GLOW;
  }
}

export const ROLE_LABEL: Record<PlayerRole, string> = {
  faithful: "Faithful",
  mafia: "Mafia",
  sheriff: "Sheriff",
  angel: "Angel",
};

export const phaseSpring = { type: "spring", stiffness: 380, damping: 22 } as const;
