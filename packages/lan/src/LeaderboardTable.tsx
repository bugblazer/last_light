import { useEffect, useMemo, useState } from "react";
import { PLAYER_COLOR_HEX, type PlayerColor } from "./profile";

export type LeaderboardEntry = {
  rank: number;
  name: string;
  color: PlayerColor;
  zombieKills: number;
  wavesCompleted: number;
  maxWave: number;
  lastSeen: number;
  isYou: boolean;
};

type SortKey = "maxWave" | "zombieKills" | "wavesCompleted";

const COLUMNS: { key: SortKey; label: string; hint: string }[] = [
  { key: "maxWave", label: "Best wave", hint: "Highest wave survived" },
  { key: "zombieKills", label: "Zombie kills", hint: "Zombies killed, all modes" },
  { key: "wavesCompleted", label: "Waves survived", hint: "Total waves survived" },
];

export function useLeaderboard(profileId: string, refreshMs = 10000) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch(`./lan-leaderboard?me=${encodeURIComponent(profileId)}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          if (!cancelled) {
            setEntries(d.entries);
            setError(false);
          }
        })
        .catch(() => !cancelled && setError(true));
    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [profileId, refreshMs]);

  return { entries, error };
}

export function LeaderboardTable({
  entries,
  error,
  limit = 10,
}: {
  entries: LeaderboardEntry[] | null;
  error: boolean;
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("maxWave");
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    if (!entries) return [];
    const order: SortKey[] = [sortKey, ...COLUMNS.map((c) => c.key).filter((k) => k !== sortKey)];
    return [...entries].sort((a, b) => {
      for (const k of order) if (b[k] !== a[k]) return b[k] - a[k];
      return b.lastSeen - a.lastSeen;
    });
  }, [entries, sortKey]);

  if (error && !entries) {
    return <p className="py-8 text-center text-sm text-gray-400">Couldn't reach the host.</p>;
  }
  if (!entries) {
    return <p className="py-8 text-center text-sm text-gray-500">Loading…</p>;
  }
  if (entries.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-gray-300">No survivors yet.</p>
        <p className="mt-1 text-sm text-gray-500">Play a match to get on the board.</p>
      </div>
    );
  }

  const you = sorted.findIndex((e) => e.isYou);
  const rows = showAll ? sorted : sorted.slice(0, limit);
  // Always show your own row, even when you're outside the top N.
  const youOutside = !showAll && you >= limit;

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-left text-[11px] uppercase tracking-wider text-gray-500">
            <th className="w-10 py-2 pr-2 font-normal">#</th>
            <th className="py-2 pr-2 font-normal">Player</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="py-2 pl-2 text-right font-normal">
                <button
                  type="button"
                  title={c.hint}
                  onClick={() => setSortKey(c.key)}
                  className={`uppercase tracking-wider hover:text-white ${
                    sortKey === c.key ? "text-orange-300" : ""
                  }`}
                >
                  {c.label}
                  {sortKey === c.key ? " ↓" : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e, i) => (
            <Row key={`${e.name}-${i}`} entry={e} place={i + 1} />
          ))}
          {youOutside && (
            <>
              <tr>
                <td colSpan={5} className="py-1 text-center text-xs text-gray-600">
                  ⋯
                </td>
              </tr>
              <Row entry={sorted[you]} place={you + 1} />
            </>
          )}
        </tbody>
      </table>
      {sorted.length > limit && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-xs uppercase tracking-wider text-gray-400 hover:text-white"
        >
          {showAll ? "Show top " + limit : `Show all ${sorted.length} players`}
        </button>
      )}
    </div>
  );
}

function Row({ entry: e, place }: { entry: LeaderboardEntry; place: number }) {
  const medal = place === 1 ? "text-amber-300" : place === 2 ? "text-zinc-300" : place === 3 ? "text-orange-400" : "text-gray-500";
  return (
    <tr
      className={`border-b border-zinc-900 ${
        e.isYou ? "bg-orange-500/10 text-white" : "text-gray-300"
      }`}
    >
      <td className={`py-2 pr-2 font-semibold tabular-nums ${medal}`}>{place}</td>
      <td className="py-2 pr-2">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/40"
            style={{ backgroundColor: PLAYER_COLOR_HEX[e.color] ?? "#fff" }}
          />
          <span className="truncate">{e.name}</span>
          {e.isYou && (
            <span className="rounded bg-orange-500/20 px-1.5 text-[10px] uppercase tracking-wider text-orange-300">
              You
            </span>
          )}
        </span>
      </td>
      <td className="py-2 pl-2 text-right tabular-nums">{e.maxWave}</td>
      <td className="py-2 pl-2 text-right tabular-nums">{e.zombieKills}</td>
      <td className="py-2 pl-2 text-right tabular-nums">{e.wavesCompleted}</td>
    </tr>
  );
}
