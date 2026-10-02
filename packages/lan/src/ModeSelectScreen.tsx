import { useCallback, useEffect, useRef, useState } from "react";

export type GameMode = "waves" | "battle_royale" | "infection";

type LobbyState = { modeSelected: boolean; mode: GameMode | null; isHost: boolean };

type ModeInfo = {
  id: GameMode;
  name: string;
  tag: string;
  description: string;
  win: string;
  sprites: string[];
};

const MODES: ModeInfo[] = [
  {
    id: "waves",
    name: "Waves",
    tag: "Co-op",
    description: "Survive the night through incoming zombie waves and protect your base.",
    win: "Everyone wins by surviving the waves together.",
    sprites: ["zombie.png", "zombie.png", "zombie.png"],
  },
  {
    id: "battle_royale",
    name: "Battle Royale",
    tag: "Solo",
    description: "Solo battle royale where you fight for survival against humans and zombies.",
    win: "The last player standing wins.",
    sprites: ["player.png"],
  },
  {
    id: "infection",
    name: "Infection",
    tag: "Humans vs. zombie",
    description:
      "One random player gets infected and becomes the zombie. Humans must survive to win, and the zombie must turn everyone into zombies.",
    win: "Humans win by surviving. The zombie wins by infecting everyone.",
    sprites: ["player.png", "zombie.png"],
  },
];

const modeName = (id: GameMode | null) => MODES.find((m) => m.id === id)?.name ?? "";

async function fetchLobby(): Promise<LobbyState | null> {
  try {
    const res = await fetch("./lan-lobby", { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Shown before the first match. The host computer picks the mode; everyone
 * else sees the same options and joins automatically once the host has chosen.
 */
export function ModeSelectScreen({ onReady, onBack }: { onReady: () => void; onBack?: () => void }) {
  const [lobby, setLobby] = useState<LobbyState | null>(null);
  const [selected, setSelected] = useState<GameMode>("waves");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onReady();
  }, [onReady]);

  // Poll the lobby. Guests wait here until the host has picked a mode.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;
    const tick = async () => {
      const state = await fetchLobby();
      if (cancelled) return;
      if (state) {
        setLobby(state);
        if (state.modeSelected && state.mode) {
          setSelected(state.mode);
          // Short pause so guests can see what the host picked.
          timer = setTimeout(finish, state.isHost ? 0 : 1500);
          return;
        }
      }
      timer = setTimeout(tick, 1500);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [finish]);

  const isHost = !!lobby?.isHost;
  const chosen = lobby?.modeSelected ? lobby.mode : null;

  const start = useCallback(async () => {
    if (!isHost || starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch("./lan-lobby/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: selected }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server returned ${res.status}`);
      }
      finish();
    } catch (e: any) {
      setError(e?.message || "Could not start the match.");
      setStarting(false);
    }
  }, [isHost, starting, selected, finish]);

  // Host keyboard shortcuts: 1-3 to pick, Enter to start.
  useEffect(() => {
    if (!isHost || chosen) return;
    const onKey = (e: KeyboardEvent) => {
      const idx = ["1", "2", "3"].indexOf(e.key);
      if (idx >= 0) setSelected(MODES[idx].id);
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const cur = MODES.findIndex((m) => m.id === selected);
        const next = (cur + (e.key === "ArrowRight" ? 1 : MODES.length - 1)) % MODES.length;
        setSelected(MODES[next].id);
      } else if (e.key === "Enter") start();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isHost, chosen, selected, start]);

  const interactive = isHost && !chosen && !starting;
  const highlighted = chosen ?? (isHost ? selected : null);

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-y-auto bg-black text-white">
      {/* Key art banner: the Last Light logo over the campfire */}
      <div aria-hidden className="lan-banner relative w-full shrink-0 overflow-hidden">
        {/* Sized from the banner height so the logo (top ~35% of the art) is never cropped */}
        <img
          src="./splash2.jpg"
          alt=""
          className="absolute left-1/2 top-0 h-[270%] w-auto max-w-none -translate-x-1/2 opacity-80"
          style={{
            maskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
            WebkitMaskImage: "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black" />
      </div>

      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="fixed left-4 top-4 z-20 rounded-md bg-black/60 px-3 py-1.5 text-sm text-gray-300 backdrop-blur hover:text-white"
        >
          ← Back
        </button>
      )}

      <div className="relative z-10 mt-2 flex w-full max-w-5xl flex-col px-4 pb-10 sm:px-6">
        <header className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">
            {isHost ? "You are the host" : "LAN match"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold uppercase tracking-[0.12em] sm:text-4xl">
            Choose game mode
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-400">
            Three modes, three different ways to win. The host picks the first match. After that,
            everyone votes on the next mode at the end of each match.
          </p>
        </header>

        <div role="radiogroup" aria-label="Game mode" className="grid gap-4 md:grid-cols-3">
          {MODES.map((mode, i) => {
            const active = highlighted === mode.id;
            const dimmed = !!chosen && !active;
            return (
              <button
                key={mode.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={!interactive}
                onClick={() => setSelected(mode.id)}
                onDoubleClick={() => interactive && start()}
                className={[
                  "group relative flex flex-col rounded-lg border p-5 text-left transition",
                  "bg-gradient-to-b from-zinc-900/90 to-black/90 backdrop-blur-sm",
                  active
                    ? "border-orange-400 shadow-[0_0_0_1px_rgba(251,146,60,0.6),0_0_32px_-6px_rgba(251,146,60,0.55)]"
                    : "border-zinc-700/80",
                  interactive ? "cursor-pointer hover:border-zinc-400" : "cursor-default",
                  dimmed ? "opacity-40" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-12 items-end gap-1">
                    {mode.sprites.map((src, k) => (
                      <img
                        key={k}
                        src={`./${src}`}
                        alt=""
                        className="h-12 w-12 object-contain"
                        style={{ imageRendering: "pixelated" }}
                      />
                    ))}
                  </div>
                  {isHost && !chosen && (
                    <kbd className="rounded border border-zinc-600 px-1.5 py-0.5 text-[11px] text-zinc-400">
                      {i + 1}
                    </kbd>
                  )}
                </div>

                <h2 className="mt-4 text-2xl font-semibold uppercase tracking-wide">{mode.name}</h2>
                <span className="mt-1 text-xs uppercase tracking-[0.2em] text-orange-300">
                  {mode.tag}
                </span>
                <p className="mb-4 mt-3 text-sm leading-relaxed text-gray-300">
                  {mode.description}
                </p>
                <p className="mt-auto border-t border-zinc-800 pt-3 text-xs text-gray-400">
                  <span className="mr-1 font-semibold uppercase tracking-wider text-gray-300">
                    Win:
                  </span>
                  {mode.win}
                </p>
              </button>
            );
          })}
        </div>

        <footer className="mt-8 flex min-h-[3.5rem] flex-col items-center gap-2">
          {!lobby ? (
            <p className="text-sm text-gray-400">Connecting to the host…</p>
          ) : chosen ? (
            <p className="text-lg text-orange-200">
              The host picked <span className="font-semibold">{modeName(chosen)}</span>. Joining…
            </p>
          ) : isHost ? (
            <>
              <button
                type="button"
                onClick={start}
                disabled={starting}
                className="rounded-md bg-orange-600 px-10 py-3 text-lg font-semibold uppercase tracking-widest text-white transition hover:bg-orange-500 disabled:opacity-60"
              >
                {starting ? "Starting…" : `Start ${modeName(selected)}`}
              </button>
              <p className="text-xs text-gray-500">Press 1–3 to choose, Enter to start</p>
            </>
          ) : (
            <p className="flex items-center gap-3 text-base text-gray-300">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-400" />
              Waiting for the host to choose a game mode…
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}
        </footer>
      </div>
    </div>
  );
}
