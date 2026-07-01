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

export function roleGlow(role: PlayerRole | null): string {
  return role === "mafia" ? MAFIA_GLOW : TOWN_GLOW;
}

export const ROLE_LABEL: Record<PlayerRole, string> = {
  faithful: "Faithful",
  mafia: "Mafia",
  sheriff: "Sheriff",
  angel: "Angel",
};

export const phaseSpring = { type: "spring", stiffness: 380, damping: 22 } as const;
