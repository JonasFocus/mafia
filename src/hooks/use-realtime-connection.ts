"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
} from "@supabase/supabase-js";

export type GameConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"
  | "error";

const MAX_RETRY_DELAY_MS = 15_000;

/**
 * Owns one Supabase Realtime channel and exposes its health to the game UI.
 * Rebuilding terminal channels gives players a bounded recovery path after a
 * timeout or socket closure instead of leaving a stale screen indefinitely.
 */
export function useRealtimeConnection({
  enabled,
  connect,
  catchUp,
}: {
  enabled: boolean;
  connect: () => RealtimeChannel;
  catchUp: () => void | Promise<void>;
}) {
  const [connectionState, setConnectionState] =
    useState<GameConnectionState>("connecting");
  const [retryVersion, setRetryVersion] = useState(0);
  const retryAttemptRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionStateRef = useRef<GameConnectionState>("connecting");

  const updateConnectionState = useCallback((next: GameConnectionState) => {
    connectionStateRef.current = next;
    setConnectionState(next);
  }, []);

  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const retryConnection = useCallback(() => {
    clearRetryTimer();
    retryAttemptRef.current = 0;
    updateConnectionState(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "offline"
        : "connecting",
    );
    setRetryVersion((version) => version + 1);
  }, [clearRetryTimer, updateConnectionState]);

  useEffect(() => {
    if (!enabled) {
      clearRetryTimer();
      retryAttemptRef.current = 0;
      return;
    }

    let cancelled = false;
    let suppressChannelStatus = false;
    let channel: RealtimeChannel | null = null;
    let subscribedCatchUpTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRetry = (state: "reconnecting" | "error") => {
      if (cancelled || retryTimerRef.current) return;
      if (!navigator.onLine) {
        updateConnectionState("offline");
        return;
      }

      updateConnectionState(state);
      const delay = Math.min(
        1_000 * 2 ** retryAttemptRef.current,
        MAX_RETRY_DELAY_MS,
      );
      retryAttemptRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        if (!cancelled) {
          updateConnectionState("reconnecting");
          setRetryVersion((version) => version + 1);
        }
      }, delay);
    };

    const startChannel = () => {
      if (!navigator.onLine) {
        queueMicrotask(() => {
          if (!cancelled) updateConnectionState("offline");
        });
        return;
      }

      channel = connect();
      channel.subscribe((status) => {
        if (cancelled || suppressChannelStatus) return;

        switch (status) {
          case REALTIME_SUBSCRIBE_STATES.SUBSCRIBED:
            clearRetryTimer();
            retryAttemptRef.current = 0;
            updateConnectionState("connected");
            // Joining the channel and committing a room mutation can cross in
            // flight. A single delayed catch-up closes that race without
            // bringing back lobby polling.
            subscribedCatchUpTimer = setTimeout(() => {
              subscribedCatchUpTimer = null;
              if (!cancelled) void catchUp();
            }, 1_000);
            break;
          case REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR:
            scheduleRetry("error");
            break;
          case REALTIME_SUBSCRIBE_STATES.TIMED_OUT:
          case REALTIME_SUBSCRIBE_STATES.CLOSED:
            scheduleRetry("reconnecting");
            break;
        }
      });
    };

    const handleOffline = () => {
      clearRetryTimer();
      updateConnectionState("offline");
      suppressChannelStatus = true;
      void channel?.unsubscribe();
      channel = null;
      setRetryVersion((version) => version + 1);
    };

    const handleOnline = () => {
      retryAttemptRef.current = 0;
      updateConnectionState("reconnecting");
      setRetryVersion((version) => version + 1);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      void catchUp();
      if (connectionStateRef.current !== "connected") retryConnection();
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    startChannel();

    return () => {
      cancelled = true;
      suppressChannelStatus = true;
      clearRetryTimer();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (subscribedCatchUpTimer) clearTimeout(subscribedCatchUpTimer);
      if (channel) void channel.unsubscribe();
    };
  }, [
    catchUp,
    clearRetryTimer,
    connect,
    enabled,
    retryConnection,
    retryVersion,
    updateConnectionState,
  ]);

  return { connectionState, retryConnection };
}
