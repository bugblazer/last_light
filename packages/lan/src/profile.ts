/**
 * Local player profile, stored in this browser only.
 * The game client already reads `displayName` and `playerColor` from
 * localStorage, so the profile uses those same keys.
 */
export const PLAYER_COLORS = [
  "none", "red", "orange", "yellow", "lime", "green", "cyan",
  "blue", "purple", "magenta", "pink", "brown", "gray",
] as const;
export type PlayerColor = (typeof PLAYER_COLORS)[number];

export const PLAYER_COLOR_HEX: Record<PlayerColor, string> = {
  none: "#FFFFFF",
  red: "#FF4444",
  orange: "#FF8844",
  yellow: "#FFFF44",
  lime: "#88FF44",
  green: "#44FF44",
  cyan: "#44FFFF",
  blue: "#4488FF",
  purple: "#8844FF",
  magenta: "#FF44FF",
  pink: "#FF88BB",
  brown: "#AA6644",
  gray: "#888888",
};

export const NAME_RULE = /^[a-zA-Z0-9_-]{4,16}$/;

export type Profile = { id: string; name: string; color: PlayerColor };

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode etc. */
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Fallback for non-secure contexts (plain http on a LAN IP has no randomUUID)
  const bytes = new Uint8Array(16);
  const c = (globalThis as any).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function loadProfile(): Profile {
  let id = safeGet("lanProfileId");
  if (!id || !/^[a-zA-Z0-9-]{8,64}$/.test(id)) {
    id = newId();
    safeSet("lanProfileId", id);
  }
  const color = safeGet("playerColor") as PlayerColor | null;
  return {
    id,
    name: safeGet("displayName") || "",
    color: color && (PLAYER_COLORS as readonly string[]).includes(color) ? color : "none",
  };
}

export function saveProfile(p: Pick<Profile, "name" | "color">): void {
  safeSet("displayName", p.name);
  safeSet("playerColor", p.color);
}

/** Registers the profile with the host and returns a game pass for stats tracking. */
export async function requestGamePass(p: Profile): Promise<string | null> {
  try {
    const res = await fetch("./lan-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId: p.id, name: p.name, color: p.color }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.token === "string" ? data.token : null;
  } catch {
    return null;
  }
}
