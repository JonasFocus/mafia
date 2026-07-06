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
        className="relative flex rounded-[16px] border border-surface-border bg-surface p-1"
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
              className="relative flex h-11 flex-1 items-center justify-center rounded-[12px] text-base font-semibold disabled:pointer-events-none"
              style={{ opacity: isDisabled ? 0.55 : 1 }}
            >
              {isSelected && !isDisabled && (
                <motion.div
                  layoutId="stepper-pill"
                  className="absolute inset-0 rounded-[12px]"
                  style={{
                    background: "linear-gradient(180deg, var(--accent-bright), var(--accent) 58%, var(--accent-deep))",
                    boxShadow: "var(--elevation-3)",
                  }}
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
      {disabledCaption && (
        <span className="block min-h-4 text-center text-xs text-foreground-muted">
          {segments.some((o) => o > max)
            ? disabledCaption(Math.min(...segments.filter((o) => o > max)))
            : ""}
        </span>
      )}
    </div>
  );
}
