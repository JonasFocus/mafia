"use client";

import { motion, type HTMLMotionProps, type TargetAndTransition } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "text-accent-foreground",
  secondary: "text-foreground",
  ghost: "bg-transparent text-foreground-muted",
};

const VARIANT_STYLE: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "linear-gradient(180deg, var(--accent-bright), var(--accent))",
    borderBottom: "3px solid var(--accent-deep)",
    boxShadow: "0 4px 0 var(--accent-deep), 0 6px 14px rgba(0,0,0,0.4)",
  },
  secondary: {
    background: "linear-gradient(180deg, var(--surface-raised), var(--surface))",
    borderBottom: "3px solid rgba(0,0,0,0.4)",
    boxShadow: "0 4px 0 rgba(0,0,0,0.4), 0 6px 14px rgba(0,0,0,0.4)",
  },
  ghost: {},
};

const VARIANT_PRESSED_STYLE: Record<Variant, TargetAndTransition> = {
  primary: {
    y: 2,
    borderBottomWidth: 1,
    boxShadow: "0 2px 0 var(--accent-deep), 0 3px 6px rgba(0,0,0,0.3)",
  },
  secondary: {
    y: 2,
    borderBottomWidth: 1,
    boxShadow: "0 2px 0 rgba(0,0,0,0.4), 0 3px 6px rgba(0,0,0,0.3)",
  },
  ghost: { scale: 0.96 },
};

export function Button({
  variant = "primary",
  className = "",
  onClick,
  children,
  ...props
}: HTMLMotionProps<"button"> & { variant?: Variant }) {
  return (
    <motion.button
      initial={false}
      style={VARIANT_STYLE[variant]}
      whileTap={VARIANT_PRESSED_STYLE[variant]}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      onClick={(e) => {
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate?.(8);
        }
        onClick?.(e);
      }}
      className={`flex h-14 items-center justify-center rounded-full font-display font-semibold text-base disabled:opacity-35 disabled:pointer-events-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
