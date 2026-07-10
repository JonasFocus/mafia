"use client";

import { useEffect, useState } from "react";

const HOST_RECOVERY_MS = 120_000;

export function useHostRecovery(
  players: Array<{ userId: string; lastSeenAt: string }>,
  hostId: string | null,
  isHost: boolean,
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (isHost || !hostId) return;
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, [hostId, isHost]);

  if (isHost || !hostId) return false;
  const host = players.find((player) => player.userId === hostId);
  if (!host) return true;
  const lastSeenAt = new Date(host.lastSeenAt).getTime();
  return Number.isFinite(lastSeenAt) && now - lastSeenAt >= HOST_RECOVERY_MS;
}
