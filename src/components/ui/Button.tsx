"use client";

import { motion, type HTMLMotionProps, type TargetAndTransition } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "text-accent-foreground",
  secondary: "text-foreground",
  ghost: "bg-transparent text-foreground-muted",
};

// The "lip" is an inset shadow, not a real border-bottom — a border-bottom on a
// rounded-full pill curls up the caps and reads as color bleeding past the edge.
const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, var(--accent-bright), var(--accent))",
    boxShadow: "inset 0 -3px 0 var(--accent-deep), 0 4px 0 var(--accent-deep), 0 6px 14px rgba(0,0,0,0.4)",
  },
  secondary: {
    background: "linear-gradient(180deg, var(--surface-raised), var(--surface))",
    boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.4), 0 4px 0 rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.4)",
  },
  ghost: {},
};

// Disabled is a flat, muted, but legible control — never the depth style faded out.
const DISABLED_STYLE: React.CSSProperties = {
  background: "var(--surface-overlay)",
  color: "var(--foreground-muted)",
  boxShadow: "inset 0 0 0 1px var(--surface-border-strong)",
};

const VARIANT_PRESSED_STYLE: Record<Variant, TargetAndTransition> = {
  primary: {
    y: 2,
    boxShadow: "inset 0 -1px 0 var(--accent-deep), 0 2px 0 var(--accent-deep), 0 3px 6px rgba(0,0,0,0.3)",
  },
  secondary: {
    y: 2,
    boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.4), 0 2px 0 rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.3)",
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
      className={`flex h-14 items-center justify-center rounded-full font-display font-semibold text-base outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed ${disabled ? "" : VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
