"use client";

import type { GameSnapshot } from "@/lib/game/types";

/** Production no-op. next.config aliases test builds to the enabled module. */
export function useAuthorizedGameTextSnapshot(snapshot: GameSnapshot | null) {
  void snapshot;
}
