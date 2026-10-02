import { useEffect, useState } from "react";

type LanInfo = { urls: string[]; players: number; hostName: string };

/**
 * Small, dismissible badge that tells everyone which address friends on the
 * same Wi-Fi should open to join this game.
 */
export function LanInfoBadge() {
  const [info, setInfo] = useState<LanInfo | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("./lan-info", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => !cancelled && data && setInfo(data))
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!info || info.urls.length === 0) return null;

  // Sits in the empty strip between the sound button and the hotbar.
  const position = "fixed left-[68px] bottom-4 z-[10000]";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${position} rounded-md bg-gray-800/90 px-2.5 py-1.5 text-xs text-white hover:bg-gray-700`}
        title="Show join address"
      >
        LAN · {info.players} online
      </button>
    );
  }

  return (
    <div
      className={`${position} max-w-[260px] rounded-md border border-gray-700 bg-gray-900/90 px-3 py-2 text-xs text-gray-300 shadow-lg`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="uppercase tracking-wide text-gray-400">Friends join at</span>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white" title="Hide">
          ✕
        </button>
      </div>
      {info.urls.slice(0, 2).map((url) => (
        <div key={url} className="select-all font-mono text-[13px] leading-5 text-amber-300">
          {url}
        </div>
      ))}
      <div className="text-gray-500">
        {info.players} player{info.players === 1 ? "" : "s"} online · same Wi-Fi only
      </div>
    </div>
  );
}
