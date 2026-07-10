"use client";

import { useEffect } from "react";
import type { GameSnapshot } from "@/lib/game/types";

export function useAuthorizedGameTextSnapshot(snapshot: GameSnapshot | null) {
  useEffect(() => {
    if (!snapshot) return;
    const testWindow = window as typeof window & {
      render_game_to_text?: () => string;
    };
    const render = () => JSON.stringify(snapshot);
    testWindow.render_game_to_text = render;
    return () => {
      if (testWindow.render_game_to_text === render) {
        delete testWindow.render_game_to_text;
      }
    };
  }, [snapshot]);
}
