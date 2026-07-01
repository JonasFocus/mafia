"use client";

import { use, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { MafiaGame } from "@/components/game/mafia/MafiaGame";
import { ChameleonGame } from "@/components/game/ChameleonGame";
import { GameErrorScreen } from "@/components/game/GameErrorScreen";
import type { GameMode } from "@/lib/game/types";

export default function GamePage({ params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = use(params);
  const [meta, setMeta] = useState<{ mode: GameMode; userId: string; isHost: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve only the game mode (and who the host is) here, then hand off to a
  // single mode-specific component. This avoids running both useGame and
  // useMafiaGame at once, which doubled the realtime channels and refetches.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [
        {
          data: { user },
        },
        { data: g, error: gErr },
      ] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("games").select("game_mode, host_id").eq("room_code", roomCode.toUpperCase()).maybeSingle(),
      ]);
      if (cancelled) return;
      if (gErr) {
        setError("Couldn’t load the game. Check your connection and try again.");
        return;
      }
      if (!g || !user) {
        setError("Room not found");
        return;
      }
      setMeta({
        mode: (g.game_mode as GameMode) ?? "chameleon",
        userId: user.id,
        isHost: g.host_id === user.id,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  if (error) {
    return <GameErrorScreen error={error} />;
  }

  if (!meta) {
    return (
      <main className="flex flex-1 items-center justify-center safe-top safe-bottom">
        <motion.div
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          className="h-14 w-14 rounded-2xl"
          style={{ background: "var(--surface-raised)" }}
        />
      </main>
    );
  }

  if (meta.mode === "mafia") {
    return <MafiaGame roomCode={roomCode} userId={meta.userId} isHost={meta.isHost} />;
  }
  return <ChameleonGame roomCode={roomCode} userId={meta.userId} isHost={meta.isHost} />;
}
