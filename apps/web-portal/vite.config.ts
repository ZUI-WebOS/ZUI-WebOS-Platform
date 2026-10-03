import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import {
  DEFAULT_WEB_MANAGER_DEV_PORT,
  loadWebManagerConfig,
} from "./src/config.js";

const webManager = loadWebManagerConfig();

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/client", emptyOutDir: false },
  server: {
    host: webManager.host,
    port: DEFAULT_WEB_MANAGER_DEV_PORT,
    strictPort: true,
    proxy: { "/api": `http://${webManager.host}:${webManager.port}` },
  },
});
