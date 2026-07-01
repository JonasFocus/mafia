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
    <main className="flex flex-1 flex-col px-6 py-8 safe-top safe-bottom">
      <Link
        href="/"
        className="text-foreground-muted text-sm mb-6 w-fit rounded outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        ← Back
      </Link>

      <form onSubmit={handleJoin} className="flex-1 flex flex-col w-full max-w-sm mx-auto gap-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Join a Game</h1>

        <div
          className="flex flex-col gap-6 rounded-3xl bg-surface-raised p-5"
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
              className="h-16 rounded-2xl bg-surface px-4 text-3xl tracking-[0.35em] text-center font-display font-semibold outline-none focus:ring-2 focus:ring-accent transition-shadow"
              style={{ boxShadow: "var(--elevation-1)", textIndent: "0.35em" }}
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
              className="h-14 rounded-2xl bg-surface px-5 text-base outline-none focus:ring-2 focus:ring-accent transition-shadow"
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
          {loading ? "Joining…" : "Join Room"}
        </Button>
      </form>
    </main>
  );
}
