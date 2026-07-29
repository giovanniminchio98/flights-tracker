import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Project site on GitHub Pages is served from /<repo-name>/, so all
// asset URLs need that base path baked in at build time.
export default defineConfig({
  base: "/flights-tracker/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
