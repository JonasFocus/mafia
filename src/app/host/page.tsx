"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ensureGuestSession, getStoredName, setStoredName } from "@/lib/game/auth";
import { createGame } from "@/lib/game/actions";
import { Button } from "@/components/ui/Button";
import { CategorySpinner } from "@/components/game/CategorySpinner";
import type { Tables } from "@/lib/supabase/database.types";
import type { GameMode } from "@/lib/game/types";

export default function HostPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("chameleon");
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(false);

  // Prefill the name from localStorage on mount (not in useState) so SSR and
  // client markup match — avoids a hydration mismatch.
  useEffect(() => {
    const stored = getStoredName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setName(stored);
  }, []);

  useEffect(() => {
    createClient()
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setCategoriesError(true);
          setCategoriesLoading(false);
          return;
        }
        setCategories(data);
        setCategoryId((prev) => prev || data[0]?.id || "");
        setCategoriesLoading(false);
      });
  }, []);

  function retryCategories() {
    setCategoriesError(false);
    setCategoriesLoading(true);
    createClient()
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data, error: fetchError }) => {
        if (fetchError || !data) {
          setCategoriesError(true);
          setCategoriesLoading(false);
          return;
        }
        setCategories(data);
        setCategoryId((prev) => prev || data[0]?.id || "");
        setCategoriesLoading(false);
      });
  }

  async function handleHost(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setLoading(true);
    setError(null);
    try {
      setStoredName(name.trim());
      const userId = await ensureGuestSession(name.trim());
      const game = await createGame(userId, categoryId, mode);
      router.push(`/game/${game.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t create the room. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 safe-top safe-bottom">
      <Link
        href="/"
        className="text-foreground-muted text-sm mb-6 w-fit rounded outline-none transition-colors hover:text-foreground active:opacity-70 focus-visible:ring-2 focus-visible:ring-accent"
      >
        ← Back
      </Link>

      <form onSubmit={handleHost} className="relative flex-1 flex flex-col w-full max-w-sm mx-auto gap-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Host a Game</h1>

        <div
          className="flex gap-1.5 rounded-2xl p-1.5"
          style={{ background: "var(--surface)", boxShadow: "var(--elevation-1)" }}
        >
          {(["chameleon", "mafia"] as const).map((m) => {
            const active = mode === m;
            return (
              <motion.button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                whileTap={{ scale: 0.96 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex-1 rounded-xl py-3 text-sm font-semibold capitalize transition-colors"
                style={{
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-foreground)" : "var(--foreground-muted)",
                  boxShadow: active ? "var(--elevation-2)" : "none",
                }}
              >
                {m}
              </motion.button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm text-foreground-muted">
            Your name
          </label>
          <input
            id="name"
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
            autoFocus
          />
        </div>

        {mode === "chameleon" ? (
          <div className="relative flex flex-col gap-3">
            <span className="text-sm text-foreground-muted text-center">Category</span>
            <div className="relative">
              <div
                className="spotlight-pulse pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-10"
                style={{ background: "radial-gradient(circle, var(--accent), transparent 70%)" }}
              />
              <div
                className="relative rounded-3xl bg-surface-raised p-3"
                style={{ boxShadow: "var(--elevation-2)" }}
              >
                {categoriesLoading ? (
                  <div className="flex h-[180px] items-center justify-center">
                    <span className="text-sm text-foreground-muted">Loading categories…</span>
                  </div>
                ) : categoriesError ? (
                  <div className="flex h-[180px] flex-col items-center justify-center gap-3">
                    <span className="text-sm text-foreground-muted">Couldn&rsquo;t load categories.</span>
                    <button
                      type="button"
                      onClick={retryCategories}
                      className="text-sm font-semibold text-accent-bright"
                    >
                      Retry
                    </button>
                  </div>
                ) : categories.length > 0 ? (
                  <CategorySpinner categories={categories} value={categoryId} onChange={setCategoryId} />
                ) : (
                  <div className="flex h-[180px] items-center justify-center">
                    <span className="text-sm text-foreground-muted">No categories available.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-3xl bg-surface-raised p-5 flex flex-col gap-2"
            style={{ boxShadow: "var(--elevation-2)" }}
          >
            <span className="font-display text-lg font-bold">Classic Mafia</span>
            <span className="text-sm text-foreground-muted leading-relaxed">
              Everyone gets a hidden role. Roles and mafia count are configured in the lobby.
            </span>
          </div>
        )}

        <div className="flex-1" />

        {error && <p className="text-sm text-outsider-glow text-center">{error}</p>}

        <p className="text-center text-xs text-foreground-muted">
          {mode === "mafia" ? "Best with 5–8 players" : "Best with 4–8 players"}
        </p>

        <Button type="submit" disabled={loading || !name.trim() || !categoryId} className="w-full">
          {loading ? "Creating room…" : "Create Room"}
        </Button>
      </form>
    </main>
  );
}
