import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Relative base so the build works from any static host path (e.g. GitHub Pages /lifeline/).
export default defineConfig({
  base: "./",
  plugins: [react()],
});
