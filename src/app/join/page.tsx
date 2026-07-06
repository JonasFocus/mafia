"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ensureGuestSession, getStoredName, setStoredName } from "@/lib/game/auth";
import { joinGame } from "@/lib/game/actions";
import { Button } from "@/components/ui/Button";

export default function JoinPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Prefill from localStorage + a shared /join?code=XXXX link on mount (not in
  // useState) so SSR and client markup stay identical (no hydration mismatch).
  useEffect(() => {
    const stored = getStoredName();
    const code = new URLSearchParams(window.location.search).get("code")?.toUpperCase().slice(0, 4);
    /* eslint-disable react-hooks/set-state-in-effect -- one-time mount prefill from
       localStorage / URL, an intentional sync rather than a render cascade. */
    if (stored) setName(stored);
    if (code) {
      setRoomCode(code);
      nameRef.current?.focus();
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || roomCode.trim().length < 4) return;
    setLoading(true);
    setError(null);
    try {
      setStoredName(name.trim());
      await ensureGuestSession(name.trim());
      const game = await joinGame(roomCode.trim());
      router.push(`/game/${game.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t join that game. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-y-auto px-5 py-6 safe-top safe-bottom sm:px-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(72% 38% at 50% 0%, color-mix(in srgb, var(--civilian-glow) 12%, transparent), transparent 72%)",
        }}
      />
      <Link
        href="/"
        className="relative mb-6 w-fit rounded-[10px] border border-surface-border bg-background/50 px-3 py-2 text-sm text-foreground-muted outline-none transition-colors hover:text-foreground active:opacity-70 focus-visible:ring-2 focus-visible:ring-accent"
      >
        Back
      </Link>

      <form onSubmit={handleJoin} className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl font-semibold leading-none">Join a game</h1>
          <p className="max-w-sm text-sm leading-6 text-foreground-muted">
            Enter the room code and take your seat before the round starts.
          </p>
        </div>

        <div
          className="noir-panel-soft flex flex-col gap-6 rounded-[22px] p-5"
          style={{ boxShadow: "var(--elevation-2)" }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="roomCode" className="text-sm text-foreground-muted">
              Room code
            </label>
            <input
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
              placeholder="AB3K"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="h-20 rounded-[16px] border border-surface-border bg-background px-4 text-center font-display text-5xl font-semibold tracking-[0.28em] outline-none transition-shadow placeholder:text-foreground-muted focus:ring-2 focus:ring-accent"
              style={{ boxShadow: "var(--elevation-1)", textIndent: "0.35em", color: "var(--accent-bright)" }}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm text-foreground-muted">
              Your name
            </label>
            <input
              id="name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              placeholder="Your name"
              type="text"
              autoComplete="name"
              autoCapitalize="words"
              spellCheck={false}
              className="h-14 rounded-[14px] border border-surface-border bg-surface px-5 text-base outline-none transition-shadow focus:ring-2 focus:ring-accent"
              style={{ boxShadow: "var(--elevation-1)" }}
            />
          </div>
        </div>

        <div className="flex-1" />

        {error && <p className="text-sm text-outsider-glow text-center">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !name.trim() || roomCode.trim().length < 4}
          className="w-full"
        >
          {loading ? "Joining..." : "Join Room"}
        </Button>
      </form>
    </main>
  );
}
