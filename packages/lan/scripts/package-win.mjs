// Packages the LAN build into a single Windows executable (Node.js SEA).
//
//   dist/last-light-server.cjs + dist/public/**  -->  release/LastLight.exe
//
// Works from Windows, macOS or Linux. Requires the official Windows node.exe of
// the SAME version as the Node running this script (SEA blobs are version-specific):
//   - set NODE_WIN_EXE=/path/to/node.exe, or
//   - let this script fetch it from the npm package `node-win-x64@<version>`.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dist = path.join(root, "dist");
const publicDir = path.join(dist, "public");
const seaDir = path.join(dist, "sea");
const releaseDir = path.join(root, "release");
const exeName = "LastLight.exe";

const nodeVersion = process.version.slice(1);
const gameVersion = JSON.parse(
  fs.readFileSync(path.join(root, "../../package.json"), "utf8")
).version;

function log(msg) {
  console.log(`[package-win] ${msg}`);
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out;
}

// 1. Sanity checks -----------------------------------------------------------
if (!fs.existsSync(path.join(dist, "last-light-server.cjs")) || !fs.existsSync(path.join(publicDir, "index.html"))) {
  throw new Error("Build output missing. Run `npm run build` in packages/lan first.");
}

// 2. Locate the Windows node.exe ------------------------------------------------
function getWindowsNode() {
  if (process.env.NODE_WIN_EXE) return process.env.NODE_WIN_EXE;
  const cacheDir = path.join(root, ".cache", `node-win-x64-${nodeVersion}`);
  const exe = path.join(cacheDir, "package", "bin", "node.exe");
  if (fs.existsSync(exe)) return exe;
  fs.mkdirSync(cacheDir, { recursive: true });
  log(`Fetching Windows node.exe v${nodeVersion} from npm (node-win-x64)...`);
  const tgz = execFileSync("npm", ["pack", `node-win-x64@${nodeVersion}`, "--silent"], {
    cwd: cacheDir,
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim().split("\n").pop();
  execFileSync("tar", ["xzf", tgz], { cwd: cacheDir });
  if (!fs.existsSync(exe)) throw new Error(`node.exe not found after extracting ${tgz}`);
  return exe;
}
const nodeExe = getWindowsNode();
log(`Using ${nodeExe}`);

// 3. SEA config + blob ------------------------------------------------------------
fs.rmSync(seaDir, { recursive: true, force: true });
fs.mkdirSync(seaDir, { recursive: true });

const assets = {};
for (const rel of walk(publicDir)) assets[`public/${rel}`] = path.join(publicDir, rel);
log(`Embedding ${Object.keys(assets).length} game files`);

const seaConfig = {
  main: path.join(dist, "last-light-server.cjs"),
  output: path.join(seaDir, "sea-prep.blob"),
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false, // must be false when building for another platform
  assets,
};
const seaConfigPath = path.join(seaDir, "sea-config.json");
fs.writeFileSync(seaConfigPath, JSON.stringify(seaConfig, null, 2));
execFileSync(process.execPath, ["--experimental-sea-config", seaConfigPath], { stdio: "inherit" });

// 4. Inject the SEA blob into a copy of node.exe ------------------------------------
fs.rmSync(releaseDir, { recursive: true, force: true });
fs.mkdirSync(releaseDir, { recursive: true });
const outExe = path.join(releaseDir, exeName);
fs.copyFileSync(nodeExe, outExe);

const postjectCli = require.resolve("postject/dist/cli.js");
execFileSync(
  process.execPath,
  [
    postjectCli,
    outExe,
    "NODE_SEA_BLOB",
    path.join(seaDir, "sea-prep.blob"),
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ],
  { stdio: "inherit" }
);

// 5. Icon + version info (also drops the now-invalid Node.js signature) ---------------------
const ResEdit = require("resedit");
const PELibrary = require("pe-library");

const exeData = fs.readFileSync(outExe);
const exe = PELibrary.NtExecutable.from(exeData, { ignoreCert: true });
const res = PELibrary.NtExecutableResource.from(exe);

const iconFile = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(root, "assets", "icon.ico")));
const iconGroups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const iconGroupId = iconGroups.length ? iconGroups[0].id : 1;
const iconLang = iconGroups.length ? iconGroups[0].lang : 1033;
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries,
  iconGroupId,
  iconLang,
  iconFile.icons.map((i) => i.data)
);

const versionInfos = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
const vi = versionInfos[0] || ResEdit.Resource.VersionInfo.createEmpty();
const [maj, min, pat] = gameVersion.split(".").map((n) => parseInt(n, 10) || 0);
vi.setFileVersion(maj, min, pat, 0, 1033);
vi.setProductVersion(maj, min, pat, 0, 1033);
vi.setStringValues(
  { lang: 1033, codepage: 1200 },
  {
    ProductName: "Last Light (LAN)",
    FileDescription: "Last Light - LAN multiplayer server",
    CompanyName: "Last Light",
    OriginalFilename: exeName,
    InternalName: "LastLight",
    LegalCopyright: "MIT License",
    FileVersion: gameVersion,
    ProductVersion: gameVersion,
  }
);
vi.outputToResourceEntries(res.entries);
res.outputResource(exe);

fs.writeFileSync(outExe, Buffer.from(exe.generate()));

// 6. Player instructions -------------------------------------------------------------
fs.copyFileSync(path.join(root, "HOW-TO-PLAY.txt"), path.join(releaseDir, "HOW-TO-PLAY.txt"));

const size = (fs.statSync(outExe).size / 1024 / 1024).toFixed(1);
log(`Done: ${path.relative(process.cwd(), outExe)} (${size} MB, game v${gameVersion}, node v${nodeVersion})`);
if (os.platform() !== "win32") log("Tip: zip the release/ folder to share it.");
