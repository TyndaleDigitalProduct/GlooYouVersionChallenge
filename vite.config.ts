import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { apiRoutes } from "./vite-plugin-api-routes";

export default defineConfig({
  // apiRoutes is dev-only: it serves the api/ Vercel functions from the Vite
  // dev server so `pnpm dev` exercises the real routes. See the plugin header.
  plugins: [react(), apiRoutes()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // ADR-0002: import the arcade-only build (313 KB gzipped) and never
      // pull in Matter physics. The npm package's "exports" map only
      // declares the "." entry (the full bundle), so an aliased absolute
      // path is required to reach the arcade-only dist file at all.
      phaser: path.resolve(__dirname, "node_modules/phaser/dist/phaser-arcade-physics.js"),
    },
  },
});
