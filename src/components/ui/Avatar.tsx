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

export function Avatar({
  name,
  index,
  size = 44,
  dimmed = false,
  ring = true,
}: {
  name: string;
  index: number;
  size?: number;
  dimmed?: boolean;
  ring?: boolean;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const color = ringColorFor(index);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full font-display font-semibold transition-opacity"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 25%, ${color}55, var(--surface-raised) 75%)`,
        boxShadow: ring ? `0 0 0 2px ${color}88` : undefined,
        opacity: dimmed ? 0.35 : 1,
        color: "var(--foreground)",
        fontSize: size * 0.4,
      }}
    >
      {initial}
    </div>
  );
}
