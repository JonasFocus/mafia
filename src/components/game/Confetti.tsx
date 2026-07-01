"use client";

import { motion } from "framer-motion";

const COLORS = ["#8b7bff", "#8ff0c4", "#e6b3ea", "#f3cd7e", "#7ec8f3"];
const PIECES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: Math.random() * 100,
  delay: Math.random() * 0.4,
  duration: 2.2 + Math.random() * 1.2,
  rotate: Math.random() * 360,
  color: COLORS[i % COLORS.length],
  size: 6 + Math.random() * 6,
}));

export function Confetti() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {PIECES.map((p) => (
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
