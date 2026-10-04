import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadTvStoreClientConfig } from "./src/config.js";

export default defineConfig(() => {
  const clientConfig = loadTvStoreClientConfig();
  return {
    plugins: [react()],
    base: "./",
    define: {
      __ZUI_TV_STORE_CLIENT_CONFIG__: JSON.stringify(clientConfig),
    },
    build: { outDir: "dist/client", emptyOutDir: true },
    server: { host: "127.0.0.1", port: 4283, strictPort: true },
  };
});
