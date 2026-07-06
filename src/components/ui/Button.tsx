"use client";

import { motion, type HTMLMotionProps, type TargetAndTransition } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "text-accent-foreground",
  secondary: "text-foreground",
  ghost: "bg-transparent text-foreground-muted hover:text-foreground",
};

// The "lip" is an inset shadow, not a real border-bottom. A border-bottom on a
// rounded-full pill curls up the caps and reads as color bleeding past the edge.
const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 55%, var(--accent-deep))",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -3px 0 var(--accent-deep), 0 12px 30px rgba(184,32,43,0.24), 0 6px 18px rgba(0,0,0,0.45)",
  },
  secondary: {
    background: "linear-gradient(180deg, var(--surface-overlay), var(--surface))",
    boxShadow:
      "inset 0 1px 0 rgba(255,246,232,0.08), inset 0 0 0 1px var(--surface-border-strong), 0 10px 24px rgba(0,0,0,0.38)",
  },
  ghost: {},
};

// Disabled is a flat, muted, but legible control, not the depth style faded out.
const DISABLED_STYLE: React.CSSProperties = {
  background: "color-mix(in srgb, var(--surface-overlay) 76%, transparent)",
  color: "var(--foreground-muted)",
  boxShadow: "inset 0 0 0 1px var(--surface-border)",
};

const VARIANT_PRESSED_STYLE: Record<Variant, TargetAndTransition> = {
  primary: {
    y: 2,
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 var(--accent-deep), 0 6px 18px rgba(184,32,43,0.18), 0 3px 8px rgba(0,0,0,0.35)",
  },
  secondary: {
    y: 2,
    boxShadow: "inset 0 1px 0 rgba(255,246,232,0.04), inset 0 0 0 1px var(--surface-border), 0 4px 12px rgba(0,0,0,0.35)",
  },
  ghost: { scale: 0.96 },
};

export function Button({
  variant = "primary",
  className = "",
  onClick,
  disabled = false,
  children,
  ...props
}: HTMLMotionProps<"button"> & { variant?: Variant }) {
  return (
    <motion.button
      initial={false}
      disabled={disabled}
      style={disabled ? DISABLED_STYLE : VARIANT_STYLE[variant]}
      whileTap={disabled ? undefined : VARIANT_PRESSED_STYLE[variant]}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={(e) => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(8);
        }
        onClick?.(e);
      }}
      className={`flex h-14 items-center justify-center rounded-[14px] px-5 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed ${variant === "primary" && !disabled ? "action-glint" : ""} ${disabled ? "" : VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
