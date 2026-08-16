import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

// @qassemiya/shared-types ships raw TypeScript (no build step), so it must be
// bundled/transpiled inline by Vite rather than left as an externalized `require()`
// — Node can't load a bare `.ts` file at runtime.
const externalizeOptions = { exclude: ["@qassemiya/shared-types"] };

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(externalizeOptions)],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin(externalizeOptions)],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer/src"),
      },
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "src/renderer/index.html"),
      },
    },
    plugins: [react()],
  },
});
