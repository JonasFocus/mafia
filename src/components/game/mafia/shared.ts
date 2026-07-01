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

// Mirrors the server-side `v_max_mafia := (v_n - 1) / 2` floor-division check in
// start_mafia_game() — town must retain a strict majority. Clamped to a minimum of 1
// purely for UI display before the 5-player minimum is enforced server-side.
export function maxMafiaCount(playerCount: number): number {
  return Math.max(1, Math.floor((playerCount - 1) / 2));
}

// True when the selected mafia count is the highest allowed for this lobby size and the
// lobby is small enough (<7) that mafia could reach a majority after a single night kill.
export function showMafiaParityWarning(mafiaCount: number, playerCount: number): boolean {
  return mafiaCount === Math.floor((playerCount - 1) / 2) && playerCount < 7;
}
