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
  // client markup match and avoid a hydration mismatch.
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
    if (!name.trim() || (mode === "chameleon" && !categoryId)) return;
    setLoading(true);
    setError(null);
    try {
      setStoredName(name.trim());
      await ensureGuestSession(name.trim());
      const game = await createGame(
        mode === "chameleon" ? categoryId : null,
        mode,
      );
      router.push(`/game/${game.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t create the room. Try again.");
      setLoading(false);
    }
  }

  return (
    <main className="relative flex flex-1 flex-col overflow-y-auto px-5 py-6 safe-top safe-bottom sm:px-8">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 36% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 72%)",
        }}
      />
      <Link
        href="/"
        className="relative mb-6 flex min-h-11 w-fit items-center rounded-[10px] border border-surface-border bg-background/50 px-3 py-2 text-sm text-foreground-muted outline-none transition-colors hover:text-foreground active:opacity-70 focus-visible:ring-2 focus-visible:ring-accent"
      >
        Back
      </Link>

      <form
        onSubmit={handleHost}
        aria-busy={loading}
        className="relative mx-auto flex w-full max-w-md flex-1 flex-col gap-8"
      >
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl font-semibold leading-none">Host a game</h1>
          <p className="max-w-sm text-sm leading-6 text-foreground-muted">
            Set the table, choose the deception, and bring everyone into one room.
          </p>
        </div>

        <div
          role="group"
          aria-label="Game mode"
          className="relative flex rounded-[16px] border border-surface-border p-1"
          style={{ background: "color-mix(in srgb, var(--surface) 86%, transparent)", boxShadow: "var(--elevation-1)" }}
        >
          {(["chameleon", "mafia"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(m)}
                className="relative min-h-11 flex-1 rounded-[12px] py-3 text-sm font-semibold capitalize outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{ color: active ? "var(--accent-foreground)" : "var(--foreground-muted)" }}
              >
                {active && (
                  <motion.div
                    layoutId="mode-pill"
                    className="absolute inset-0 rounded-[12px]"
                    style={{
                      background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
                      boxShadow: "var(--elevation-3)",
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
                <span className="relative z-10">{m}</span>
              </button>
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
            className="h-14 rounded-[14px] border border-surface-border bg-surface px-5 text-base outline-none transition-shadow focus:ring-2 focus:ring-accent"
            style={{ boxShadow: "var(--elevation-1)" }}
          />
        </div>

        {mode === "chameleon" ? (
          <div className="relative flex flex-col gap-3">
            <span className="text-sm text-foreground-muted text-center">Category</span>
            <div className="relative">
              <div className="spotlight-pulse pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
              <div
                className="noir-panel-soft relative rounded-[22px] p-3"
                style={{ boxShadow: "var(--elevation-2)" }}
              >
                {categoriesLoading ? (
                  <div role="status" className="flex h-[180px] items-center justify-center">
                    <span className="text-sm text-foreground-muted">Loading categories…</span>
                  </div>
                ) : categoriesError ? (
                  <div role="alert" className="flex h-[180px] flex-col items-center justify-center gap-3">
                    <span className="text-sm text-foreground-muted">Couldn&rsquo;t load categories.</span>
                    <button
                      type="button"
                      onClick={retryCategories}
                      className="flex min-h-11 items-center rounded-[12px] px-4 text-sm font-semibold text-accent-bright outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            className="noir-panel-soft flex flex-col gap-3 rounded-[22px] p-5"
            style={{ boxShadow: "var(--elevation-2)" }}
          >
            <span className="font-display text-3xl font-semibold leading-none">Classic Mafia</span>
            <span className="text-sm text-foreground-muted leading-relaxed">
              Everyone gets a hidden role. Roles and mafia count are configured in the lobby.
            </span>
          </div>
        )}

        <div className="flex-1" />

        {error && <p role="alert" className="text-sm text-outsider-glow text-center">{error}</p>}

        <p className="text-center text-xs text-foreground-muted">
          {mode === "mafia" ? "Best with 5-25 players" : "For 3-8 players"}
        </p>

        <Button
          type="submit"
          disabled={loading || !name.trim() || (mode === "chameleon" && !categoryId)}
          className="w-full"
        >
          {loading ? "Creating room…" : "Create Room"}
        </Button>
      </form>
    </main>
  );
}
