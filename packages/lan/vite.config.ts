import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import path from "node:path";

// Builds the browser side of the LAN edition into dist/public.
// Sprites, sounds, etc. are taken straight from the website's public folder.
export default defineConfig({
  root: __dirname,
  base: "./",
  publicDir: path.resolve(__dirname, "../website/public"),
  plugins: [
    tsConfigPaths({
      projects: [".", "../website", "../game-shared", "../game-client"],
    }),
    tailwindcss(),
    viteReact(),
  ],
  define: {
    "import.meta.env.VITE_LOCAL": JSON.stringify("false"),
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
});
