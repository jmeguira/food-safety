import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const port = process.env.PORT ?? "3000";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/web", emptyOutDir: true },
  server: { proxy: { "/api": `http://127.0.0.1:${port}` } },
});
