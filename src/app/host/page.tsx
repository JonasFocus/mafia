"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ensureGuestSession } from "@/lib/game/auth";
import { createGame } from "@/lib/game/actions";
import { Button } from "@/components/ui/Button";
import { CategorySpinner } from "@/components/game/CategorySpinner";
import type { Tables } from "@/lib/supabase/database.types";

export default function HostPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [categories, setCategories] = useState<Tables<"categories">[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data }) => {
        if (data) {
          setCategories(data);
          setCategoryId(data[0]?.id ?? "");
        }
      });
  }, []);

  async function handleHost(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;
    setLoading(true);
    setError(null);
    try {
      const userId = await ensureGuestSession(name.trim());
      const game = await createGame(userId, categoryId);
      router.push(`/game/${game.room_code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col px-6 py-8 safe-top safe-bottom">
      <Link href="/" className="text-foreground-muted text-sm mb-6 w-fit">
        ← Back
      </Link>

      <form onSubmit={handleHost} className="flex-1 flex flex-col w-full max-w-sm mx-auto gap-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">Host a Game</h1>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm text-foreground-muted">
            Your name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Jonas"
            className="h-14 rounded-2xl bg-surface px-5 text-base outline-none focus:ring-2 focus:ring-accent transition-shadow"
            style={{ boxShadow: "inset 0 0 0 1px var(--surface-border)" }}
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-foreground-muted text-center">Category</span>
          {categories.length > 0 && (
            <CategorySpinner categories={categories} value={categoryId} onChange={setCategoryId} />
          )}
        </div>

        <div className="flex-1" />

        {error && <p className="text-sm text-outsider-glow text-center">{error}</p>}

        <Button type="submit" disabled={loading || !name.trim() || !categoryId} className="w-full">
          {loading ? "Creating room…" : "Create Room"}
        </Button>
      </form>
    </main>
  );
}
