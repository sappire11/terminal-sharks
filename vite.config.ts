import { defineConfig } from "vite";

// Tauri loads the dev server from a fixed URL (src-tauri/tauri.conf.json → build.devUrl).
export default defineConfig({
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: "es2022" },
});
