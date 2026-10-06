import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: process.env.DOCS_BASE ?? "/agentfaces/",
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^agentfaces\/react$/, replacement: src("react/index.ts") },
      { find: /^agentfaces\/svg$/, replacement: src("svg/index.ts") },
      { find: /^agentfaces$/, replacement: src("index.ts") },
    ],
  },
  build: { outDir: "dist", emptyOutDir: true },
});
