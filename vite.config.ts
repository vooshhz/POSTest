import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";

export default defineConfig({
  plugins: [
    react(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              // keep native modules external
              external: ["better-sqlite3", "bindings", "node-gyp-build"],
            },
          },
        },
      },
      preload: { input: "electron/preload.ts" },
    }),
    renderer(),
  ],
});
