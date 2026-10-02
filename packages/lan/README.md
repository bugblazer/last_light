# Last Light: LAN edition

A downloadable build of Last Light for playing with friends on the same Wi-Fi. It needs no internet, website, database or accounts.

One person runs `LastLight.exe`. It hosts the game server and serves the browser game on the same port. Everyone else on the network opens `http://<host-ip>:3001` in a browser.

## How it works

| Piece | What it does |
| --- | --- |
| `server/main.ts` | Entry point. It picks a free port (3001 to 3010), serves the game files, exposes `/lan-info` (join URLs and player count), starts the `GameServer`, prints the join addresses and opens the host's browser. |
| `game-server/src/network/ws-server-adapter.ts` | Pure-JS WebSocket server built on `ws`. It uses the same wire protocol as the uWebSockets adapter, so the browser client is unchanged. The native uWebSockets.js binary is left out of the bundle (`WEBSOCKET_IMPLEMENTATION=ws`). |
| `game-server/src/network/http-request-handler.ts` | Hook that lets the game server's HTTP port serve static files. |
| `server/lobby.ts` | The host picks the first match's game mode. `GET /lan-lobby` returns the lobby state; `POST /lan-lobby/start` is accepted only from the host computer (requests from loopback or one of the machine's own IPs). Later matches use the game's built-in voting. |
| `src/ModeSelectScreen.tsx` | Mode-selection screen shown before joining. The host chooses; guests see the same cards and join automatically once the host starts. |
| `server/leaderboard.ts` | Local profiles and the leaderboard. `POST /lan-profile` registers a browser's profile (random id, name, color) and returns a game pass in the website's signed-token format. The game server's existing `KillTracker` then credits kills and waves to that profile, and its stats uploads (normally a `fetch` to the website) are intercepted in-process and recorded here. Stats are saved to `%APPDATA%\LastLight\leaderboard.json` (or `~/.last-light/`); `LAST_LIGHT_DATA_DIR` overrides the folder. |
| `src/LandingPage.tsx` | Home page: key art, Play, Controls, the profile editor (name and color, saved in the browser), the leaderboard, the join address and what's new. |
| `src/` | Vite and React page. It reuses the website's `/play` UI (crafting, name, color and instructions panels) without accounts and admin tools, and adds a "Friends join at" badge. |
| `scripts/build-server.mjs` | Bundles the server into one CommonJS file with esbuild. |
| `scripts/package-win.mjs` | Builds `release/LastLight.exe`, a Node.js Single Executable Application with every game file embedded, plus the icon and version info. |

The online game is unaffected. It still defaults to uWebSockets, and the new hooks do nothing unless the LAN entry point sets them.

## Commands (from the repo root)

```bash
npm install
npm run lan:dev           # build and run the LAN server with Node (http://localhost:3001)
npm run lan:package:win   # build packages/lan/release/LastLight.exe
```

`lan:package:win` works on Windows, macOS or Linux. It needs the official Windows `node.exe` of the same version as the Node running the build. The script gets it from the npm package `node-win-x64@<version>`, or you can point `NODE_WIN_EXE` at a copy you already have.

## Notes

- Windows SmartScreen warns about the exe because it isn't code-signed. Signing it with a code-signing certificate removes the warning.
- The host must allow the Windows Firewall prompt (Private networks). See `HOW-TO-PLAY.txt`.
- Chat admin commands are locked with a random password so nobody can cheat onto the leaderboard. Set `ADMIN_PASSWORD` to enable them again.
- The port can be changed with `PORT=4000` or passed as the first argument.
