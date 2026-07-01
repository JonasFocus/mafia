import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 safe-top safe-bottom overflow-hidden">
      <div
        className="spotlight-pulse pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%)" }}
      />

      <div className="relative w-full max-w-sm flex flex-col items-center text-center gap-3 mb-14">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-[28px] text-3xl font-display font-bold mb-2"
          style={{
            background: "linear-gradient(155deg, var(--accent-bright), var(--accent) 60%, #4a3fb8)",
            color: "var(--accent-foreground)",
            boxShadow: "0 12px 40px -12px color-mix(in srgb, var(--accent) 70%, transparent)",
          }}
        >
          ?
        </div>
        <h1 className="font-display text-5xl font-bold tracking-tight">Mafia</h1>
        <p className="text-foreground-muted text-[15px] max-w-[280px] leading-relaxed">
          Everyone knows the word. One of you is bluffing. Find them before they survive three rounds.
        </p>
      </div>

      <div className="relative w-full max-w-sm flex flex-col gap-3">
        <Link
          href="/host"
          className="flex h-14 items-center justify-center rounded-full font-display font-semibold text-base active:scale-[0.96] transition-transform"
          style={{
            background: "linear-gradient(135deg, var(--accent-bright), var(--accent))",
            color: "var(--accent-foreground)",
            boxShadow: "0 8px 24px -8px color-mix(in srgb, var(--accent) 60%, transparent)",
          }}
        >
          Host a Game
        </Link>
        <Link
          href="/join"
          className="flex h-14 items-center justify-center rounded-full bg-surface-raised text-foreground font-display font-semibold text-base active:scale-[0.96] transition-transform"
          style={{ boxShadow: "inset 0 0 0 1px var(--surface-border)" }}
        >
          Join a Game
        </Link>
      </div>
    </main>
  );
}
