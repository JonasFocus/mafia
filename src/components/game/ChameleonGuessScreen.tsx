"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";

export type GuessWordOption = { id: string; text: string };

export function ChameleonGuessScreen({
  isGuesser,
  chameleonName,
  options,
  guessesRemaining,
  guessedWordIds = [],
  onGuess,
}: {
  isGuesser: boolean;
  chameleonName: string;
  options: GuessWordOption[];
  guessesRemaining: number;
  guessedWordIds?: string[];
  onGuess: (wordId: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGuess() {
    if (!selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onGuess(selected);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the guess. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(110% 70% at 50% 0%, color-mix(in srgb, var(--outsider-glow) 18%, transparent), transparent 68%)",
        }}
      />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col items-center gap-6 overflow-y-auto px-6 py-8 safe-top safe-bottom">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-2 text-center"
        >
          <span className="role-mark h-14 w-14 text-outsider-glow" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-outsider-glow">One last chance</span>
          <h1 className="font-display text-3xl font-semibold">
            {isGuesser ? "Guess the secret word" : `${chameleonName} is guessing`}
          </h1>
          <p className="max-w-xs text-sm leading-6 text-foreground-muted">
            {isGuesser
              ? "Choose the word you think the table was describing. A correct guess steals the win."
              : "Keep the answer quiet until the Chameleon locks in a choice."}
          </p>
          {isGuesser && (
            <p className="font-mono text-xs text-foreground-muted" role="status">
              {guessesRemaining} guess{guessesRemaining === 1 ? "" : "es"} remaining
            </p>
          )}
        </motion.div>

        {isGuesser ? (
          <>
            <div className="grid w-full grid-cols-2 gap-3" role="radiogroup" aria-label="Secret word choices">
              {options.map((option) => {
                const active = option.id === selected;
                const alreadyGuessed = guessedWordIds.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={alreadyGuessed || busy}
                    onClick={() => setSelected(option.id)}
                    className="min-h-14 rounded-[14px] border px-3 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
                    style={{
                      borderColor: active ? "var(--accent-bright)" : "var(--surface-border)",
                      background: active ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "var(--surface)",
                      boxShadow: active ? "var(--elevation-2)" : "var(--elevation-1)",
                    }}
                  >
                    {option.text}
                  </button>
                );
              })}
            </div>
            {options.length === 0 && (
              <p className="rounded-[16px] border border-surface-border bg-surface px-4 py-4 text-center text-sm text-foreground-muted">
                Loading the authorized word choices...
              </p>
            )}
            {error && <p className="text-center text-sm text-outsider-glow">{error}</p>}
            <Button onClick={handleGuess} disabled={!selected || busy} className="mt-auto w-full">
              {busy ? "Locking guess..." : "Lock in final guess"}
            </Button>
          </>
        ) : (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="mt-auto rounded-[18px] border border-surface-border bg-surface px-5 py-4 text-center text-sm text-foreground-muted"
            role="status"
          >
            Waiting for the final guess...
          </motion.div>
        )}
      </div>
    </div>
  );
}
