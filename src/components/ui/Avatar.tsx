const RING_COLORS = [
  "#8b7bff", // accent violet
  "#8ff0c4", // mint
  "#e6b3ea", // lavender
  "#f3cd7e", // gold
  "#7ec8f3", // sky
  "#f39e8e", // coral
  "#b8f38e", // lime
  "#f38ec9", // pink
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
        background: `radial-gradient(circle at 30% 25%, ${fillColor}55, var(--surface-raised) 75%)`,
        boxShadow: ring
          ? [
              "inset 0 2px 3px rgba(255,255,255,0.25)",
              "inset 0 -3px 4px rgba(0,0,0,0.3)",
              `0 0 0 2px ${ringColor}`,
              isActive ? "0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent)" : "",
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
          className="absolute -bottom-1 -left-1 flex items-center justify-center rounded-full font-display font-bold"
          style={{
            width: size * 0.4,
            height: size * 0.4,
            fontSize: size * 0.22,
            background: "var(--gold-glow)",
            color: "var(--background-deep)",
            boxShadow: "var(--elevation-2)",
          }}
        >
          ★
        </span>
      )}
    </div>
  );
}
