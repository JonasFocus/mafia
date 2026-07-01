"use client";

import { motion } from "framer-motion";

export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  function handleToggle() {
    if (disabled) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(8);
    }
    onChange(!checked);
  }

  return (
    <div className="flex items-center justify-between gap-4">
      {label && (
        <span className="text-[15px] font-medium text-foreground" style={{ opacity: disabled ? 0.4 : 1 }}>
          {label}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={handleToggle}
        className="relative flex shrink-0 items-center justify-center disabled:opacity-40 disabled:pointer-events-none"
        style={{ width: 44, height: 44 }}
      >
        <span
          className="relative block rounded-full"
          style={{
            width: 44,
            height: 26,
            background: checked ? "var(--accent)" : "var(--surface-raised)",
            boxShadow: checked
              ? "0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent)"
              : "inset 0 1px 2px rgba(0,0,0,0.4)",
            transition: "background 0.2s ease, box-shadow 0.2s ease",
          }}
        >
          <motion.span
            className="absolute top-[3px] rounded-full bg-white"
            style={{ width: 20, height: 20, boxShadow: "var(--elevation-2)" }}
            animate={{ x: checked ? 21 : 3 }}
            initial={false}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </span>
      </button>
    </div>
  );
}
