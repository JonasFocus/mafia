const RING_COLORS = [
  "#d7a85d", // candle gold
  "#70d8ae", // mint
  "#e03f4b", // red
  "#b9a2ff", // lavender
  "#d88f61", // copper
  "#83b7d9", // steel blue
  "#d6c39a", // parchment
  "#d07396", // muted rose
];

export function ringColorFor(index: number) {
  return RING_COLORS[index % RING_COLORS.length];
}

export type AvatarVariant = "neutral" | "civilian" | "mafia" | "active";

const VARIANT_RING_COLOR: Record<AvatarVariant, string> = {
  neutral: "var(--surface-border-strong)",
  civilian: "var(--civilian-glow)",
  mafia: "var(--outsider-glow)",
  active: "var(--accent-bright)",
};

export function Avatar({
  name,
  index,
  size = 44,
  dimmed = false,
  ring = true,
  variant,
  isHost = false,
}: {
  name: string;
  index: number;
  size?: number;
  dimmed?: boolean;
  ring?: boolean;
  /** Role-based ring color. Falls back to the per-index palette color when omitted. */
  variant?: AvatarVariant;
  /** Shows a small gold host badge overlapping the bottom edge. */
  isHost?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const fillColor = ringColorFor(index);
  const ringColor = variant ? VARIANT_RING_COLOR[variant] : fillColor;
  const isActive = variant === "active";

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-[18%] font-display font-semibold transition-opacity"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 32% 24%, ${fillColor}44, var(--surface-overlay) 68%, var(--surface) 100%)`,
        boxShadow: ring
          ? [
              "inset 0 1px 2px rgba(255,246,232,0.24)",
              "inset 0 -5px 10px rgba(0,0,0,0.34)",
              `0 0 0 2px ${ringColor}`,
              isActive ? "0 0 0 5px color-mix(in srgb, var(--accent) 16%, transparent)" : "",
            ]
              .filter(Boolean)
              .join(", ")
          : undefined,
        opacity: dimmed ? 0.35 : 1,
        color: "var(--foreground)",
        fontSize: size * 0.4,
        animation: isActive ? "spotlight-pulse 4.5s ease-in-out infinite" : undefined,
      }}
    >
      {initial}
      {isHost && (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 -left-1 flex items-center justify-center rounded-full font-display font-bold"
          style={{
            width: size * 0.4,
            height: size * 0.4,
            fontSize: size * 0.19,
            background: "var(--gold-glow)",
            color: "var(--background-deep)",
            boxShadow: "var(--elevation-2)",
          }}
        >
          H
        </span>
      )}
    </div>
  );
}
