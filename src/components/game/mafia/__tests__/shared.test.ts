import { describe, expect, it } from "vitest";
import {
  MAFIA_GLOW,
  ROLE_LABEL,
  TOWN_GLOW,
  maxMafiaCount,
  roleGlow,
  showMafiaParityWarning,
  toPlayerView,
} from "@/components/game/mafia/shared";
import type { MafiaPlayerView, PlayerRole } from "@/lib/game/types";

describe("toPlayerView", () => {
  it("maps a MafiaPlayerView to a PlayerView, dropping the role and adding isOutsider: null", () => {
    const mafiaView: MafiaPlayerView = {
      userId: "user-1",
      displayName: "Alice",
      isEliminated: false,
      role: "mafia",
      joinOrder: 2,
    };

    expect(toPlayerView(mafiaView)).toEqual({
      userId: "user-1",
      displayName: "Alice",
      isEliminated: false,
      isOutsider: null,
      joinOrder: 2,
    });
  });

  it("preserves isEliminated: true", () => {
    const mafiaView: MafiaPlayerView = {
      userId: "user-2",
      displayName: "Bob",
      isEliminated: true,
      role: null,
      joinOrder: 0,
    };

    expect(toPlayerView(mafiaView).isEliminated).toBe(true);
  });

  it("always sets isOutsider to null regardless of role", () => {
    const roles: (PlayerRole | null)[] = ["faithful", "mafia", "sheriff", "angel", null];
    for (const role of roles) {
      const view = toPlayerView({ userId: "u", displayName: "d", isEliminated: false, role, joinOrder: 0 });
      expect(view.isOutsider).toBeNull();
    }
  });
});

describe("roleGlow", () => {
  it("returns the mafia glow color for mafia", () => {
    expect(roleGlow("mafia")).toBe(MAFIA_GLOW);
  });

  it("returns the town glow color for faithful", () => {
    expect(roleGlow("faithful")).toBe(TOWN_GLOW);
  });

  it("returns the town glow color for sheriff and angel", () => {
    expect(roleGlow("sheriff")).toBe(TOWN_GLOW);
    expect(roleGlow("angel")).toBe(TOWN_GLOW);
  });

  it("returns the town glow color for null (unknown role)", () => {
    expect(roleGlow(null)).toBe(TOWN_GLOW);
  });
});

describe("ROLE_LABEL", () => {
  it("has a human-readable label for every PlayerRole enum value", () => {
    const roles: PlayerRole[] = ["faithful", "mafia", "sheriff", "angel"];
    for (const role of roles) {
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });
});

describe("maxMafiaCount", () => {
  it("clamps to a minimum of 1 for very small lobbies", () => {
    expect(maxMafiaCount(1)).toBe(1);
    expect(maxMafiaCount(2)).toBe(1);
    expect(maxMafiaCount(3)).toBe(1);
  });

  it("computes floor((n-1)/2) matching the server's start_mafia_game check", () => {
    expect(maxMafiaCount(5)).toBe(2);
    expect(maxMafiaCount(6)).toBe(2);
    expect(maxMafiaCount(7)).toBe(3);
    expect(maxMafiaCount(8)).toBe(3);
  });

  it("never allows mafia to reach a majority (max is always < half of players)", () => {
    for (let n = 1; n <= 20; n++) {
      const max = maxMafiaCount(n);
      expect(max * 2).toBeLessThan(n === 1 ? 3 : n + 1);
    }
  });
});

describe("showMafiaParityWarning", () => {
  it("warns at the 5-player minimum with max mafia selected", () => {
    expect(showMafiaParityWarning(2, 5)).toBe(true);
  });

  it("does not warn once the lobby reaches 7 players, even at max mafia", () => {
    expect(showMafiaParityWarning(3, 7)).toBe(false);
  });

  it("does not warn when mafia count is below the max for the lobby size", () => {
    expect(showMafiaParityWarning(1, 6)).toBe(false);
  });

  it("does not warn for a mid-size lobby (6 players) below the 7-player cutoff but not at max", () => {
    expect(showMafiaParityWarning(1, 6)).toBe(false);
    expect(showMafiaParityWarning(2, 6)).toBe(true);
  });
});
