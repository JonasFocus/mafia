"use client";

import { useState } from "react";
import { Stepper } from "@/components/ui/Stepper";
import { Toggle } from "@/components/ui/Toggle";
import { updateGameSettings } from "@/lib/game/actions";
import { maxMafiaCount, showMafiaParityWarning } from "@/components/game/mafia/shared";
import type { Game } from "@/lib/game/types";

export function MafiaSettings({ game, playerCount }: { game: Game; playerCount: number }) {
  const [mafiaCountOverride, setMafiaCountOverride] = useState<number | null>(null);
  const [sheriffOverride, setSheriffOverride] = useState<boolean | null>(null);
  const [angelOverride, setAngelOverride] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Drop each optimistic override the moment the realtime-synced game prop itself
  // changes (adjusted during render, not in an effect, per React's "you might not need
  // an effect" guidance). Clearing immediately on RPC success instead would re-derive
  // the value from the still-stale game prop until the realtime update lands, causing a
  // visible flicker back to the old value before jumping to the new one.
  const [prevMafiaCount, setPrevMafiaCount] = useState(game.mafia_count);
  if (game.mafia_count !== prevMafiaCount) {
    setPrevMafiaCount(game.mafia_count);
    setMafiaCountOverride(null);
  }
  const [prevSheriffEnabled, setPrevSheriffEnabled] = useState(game.sheriff_enabled);
  if (game.sheriff_enabled !== prevSheriffEnabled) {
    setPrevSheriffEnabled(game.sheriff_enabled);
    setSheriffOverride(null);
  }
  const [prevAngelEnabled, setPrevAngelEnabled] = useState(game.angel_enabled);
  if (game.angel_enabled !== prevAngelEnabled) {
    setPrevAngelEnabled(game.angel_enabled);
    setAngelOverride(null);
  }

  const mafiaCount = mafiaCountOverride ?? game.mafia_count;
  const sheriffEnabled = sheriffOverride ?? game.sheriff_enabled;
  const angelEnabled = angelOverride ?? game.angel_enabled;

  const maxMafia = maxMafiaCount(playerCount);
  const showParityWarning = showMafiaParityWarning(mafiaCount, playerCount);

  async function handleMafiaCountChange(value: number) {
    setMafiaCountOverride(value);
    setError(null);
    try {
      await updateGameSettings(game.id, { mafiaCount: value });
    } catch (err) {
      setMafiaCountOverride(null);
      setError(err instanceof Error ? err.message : "Could not update settings");
    }
  }

  async function handleSheriffChange(value: boolean) {
    setSheriffOverride(value);
    setError(null);
    try {
      await updateGameSettings(game.id, { sheriffEnabled: value });
    } catch (err) {
      setSheriffOverride(null);
      setError(err instanceof Error ? err.message : "Could not update settings");
    }
  }

  async function handleAngelChange(value: boolean) {
    setAngelOverride(value);
    setError(null);
    try {
      await updateGameSettings(game.id, { angelEnabled: value });
    } catch (err) {
      setAngelOverride(null);
      setError(err instanceof Error ? err.message : "Could not update settings");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-medium text-foreground">Mafia count</span>
        <Stepper
          value={mafiaCount}
          onChange={handleMafiaCountChange}
          min={1}
          max={maxMafia}
          options={[1, 2, 3]}
          disabledCaption={(o) => `Need ${o * 2 + 1}+ players`}
        />
        {showParityWarning && (
          <span
            className="text-xs"
            style={{ color: "color-mix(in srgb, var(--outsider-glow) 75%, transparent)" }}
          >
            At this size mafia could win in one night.
          </span>
        )}
      </div>

      <Toggle checked={sheriffEnabled} onChange={handleSheriffChange} label="Sheriff" />
      <Toggle checked={angelEnabled} onChange={handleAngelChange} label="Angel" />

      {error && <p className="text-sm text-outsider-glow">{error}</p>}
    </div>
  );
}
