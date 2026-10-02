/**
 * Local profiles + leaderboard for the LAN edition.
 *
 * Every browser keeps a local profile (random id + name + color). When a player
 * presses Play, the page asks this server for a game pass for that profile. The
 * pass uses the same signed-token format the website issues, so the game
 * server's existing stats tracking (KillTracker) credits kills and waves to the
 * profile. KillTracker "posts" batched stats to the website URL; in the LAN
 * build that request is intercepted and recorded here, in-process.
 *
 * The leaderboard is stored as JSON on the host computer, so it builds up over
 * every match played on that computer:
 *   Windows: %APPDATA%\LastLight\leaderboard.json
 *   other:   ~/.last-light/leaderboard.json
 *
 *   POST /lan-profile              { profileId, name, color } -> { token }
 *   GET  /lan-leaderboard?me=<id>  -> { entries, dataFile }
 *   Stats uploads from the game server are handled in-process (see installStatsFetchShim).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type Record_ = {
  name: string;
  color: string;
  zombieKills: number;
  wavesCompleted: number;
  maxWave: number;
  firstSeen: number;
  lastSeen: number;
};

type Store = { version: 1; players: Record<string, Record_> };

const PROFILE_ID_RE = /^[a-zA-Z0-9-]{8,64}$/;
const NAME_RE = /^[a-zA-Z0-9_-]{4,16}$/;
const COLORS = new Set([
  "none", "red", "orange", "yellow", "lime", "green", "cyan",
  "blue", "purple", "magenta", "pink", "brown", "gray",
]);
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const USER_PREFIX = "lan_";

export function getDataDir(): string {
  if (process.env.LAST_LIGHT_DATA_DIR) return process.env.LAST_LIGHT_DATA_DIR;
  if (process.platform === "win32") {
    const base = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(base, "LastLight");
  }
  return path.join(os.homedir(), ".last-light");
}

export class Leaderboard {
  private readonly file: string;
  private store: Store = { version: 1, players: {} };
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly apiKey: string) {
    this.file = path.join(getDataDir(), "leaderboard.json");
    this.load();
  }

  get dataFile(): string {
    return this.file;
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (raw && typeof raw === "object" && raw.players && typeof raw.players === "object") {
        this.store = { version: 1, players: raw.players };
      }
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        // Keep the unreadable file for the user instead of silently overwriting it.
        const backup = `${this.file}.broken-${Date.now()}`;
        try {
          fs.renameSync(this.file, backup);
          console.warn(`  Leaderboard file was unreadable; saved a copy as ${backup}`);
        } catch {
          /* ignore */
        }
      }
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, 2000);
  }

  saveNow(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.store, null, 2));
      fs.renameSync(tmp, this.file);
    } catch (err: any) {
      console.error(`  Could not save leaderboard: ${err?.message || err}`);
    }
  }

  private touch(profileId: string): Record_ {
    let rec = this.store.players[profileId];
    if (!rec) {
      rec = {
        name: "Survivor",
        color: "none",
        zombieKills: 0,
        wavesCompleted: 0,
        maxWave: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
      };
      this.store.players[profileId] = rec;
    }
    return rec;
  }

  /** Signed game pass in the same format the website issues: base64(userId:expiresAt:hmac). */
  private issueToken(profileId: string): string {
    const userId = USER_PREFIX + profileId;
    const expiresAt = String(Date.now() + TOKEN_TTL_MS);
    const sig = crypto.createHmac("sha256", this.apiKey).update(`${userId}:${expiresAt}`).digest("hex");
    return Buffer.from(`${userId}:${expiresAt}:${sig}`).toString("base64");
  }

  entries(me?: string) {
    const rows = Object.entries(this.store.players)
      .map(([id, r]) => ({
        name: r.name,
        color: r.color,
        zombieKills: r.zombieKills,
        wavesCompleted: r.wavesCompleted,
        maxWave: r.maxWave,
        lastSeen: r.lastSeen,
        isYou: !!me && id === me,
      }))
      .sort(
        (a, b) =>
          b.maxWave - a.maxWave ||
          b.zombieKills - a.zombieKills ||
          b.wavesCompleted - a.wavesCompleted ||
          b.lastSeen - a.lastSeen
      );
    return rows.map((r, i) => ({ rank: i + 1, ...r }));
  }

  /** Handles profile / leaderboard / stats routes. Returns true when handled. */
  handle(req: IncomingMessage, res: ServerResponse): boolean {
    const [pathname, query = ""] = (req.url || "").split("?");

    if (pathname === "/lan-leaderboard" && req.method === "GET") {
      const me = new URLSearchParams(query).get("me") || undefined;
      sendJson(res, 200, { entries: this.entries(me), dataFile: this.file });
      return true;
    }

    if (pathname === "/lan-profile" && req.method === "POST") {
      readJson(req)
        .then((body) => {
          const { profileId, name, color } = body || {};
          if (typeof profileId !== "string" || !PROFILE_ID_RE.test(profileId)) {
            return sendJson(res, 400, { error: "Invalid profile id." });
          }
          if (typeof name !== "string" || !NAME_RE.test(name)) {
            return sendJson(res, 400, {
              error: "Name must be 4-16 letters, numbers, _ or -.",
            });
          }
          const rec = this.touch(profileId);
          rec.name = name;
          if (typeof color === "string" && COLORS.has(color)) rec.color = color;
          rec.lastSeen = Date.now();
          this.scheduleSave();
          sendJson(res, 200, { token: this.issueToken(profileId) });
        })
        .catch(() => sendJson(res, 400, { error: "Bad request." }));
      return true;
    }

    return false;
  }

  /** Adds a stats batch from the game server's KillTracker. Returns false for unknown users. */
  recordStats(body: any): boolean {
    const userId: unknown = body?.userId;
    if (typeof userId !== "string" || !userId.startsWith(USER_PREFIX)) return false;
    const profileId = userId.slice(USER_PREFIX.length);
    if (!PROFILE_ID_RE.test(profileId)) return false;
    const num = (v: unknown) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.floor(v) : 0);
    const rec = this.touch(profileId);
    rec.zombieKills += num(body.zombieKills);
    rec.wavesCompleted += num(body.wavesCompleted);
    rec.maxWave = Math.max(rec.maxWave, num(body.maxWave));
    rec.lastSeen = Date.now();
    this.scheduleSave();
    return true;
  }

  /**
   * Routes the game server's stats uploads (normally sent to the website with
   * fetch) straight into this leaderboard, in-process, without any networking.
   */
  installStatsFetchShim(baseUrl: string): void {
    const target = `${baseUrl}/api/game/player-stats`;
    const realFetch = globalThis.fetch.bind(globalThis);
    const json = (status: number, data: unknown) =>
      new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === "string" ? input : input?.url ?? String(input);
      if (url !== target) return realFetch(input, init);
      const headers = new Headers(init?.headers);
      if (headers.get("x-api-key") !== this.apiKey) return json(401, { error: "Unauthorized" });
      let body: any;
      try {
        body = JSON.parse(typeof init?.body === "string" ? init.body : "{}");
      } catch {
        return json(400, { error: "Bad request." });
      }
      return this.recordStats(body) ? json(200, { ok: true }) : json(400, { error: "Unknown user." });
    }) as typeof fetch;
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readJson(req: IncomingMessage, limit = 8192): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
