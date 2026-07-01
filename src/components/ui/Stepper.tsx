"use client";

import { motion } from "framer-motion";

export function Stepper({
  value,
  onChange,
  min = 1,
  max,
  options,
  disabledCaption,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** Highest selectable value; options above this are shown disabled. */
  max: number;
  /** Explicit set of options to render as segments. Defaults to [min..max's ceiling]. */
  options?: number[];
  /** Caption shown under disabled segments, e.g. "Need 5+ players". */
  disabledCaption?: (option: number) => string;
}) {
  const segments = options ?? Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="relative flex rounded-2xl p-1 bg-surface"
        style={{ boxShadow: "var(--elevation-1)" }}
      >
        {segments.map((option) => {
          const isSelected = option === value;
          const isDisabled = option > max;

          return (
            <button
              key={option}
              type="button"
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(option)}
              className="relative flex-1 flex items-center justify-center rounded-xl h-11 font-display font-semibold text-base disabled:pointer-events-none"
              style={{ opacity: isDisabled ? 0.55 : 1 }}
            >
              {isSelected && !isDisabled && (
                <motion.div
                  layoutId="stepper-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: "var(--accent)", boxShadow: "var(--elevation-3)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                />
              )}
              <span
                className="relative z-10"
                style={{ color: isSelected && !isDisabled ? "var(--accent-foreground)" : "var(--foreground)" }}
              >
                {option}
              </span>
            </button>
          );
        })}
      </div>
      {disabledCaption && segments.some((o) => o > max) && (
        <span className="text-xs text-foreground-muted text-center">
          {disabledCaption(Math.min(...segments.filter((o) => o > max)))}
        </span>
      )}
    </div>
  );
}
