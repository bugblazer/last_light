/**
 * LAN lobby: the host computer picks the game mode for the first match.
 *
 * Until the host chooses, every browser shows the mode-selection screen
 * (read-only for guests) and does not join the game. After the first match,
 * the game's built-in end-of-match voting decides the next mode as usual.
 *
 *   GET  /lan-lobby        -> { modeSelected, mode, isHost }
 *   POST /lan-lobby/start  -> body { mode }   (host only)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import type { GameServer } from "../../game-server/src/core/server";
import {
  WavesModeStrategy,
  BattleRoyaleModeStrategy,
  InfectionModeStrategy,
  type IGameModeStrategy,
} from "../../game-server/src/game-modes";

export type LobbyMode = "waves" | "battle_royale" | "infection";
const MODES: LobbyMode[] = ["waves", "battle_royale", "infection"];

let selectedMode: LobbyMode | null = null;

function createStrategy(mode: LobbyMode): IGameModeStrategy {
  switch (mode) {
    case "battle_royale":
      return new BattleRoyaleModeStrategy();
    case "infection":
      return new InfectionModeStrategy();
    default:
      return new WavesModeStrategy();
  }
}

/** A request counts as "the host" when it comes from this computer itself. */
export function isHostRequest(req: IncomingMessage): boolean {
  let addr = req.socket.remoteAddress || "";
  if (addr.startsWith("::ffff:")) addr = addr.slice(7);
  if (addr === "127.0.0.1" || addr === "::1" || addr.startsWith("127.")) return true;
  for (const list of Object.values(os.networkInterfaces())) {
    for (const info of list || []) {
      if (info.address === addr) return true;
    }
  }
  return false;
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage, limit = 4096): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > limit) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

/**
 * Handles lobby routes. Returns true when the request was handled.
 */
export function handleLobbyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  getGameServer: () => GameServer | null
): boolean {
  const path = (req.url || "").split("?")[0];
  if (path !== "/lan-lobby" && path !== "/lan-lobby/start") return false;

  if (path === "/lan-lobby" && req.method === "GET") {
    sendJson(res, 200, {
      modeSelected: selectedMode !== null,
      mode: selectedMode,
      isHost: isHostRequest(req),
    });
    return true;
  }

  if (path === "/lan-lobby/start" && req.method === "POST") {
    if (!isHostRequest(req)) {
      sendJson(res, 403, { error: "Only the host computer can choose the game mode." });
      return true;
    }
    readBody(req)
      .then((raw) => {
        let mode: LobbyMode | undefined;
        try {
          mode = JSON.parse(raw || "{}").mode;
        } catch {
          /* handled below */
        }
        if (!mode || !MODES.includes(mode)) {
          sendJson(res, 400, { error: "Unknown game mode." });
          return;
        }
        const gameServer = getGameServer();
        if (!gameServer) {
          sendJson(res, 503, { error: "Server is still starting, try again." });
          return;
        }

        const gameLoop = gameServer.getGameLoop();
        const firstChoice = selectedMode === null;
        selectedMode = mode;

        const anyoneConnected = gameLoop.getIsGameReady();
        if (anyoneConnected) {
          // A game is already running (e.g. someone joined early): restart it in the chosen mode.
          gameLoop.startNewGame(createStrategy(mode));
        } else {
          // Nobody is in yet: the first player to connect starts the game in this mode.
          gameLoop.setGameModeStrategy(createStrategy(mode));
        }
        console.log(
          `  Host ${firstChoice ? "chose" : "changed"} the game mode: ${mode.replace("_", " ")}`
        );
        sendJson(res, 200, { modeSelected: true, mode });
      })
      .catch(() => sendJson(res, 400, { error: "Bad request." }));
    return true;
  }

  res.writeHead(405);
  res.end();
  return true;
}
