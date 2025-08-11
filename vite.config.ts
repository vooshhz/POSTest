import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron/simple";
import renderer from "vite-plugin-electron-renderer";
import path from 'path';

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
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        transactionDetails: path.resolve(__dirname, 'transaction-details.html'),
      },
    },
  },
});
