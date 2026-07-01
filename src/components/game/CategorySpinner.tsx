"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getCategoryIcon } from "@/lib/game/category-icons";
import type { Tables } from "@/lib/supabase/database.types";

const ITEM_HEIGHT = 60;
const VISIBLE_HEIGHT = ITEM_HEIGHT * 5; // 5 rows tall, center row is the selection

export function CategorySpinner({
  categories,
  value,
  onChange,
}: {
  categories: Tables<"categories">[];
  value: string;
  onChange: (categoryId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [scale, setScale] = useState<Map<string, number>>(new Map());
  const lastHaptic = useRef<string>(value);
  const rafRef = useRef<number | null>(null);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerCenter = container.scrollTop + container.clientHeight / 2;

    let closestId = value;
    let closestDist = Infinity;
    const next = new Map<string, number>();

    for (const c of categories) {
      const el = itemRefs.current.get(c.id);
      if (!el) continue;
      const itemCenter = el.offsetTop + el.clientHeight / 2;
      const dist = Math.abs(itemCenter - containerCenter);
      next.set(c.id, Math.max(0.72, 1 - dist / 160));
      if (dist < closestDist) {
        closestDist = dist;
        closestId = c.id;
      }
    }
    setScale(next);

    if (closestId !== lastHaptic.current) {
      lastHaptic.current = closestId;
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(6);
      onChange(closestId);
    }
  }, [categories, onChange, value]);

  function handleScroll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recompute);
  }

  function handleTap(id: string) {
    itemRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    // center the initial selection once items are laid out
    const id = requestAnimationFrame(() => {
      itemRefs.current.get(value)?.scrollIntoView({ block: "center" });
      recompute();
    });
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]);

  const padding = (VISIBLE_HEIGHT - ITEM_HEIGHT) / 2;

  return (
    <div className="relative" style={{ height: VISIBLE_HEIGHT }}>
      <div
        className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-2xl z-0"
        style={{
          height: ITEM_HEIGHT,
          background: "linear-gradient(180deg, var(--accent-bright), var(--accent))",
          boxShadow: "var(--elevation-3)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-12 z-10"
        style={{ background: "linear-gradient(to bottom, var(--surface-raised), transparent)" }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 z-10"
        style={{ background: "linear-gradient(to top, var(--surface-raised), transparent)" }}
      />

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative h-full overflow-y-scroll no-scrollbar"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: padding }} />
        {categories.map((c) => {
          const s = scale.get(c.id) ?? (c.id === value ? 1 : 0.8);
          const selected = c.id === value;
          return (
            <button
              type="button"
              key={c.id}
              ref={(el) => {
                if (el) itemRefs.current.set(c.id, el);
              }}
              onClick={() => handleTap(c.id)}
              className="relative z-20 flex w-full items-center justify-center gap-2 font-display font-semibold"
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "center",
                transform: `scale(${s})`,
                opacity: 0.35 + s * 0.65,
                color: selected ? "var(--accent-foreground)" : "var(--foreground-muted)",
                fontSize: 17,
              }}
            >
              <span>{getCategoryIcon(c.name)}</span>
              <span>{c.name}</span>
            </button>
          );
        })}
        <div style={{ height: padding }} />
      </div>
    </div>
  );
}
