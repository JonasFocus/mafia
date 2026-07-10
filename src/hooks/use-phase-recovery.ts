"use client";

import { useEffect, useState } from "react";

/**
 * Reveals recovery controls when the server-issued deadline passes even if an
 * idle room produces no realtime mutation at that exact moment. The RPC still
 * locks the game row and revalidates the deadline before changing any state.
 */
export function usePhaseRecovery(
  phaseDeadline: string | null | undefined,
  serverRecoveryAvailable: boolean,
) {
  const [reachedDeadline, setReachedDeadline] = useState<string | null>(null);

  useEffect(() => {
    if (!phaseDeadline || serverRecoveryAvailable) return;
    const delay = new Date(phaseDeadline).getTime() - Date.now();
    const timer = window.setTimeout(
      () => setReachedDeadline(phaseDeadline),
      Math.max(0, delay),
    );
    return () => window.clearTimeout(timer);
  }, [phaseDeadline, serverRecoveryAvailable]);

  if (serverRecoveryAvailable) return true;
  if (!phaseDeadline) return false;
  return reachedDeadline === phaseDeadline;
}
