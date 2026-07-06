"use client";

import { useState } from "react";
import { Stepper } from "@/components/ui/Stepper";
import { Toggle } from "@/components/ui/Toggle";
import { updateGameSettings } from "@/lib/game/actions";
import type { Game } from "@/lib/game/types";

export function MafiaSettings({ game, playerCount }: { game: Game; playerCount: number }) {
  const [mafiaCountOverride, setMafiaCountOverride] = useState<number | null>(null);
  const [sheriffOverride, setSheriffOverride] = useState<boolean | null>(null);
  const [angelOverride, setAngelOverride] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mafiaCount = mafiaCountOverride ?? game.mafia_count;
  const sheriffEnabled = sheriffOverride ?? game.sheriff_enabled;
  const angelEnabled = angelOverride ?? game.angel_enabled;

  // DB constraint caps mafia_count at 8; the engine additionally requires
  // mafia < half the table at start.
  const maxMafia = Math.min(8, Math.max(1, Math.floor((playerCount - 1) / 2)));
  const mafiaOptions = Array.from({ length: 8 }, (_, index) => index + 1);
  const showParityWarning = mafiaCount === Math.floor((playerCount - 1) / 2) && playerCount < 7;

  async function handleMafiaCountChange(value: number) {
    setMafiaCountOverride(value);
    setError(null);
    try {
      await updateGameSettings(game.id, { mafiaCount: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update settings");
    } finally {
      setMafiaCountOverride(null);
    }
  }

  async function handleSheriffChange(value: boolean) {
    setSheriffOverride(value);
    setError(null);
    try {
      await updateGameSettings(game.id, { sheriffEnabled: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update settings");
    } finally {
      setSheriffOverride(null);
    }
  }

  async function handleAngelChange(value: boolean) {
    setAngelOverride(value);
    setError(null);
    try {
      await updateGameSettings(game.id, { angelEnabled: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update settings");
    } finally {
      setAngelOverride(null);
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
          options={mafiaOptions}
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
