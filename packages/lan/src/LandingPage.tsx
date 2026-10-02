import { useEffect, useMemo, useState } from "react";
import { InstructionPanel } from "~/routes/play/-components/InstructionPanel";
import changelog from "~/routes/changelog.json";
import {
  NAME_RULE,
  PLAYER_COLORS,
  PLAYER_COLOR_HEX,
  saveProfile,
  type PlayerColor,
  type Profile,
} from "./profile";
import { LeaderboardTable, useLeaderboard } from "./LeaderboardTable";

type LanInfo = { urls: string[]; players: number };

const COLOR_LABEL = (c: PlayerColor) => (c === "none" ? "Default" : c[0].toUpperCase() + c.slice(1));

export function LandingPage({
  profile,
  onProfileChange,
  onPlay,
  notice,
}: {
  profile: Profile;
  onProfileChange: (p: Profile) => void;
  onPlay: () => void;
  notice?: string | null;
}) {
  const [name, setName] = useState(profile.name);
  const [color, setColor] = useState<PlayerColor>(profile.color);
  const [touched, setTouched] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [info, setInfo] = useState<LanInfo | null>(null);
  const { entries, error } = useLeaderboard(profile.id);

  const nameValid = NAME_RULE.test(name);
  const me = entries?.find((e) => e.isYou);

  useEffect(() => {
    fetch("./lan-info", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setInfo(d))
      .catch(() => {});
  }, []);

  // Persist profile edits as they happen.
  useEffect(() => {
    if (!nameValid) return;
    if (name === profile.name && color === profile.color) return;
    saveProfile({ name, color });
    onProfileChange({ ...profile, name, color });
  }, [name, color, nameValid, profile, onProfileChange]);

  const play = () => {
    setTouched(true);
    if (!nameValid) {
      const input = document.getElementById("lan-player-name") as HTMLInputElement | null;
      input?.focus();
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onPlay();
  };

  const latest = useMemo(() => (changelog as any[])[0], []);
  const latestItems: string[] = latest
    ? [...(latest.changes?.features ?? []), ...(latest.changes?.bugFixes ?? [])].slice(0, 4)
    : [];

  return (
    <div className="relative h-screen w-full overflow-y-auto text-white" style={{ backgroundColor: "#00080e" }}>
      {/* Key art */}
      <div aria-hidden className="landing-banner relative w-full overflow-hidden">
        <img
          src="./splash3.jpg"
          alt=""
          className="absolute left-1/2 top-0 h-full w-auto max-w-none -translate-x-1/2"
          style={{
            maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#00080e]" />
      </div>

      <div className="relative z-10 mx-auto -mt-16 w-full max-w-6xl px-4 pb-16 sm:px-6">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <p className="max-w-2xl text-base leading-relaxed text-gray-300 md:text-lg">
            Team up with friends on the same Wi-Fi. Gather resources, craft weapons, build
            defenses, and fight waves of zombies that grow stronger each night.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={play}
              className="rounded-md bg-red-600 px-12 py-4 text-lg font-bold uppercase tracking-widest text-white shadow-lg shadow-red-900/50 transition hover:scale-[1.03] hover:bg-red-700 hover:shadow-red-900/70"
            >
              Play
            </button>
            <button
              type="button"
              onClick={() => setShowControls(true)}
              className="rounded-md border-2 border-slate-600 bg-slate-800 px-6 py-3.5 font-bold uppercase tracking-wider text-white transition hover:border-red-600 hover:bg-slate-700"
            >
              Controls
            </button>
            <a
              href="#leaderboard"
              className="rounded-md border-2 border-slate-600 bg-slate-800 px-6 py-3.5 font-bold uppercase tracking-wider text-white transition hover:border-red-600 hover:bg-slate-700"
            >
              Leaderboard
            </a>
          </div>
          {touched && !nameValid && (
            <p className="mt-3 text-sm text-red-400">Set a player name below before you play.</p>
          )}
          {notice && <p className="mt-3 text-sm text-gray-400">{notice}</p>}
        </section>

        {/* Profile + leaderboard */}
        <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Profile */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/85 p-5 backdrop-blur-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold uppercase tracking-[0.15em]">Your profile</h2>
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Saved on this device
              </span>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-zinc-800 bg-black"
                style={{ boxShadow: `inset 0 -3px 0 ${PLAYER_COLOR_HEX[color]}` }}
              >
                <img
                  src="./player.png"
                  alt=""
                  className="h-11 w-11 object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
              <label className="flex-1">
                <span className="text-xs uppercase tracking-wider text-gray-400">Player name</span>
                <input
                  id="lan-player-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16))}
                  onBlur={() => setTouched(true)}
                  onKeyDown={(e) => e.key === "Enter" && play()}
                  placeholder="4–16 characters"
                  maxLength={16}
                  spellCheck={false}
                  className={`mt-1 w-full rounded-md border bg-black px-3 py-2 text-base text-white outline-none transition focus:border-orange-400 ${
                    touched && !nameValid ? "border-red-500" : "border-zinc-700"
                  }`}
                />
              </label>
            </div>
            <p className={`mt-1.5 text-xs ${touched && !nameValid ? "text-red-400" : "text-gray-500"}`}>
              Letters, numbers, _ and -. At least 4 characters.
            </p>

            <div className="mt-5">
              <span className="text-xs uppercase tracking-wider text-gray-400">
                Character color · <span className="text-gray-300">{COLOR_LABEL(color)}</span>
              </span>
              <div role="radiogroup" aria-label="Character color" className="mt-2 flex flex-wrap gap-2">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={COLOR_LABEL(c)}
                    title={COLOR_LABEL(c)}
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full transition ${
                      color === c
                        ? "ring-2 ring-orange-400 ring-offset-2 ring-offset-zinc-950"
                        : "ring-1 ring-black/60 hover:scale-110"
                    }`}
                    style={{ backgroundColor: PLAYER_COLOR_HEX[c] }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-5 text-center">
              <Stat label="Best wave" value={me?.maxWave} />
              <Stat label="Zombie kills" value={me?.zombieKills} />
              <Stat label="Rank" value={me ? `#${me.rank}` : undefined} />
            </div>
          </div>

          {/* Leaderboard */}
          <div
            id="leaderboard"
            className="scroll-mt-6 rounded-lg border border-zinc-800 bg-zinc-950/85 p-5 backdrop-blur-sm"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold uppercase tracking-[0.15em]">Top survivors</h2>
              <span className="text-[11px] uppercase tracking-wider text-gray-500">
                Everyone who played on this host
              </span>
            </div>
            <div className="mt-3">
              <LeaderboardTable entries={entries} error={error} />
            </div>
          </div>
        </section>

        {/* Join info + what's new */}
        <section className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/85 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-300">
              Invite friends
            </h2>
            {info && info.urls.length > 0 ? (
              <>
                <p className="mt-2 text-sm text-gray-400">
                  On the same Wi-Fi, they open this in their browser:
                </p>
                {info.urls.slice(0, 2).map((u) => (
                  <p key={u} className="mt-1 select-all font-mono text-base text-amber-300">
                    {u}
                  </p>
                ))}
                <p className="mt-2 text-xs text-gray-500">
                  {info.players} player{info.players === 1 ? "" : "s"} in the game right now
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-gray-400">
                The host computer isn't connected to a network, so only it can play.
              </p>
            )}
          </div>

          {latest && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/85 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-gray-300">
                What's new · v{latest.version}
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-gray-400">
                {latestItems.length ? (
                  latestItems.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-red-500">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li>Improvements and fixes.</li>
                )}
              </ul>
            </div>
          )}
        </section>
      </div>

      <InstructionPanel isOpen={showControls} onClose={() => setShowControls(false)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value ?? "–"}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
    </div>
  );
}
