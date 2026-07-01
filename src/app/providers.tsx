"use client";

import { MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Client-side app providers. MotionConfig reducedMotion="user" makes every
 * Framer Motion component honor the OS "reduce motion" setting (transform/layout
 * animations are skipped to their end state; opacity is preserved).
 */
export function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
