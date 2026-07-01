"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

const CIVILIAN_COLORS = ["#8ff0c4", "#f3cd7e", "#8b7bff", "#7ec8f3", "#a99cff"];
const MAFIA_COLORS = ["#e64a5e", "#f3cd7e", "#8b7bff", "#f39e8e", "#ff7a8a"];

function makePieces(colors: string[]) {
  return Array.from({ length: 26 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 2.2 + Math.random() * 1.2,
    rotate: Math.random() * 360,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 6,
  }));
}

export function Confetti({ variant = "civilian" }: { variant?: "civilian" | "mafia" }) {
  const pieces = useMemo(() => makePieces(variant === "mafia" ? MAFIA_COLORS : CIVILIAN_COLORS), [variant]);
  const [done, setDone] = useState(false);

  // The longest piece lands by ~3.8s; unmount the 26 nodes after that so they
  // don't linger in the DOM for the rest of the results screen.
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 4000);
    return () => clearTimeout(t);
  }, []);

  if (done) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: -20, x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: "110vh", rotate: p.rotate, opacity: [1, 1, 0] }}
          transition={{ delay: p.delay, duration: p.duration, ease: "easeIn" }}
          className="absolute top-0 block rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.5,
            background: p.color,
          }}
        />
      ))}
    </div>
  );
}
