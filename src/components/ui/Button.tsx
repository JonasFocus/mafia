"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

type Variant = "primary" | "secondary" | "ghost";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground",
  secondary: "bg-surface-raised text-foreground",
  ghost: "bg-transparent text-foreground-muted",
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
      whileTap={{ scale: 0.96 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
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
