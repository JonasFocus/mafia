"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PlayerGrid } from "@/components/game/PlayerGrid";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { toPlayerView, roleGlow, MAFIA_GLOW, TOWN_GLOW } from "./shared";
import type {
  Game,
  MafiaPlayerView,
  NightAction,
  NightActionType,
  PlayerRole,
} from "@/lib/game/types";

const ROLE_ACTION: Record<
  Exclude<PlayerRole, "faithful">,
  { type: NightActionType; cta: string }
> = {
  mafia: { type: "kill", cta: "Confirm kill" },
  sheriff: { type: "inspect", cta: "Inspect player" },
  angel: { type: "protect", cta: "Protect player" },
};

export function NightScreen({
  game,
  players,
  me,
  myRole,
  fellowMafia,
  nightActions,
  myNightAction,
  myInspectResult,
  userId,
  onSubmit,
}: {
  game: Game;
  players: MafiaPlayerView[];
  me: MafiaPlayerView;
  myRole: PlayerRole;
  fellowMafia: MafiaPlayerView[];
  nightActions: NightAction[];
  myNightAction: NightAction | null;
  myInspectResult: "mafia" | "not_mafia" | null;
  userId: string;
  onSubmit: (actionType: NightActionType, targetId: string) => Promise<void>;
}) {
  void game;
  void me;
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const acted = myNightAction != null;
  const hasNightRole = myRole !== "faithful";

  const nameById = useMemo(
    () => new Map(players.map((p) => [p.userId, p.displayName])),
    [players],
  );

  // Targets each role may act on among the living.
  const targets = useMemo(() => {
    const living = players.filter((p) => !p.isEliminated);
    if (myRole === "mafia") {
      const mafiaIds = new Set([userId, ...fellowMafia.map((f) => f.userId)]);
      return living.filter((p) => !mafiaIds.has(p.userId));
    }
    if (myRole === "sheriff") {
      return living.filter((p) => p.userId !== userId);
    }
    // Angel self-protect is allowed.
    return living;
  }, [players, myRole, fellowMafia, userId]);

  if (!hasNightRole || acted) {
    return (
      <WaitingState
        myRole={myRole}
        acted={acted}
        myInspectResult={myInspectResult}
        myNightAction={myNightAction}
        nameById={nameById}
      />
    );
  }

  const config = ROLE_ACTION[myRole as Exclude<PlayerRole, "faithful">];

  // Fellow-mafia kill picks this round (for coordination hints).
  const teammatePicks =
    myRole === "mafia"
      ? nightActions
          .filter(
            (a) =>
              a.action_type === "kill" &&
              a.actor_id !== userId &&
              a.target_id,
          )
          .map((a) => a.target_id)
      : [];

  const plurality =
    myRole === "mafia" && teammatePicks.length > 0
      ? computePlurality(teammatePicks)
      : null;

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(config.type, selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <NightShell role={myRole}>
      <div className="flex flex-1 flex-col items-center gap-6 w-full max-w-sm mx-auto overflow-y-auto">
        <Header role={myRole} />

        <p className="text-sm text-foreground-muted text-center">
          {myRole === "mafia" && "Agree with the mafia on who to eliminate tonight."}
          {myRole === "sheriff" && "Choose one player to inspect. You'll learn their alignment."}
          {myRole === "angel" && "Choose one player to protect from the mafia tonight."}
        </p>

        {myRole === "mafia" && fellowMafia.length > 0 && (
          <MafiaRail fellowMafia={fellowMafia} />
        )}

        <PlayerGrid
          players={targets.map(toPlayerView)}
          selectedUserId={selected}
          onSelect={(id) => setSelected(id)}
          hintedIds={myRole === "mafia" ? teammatePicks : undefined}
          meId={userId}
        />

        {myRole === "mafia" && plurality && (
          <p className="text-xs text-center text-foreground-muted">
            Mafia leaning toward{" "}
            <span
              className="font-semibold"
              style={{ color: "var(--outsider-glow)" }}
            >
              {nameById.get(plurality.targetId) ?? "someone"}
            </span>{" "}
            ({plurality.count} pick{plurality.count > 1 ? "s" : ""})
          </p>
        )}

        {error && <p className="text-sm text-outsider-glow text-center">{error}</p>}

        <Button
          onClick={handleSubmit}
          disabled={!selected || submitting}
          className="w-full mt-auto"
        >
          {submitting ? "Sending..." : config.cta}
        </Button>
      </div>
    </NightShell>
  );
}

function Header({ role }: { role: PlayerRole }) {
  const label =
    role === "mafia"
      ? "Mafia · Night"
      : role === "sheriff"
        ? "Sheriff · Night"
        : "Angel · Night";
  const glow = roleGlow(role);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="text-xs tracking-widest uppercase"
        style={{ color: glow }}
      >
        {label}
      </span>
      <h1 className="font-display text-2xl font-semibold text-center">
        {role === "mafia" && "Choose a target"}
        {role === "sheriff" && "Inspect someone"}
        {role === "angel" && "Guard someone"}
      </h1>
    </div>
  );
}

function MafiaRail({ fellowMafia }: { fellowMafia: MafiaPlayerView[] }) {
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <span className="text-[11px] tracking-wide uppercase text-foreground-muted">
        Your mafia
      </span>
      <div className="flex items-center justify-center gap-3">
        {fellowMafia.map((f) => (
          <div key={f.userId} className="flex flex-col items-center gap-1">
            <Avatar name={f.displayName} index={f.joinOrder} size={40} variant="mafia" />
            <span className="text-[11px] text-foreground-muted max-w-[64px] truncate">
              {f.displayName}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WaitingState({
  myRole,
  acted,
  myInspectResult,
  myNightAction,
  nameById,
}: {
  myRole: PlayerRole;
  acted: boolean;
  myInspectResult: "mafia" | "not_mafia" | null;
  myNightAction: NightAction | null;
  nameById: Map<string, string>;
}) {
  const showInspect = myRole === "sheriff" && acted;
  const inspectedName =
    myNightAction?.target_id != null
      ? nameById.get(myNightAction.target_id) ?? "them"
      : "them";

  return (
    <NightShell role={myRole}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 w-full max-w-sm mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 22 }}
          className="flex flex-col items-center gap-4"
        >
          <MoonGlyph />

          {showInspect ? (
            <InspectResult
              name={inspectedName}
              result={myInspectResult}
            />
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold">
                Night falls
              </h1>
              <p className="text-sm text-foreground-muted max-w-[16rem]">
                {acted
                  ? "Your move is locked in. Close your eyes while the others act."
                  : "Close your eyes. The mafia is choosing."}
              </p>
            </>
          )}
        </motion.div>
      </div>
    </NightShell>
  );
}

function InspectResult({
  name,
  result,
}: {
  name: string;
  result: "mafia" | "not_mafia" | null;
}) {
  if (result == null) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold">Inspecting...</h1>
        <p className="text-sm text-foreground-muted max-w-[16rem]">
          Waiting on the result for {name}.
        </p>
      </>
    );
  }
  const isMafia = result === "mafia";
  const glow = isMafia ? MAFIA_GLOW : TOWN_GLOW;
  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className="flex flex-col items-center gap-3"
    >
      <span className="text-sm text-foreground-muted">{name} is</span>
      <div
        className="rounded-2xl px-6 py-3 font-display text-2xl font-semibold"
        style={{
          color: glow,
          background: `color-mix(in srgb, ${glow} 14%, transparent)`,
          boxShadow: `0 0 0 1px color-mix(in srgb, ${glow} 45%, transparent), var(--elevation-2)`,
        }}
      >
        {isMafia ? "Mafia" : "Not Mafia"}
      </div>
      <p className="text-xs text-foreground-muted max-w-[16rem]">
        Alignment only. Keep it to yourself until the day.
      </p>
    </motion.div>
  );
}

function MoonGlyph() {
  return (
    <motion.div
      animate={{ scale: [1, 1.04, 1] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="flex h-16 w-16 items-center justify-center rounded-full"
      style={{
        background: "var(--surface-raised)",
        boxShadow: "var(--elevation-2), inset 0 0 20px rgba(0,0,0,0.5)",
      }}
    >
      <span className="role-mark h-10 w-10 text-outsider-glow" />
    </motion.div>
  );
}

function NightShell({
  role,
  children,
}: {
  role: PlayerRole;
  children: React.ReactNode;
}) {
  const tint =
    role === "mafia"
      ? "color-mix(in srgb, var(--outsider-glow) 10%, transparent)"
      : "color-mix(in srgb, var(--accent) 8%, transparent)";
  return (
    <div className="relative flex flex-1 flex-col px-6 py-8 safe-top safe-bottom">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 60% at 50% -10%, ${tint}, transparent 70%)`,
        }}
      />
      <div className="relative flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function computePlurality(
  targetIds: string[],
): { targetId: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const id of targetIds) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  let best: { targetId: string; count: number } | null = null;
  for (const [targetId, count] of counts) {
    if (!best || count > best.count) best = { targetId, count };
  }
  return best;
}
