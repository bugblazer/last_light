// Bundles the LAN server (game server + static file host) into one CommonJS file.
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

await build({
  entryPoints: [path.join(root, "server/main.ts")],
  outfile: path.join(root, "dist/last-light-server.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  minify: false,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  alias: {
    "uwebsockets.js": path.join(here, "uws-stub.cjs"),
  },
  // Optional native speed-ups that `ws` loads inside try/catch.
  external: ["bufferutil", "utf-8-validate"],
});
