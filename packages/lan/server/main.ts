/**
 * Last Light – LAN edition entry point.
 *
 * One person runs this (as LastLight.exe on Windows). It:
 *   1. hosts the authoritative game server, and
 *   2. serves the browser game on the SAME port,
 * so anyone on the same Wi-Fi can play by opening http://<host-ip>:<port>.
 */
import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import readline from "node:readline";
import crypto from "node:crypto";

// Must be set before any game code is loaded (config is read at import time).
process.env.WEBSOCKET_IMPLEMENTATION = "ws";
process.env.NODE_ENV = process.env.NODE_ENV || "production";

const DEFAULT_PORT = 3001;
const PORT_ATTEMPTS = 10;

// ---------------------------------------------------------------------------
// Fatal error handling: keep the console window open so the message is readable
// ---------------------------------------------------------------------------
let fatalShown = false;
function fatal(message: string): void {
  if (fatalShown) return;
  fatalShown = true;
  console.error("\n  [ERROR] " + message + "\n");
  if (process.stdin.isTTY) {
    console.error("  Press Enter to close this window.");
    const rl = readline.createInterface({ input: process.stdin });
    rl.once("line", () => process.exit(1));
  } else {
    process.exit(1);
  }
}
process.on("uncaughtException", (err) => fatal(err?.stack || String(err)));
process.on("unhandledRejection", (err: any) => fatal(err?.stack || String(err)));

// ---------------------------------------------------------------------------
// Static files (embedded in the .exe, or read from disk when run with Node)
// ---------------------------------------------------------------------------
type StaticFile = { body: Buffer; type: string };

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function loadSea(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sea = require("node:sea");
    return sea.isSea() ? sea : null;
  } catch {
    return null;
  }
}

function createStaticSource(): (urlPath: string) => StaticFile | null {
  const sea = loadSea();
  const cache = new Map<string, StaticFile | null>();

  const resolveDiskRoot = (): string => {
    const candidates = [
      process.env.LAST_LIGHT_PUBLIC_DIR,
      path.join(path.dirname(process.execPath), "public"),
      path.join(__dirname, "public"),
      path.join(__dirname, "..", "dist", "public"),
    ].filter(Boolean) as string[];
    for (const dir of candidates) {
      if (fs.existsSync(path.join(dir, "index.html"))) return dir;
    }
    throw new Error(
      "Could not find the game files (public/index.html). Run `npm run build:client` first."
    );
  };
  const diskRoot = sea ? null : resolveDiskRoot();

  return (urlPath: string) => {
    let rel = decodeURIComponent(urlPath.split("?")[0]).replace(/\\/g, "/");
    rel = path.posix.normalize(rel).replace(/^(\.\.(\/|$))+/, "").replace(/^\/+/, "");
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    if (rel.includes("..")) return null;

    if (cache.has(rel)) return cache.get(rel)!;

    let body: Buffer | null = null;
    try {
      if (sea) {
        body = Buffer.from(sea.getRawAsset("public/" + rel));
      } else {
        const file = path.join(diskRoot!, rel);
        if (fs.statSync(file).isFile()) body = fs.readFileSync(file);
      }
    } catch {
      body = null;
    }

    const result = body
      ? { body, type: MIME[path.extname(rel).toLowerCase()] || "application/octet-stream" }
      : null;
    cache.set(rel, result);
    return result;
  };
}

// ---------------------------------------------------------------------------
// Networking helpers
// ---------------------------------------------------------------------------
function getLanAddresses(): string[] {
  const out: { addr: string; score: number }[] = [];
  const ifaces = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifaces)) {
    for (const info of list || []) {
      if (info.family !== "IPv4" || info.internal) continue;
      if (info.address.startsWith("169.254.")) continue; // link-local, unusable
      const lname = name.toLowerCase();
      let score = 0;
      if (/wi-?fi|wlan|wireless/.test(lname)) score += 3;
      if (/ethernet|^en|^eth/.test(lname)) score += 2;
      if (/virtual|vmware|vbox|hyper-v|vethernet|docker|wsl|loopback|tailscale|zerotier/.test(lname))
        score -= 5;
      if (/^192\.168\./.test(info.address)) score += 1;
      out.push({ addr: info.address, score });
    }
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.addr);
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = http.createServer();
    tester.once("error", () => resolve(false));
    tester.once("listening", () => tester.close(() => resolve(true)));
    tester.listen(port, "0.0.0.0");
  });
}

async function pickPort(): Promise<number> {
  const requested = Number(process.env.PORT || process.argv[2]) || DEFAULT_PORT;
  for (let p = requested; p < requested + PORT_ATTEMPTS; p++) {
    if (await isPortFree(p)) return p;
    console.warn(`  Port ${p} is busy, trying ${p + 1}...`);
  }
  throw new Error(
    `Ports ${requested}-${requested + PORT_ATTEMPTS - 1} are all in use. ` +
      `Is Last Light already running? Close it or start with a different port.`
  );
}

function openBrowser(url: string): void {
  if (process.env.LAST_LIGHT_NO_BROWSER === "1") return;
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore" }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
    }
  } catch {
    /* not fatal */
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (process.platform === "win32") process.title = "Last Light – LAN Server";

  const port = await pickPort();
  const getStatic = createStaticSource();

  // Local profiles + leaderboard. The game server's stats tracker sends to
  // WEBSITE_API_URL with GAME_SERVER_API_KEY; the leaderboard intercepts that.
  const apiKey = crypto.randomBytes(32).toString("hex");
  process.env.GAME_SERVER_API_KEY = apiKey;
  const statsBaseUrl = "http://last-light.lan-stats.invalid";
  process.env.WEBSITE_API_URL = statsBaseUrl;
  // Chat admin commands (/spawn, /mode, ...) would let anyone cheat onto the
  // leaderboard, so lock them with a random password unless the host sets one.
  process.env.ADMIN_PASSWORD ||= crypto.randomBytes(16).toString("hex");
  const { Leaderboard } = await import("./leaderboard");
  const leaderboard = new Leaderboard(apiKey);
  leaderboard.installStatsFetchShim(statsBaseUrl);

  // Load game code only now that the environment is configured.
  const { setHttpRequestHandler } = await import(
    "../../game-server/src/network/http-request-handler"
  );
  const { getActiveWsConnectionCount } = await import(
    "../../game-server/src/network/ws-server-adapter"
  );

  const { handleLobbyRequest } = await import("./lobby");
  let gameServer: import("../../game-server/src/core/server").GameServer | null = null;

  setHttpRequestHandler((req, res) => {
    const url = req.url || "/";

    if (handleLobbyRequest(req, res, () => gameServer)) return;
    if (leaderboard.handle(req, res)) return;

    if (url.startsWith("/lan-info")) {
      const body = JSON.stringify({
        urls: getLanAddresses().map((a) => `http://${a}:${port}`),
        players: getActiveWsConnectionCount(),
        hostName: os.hostname(),
      });
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(body);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }

    const file = getStatic(url);
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": file.type,
      "Content-Length": file.body.length,
      "Cache-Control": url.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : file.body);
  });

  const { GameServer } = await import("../../game-server/src/core/server");
  gameServer = new GameServer(port);
  const server = gameServer;

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n  Shutting down Last Light server...");
    try {
      server.stop();
    } catch {
      /* ignore */
    }
    // Push any stats still waiting in the 15s batch, then save the leaderboard.
    import("../../game-server/src/services/kill-tracker")
      .then(({ KillTracker }) => KillTracker.getInstance().shutdown())
      .catch(() => {});
    setTimeout(() => {
      leaderboard.saveNow();
      process.exit(0);
    }, 700);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGHUP", shutdown); // Windows: console window closed

  const lanUrls = getLanAddresses().map((a) => `http://${a}:${port}`);
  const line = "=".repeat(62);
  console.log(`
${line}
   LAST LIGHT  -  LAN multiplayer server is running
${line}

   Play on this computer:   http://localhost:${port}
   (Choose the game mode in your browser to start the match.)
`);
  if (lanUrls.length) {
    console.log("   Friends on the SAME Wi-Fi open this in their browser:");
    for (const u of lanUrls) console.log(`      ${u}`);
  } else {
    console.log("   (No Wi-Fi / network connection found - only local play is available.)");
  }
  console.log(`
   * If Windows Firewall asks, click "Allow access" (Private networks).
   * Keep this window open while you play. Close it to stop the server.
   * Leaderboard is saved in: ${leaderboard.dataFile}
${line}
`);

  openBrowser(`http://localhost:${port}`);
}

main().catch((err) => fatal(err?.stack || String(err)));
