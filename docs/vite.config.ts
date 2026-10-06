import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const src = (path: string) => fileURLToPath(new URL(`../src/${path}`, import.meta.url));
const repoFile = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

const ROOT_FILES = ["llms.txt", "llms-full.txt"];

function rootFiles(): Plugin {
  return {
    name: "agentfaces-root-files",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = ROOT_FILES.find((name) => req.url?.endsWith(`/${name}`));
        if (!file) return next();
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.end(readFileSync(repoFile(file)));
      });
    },
    generateBundle() {
      for (const fileName of ROOT_FILES) this.emitFile({ type: "asset", fileName, source: readFileSync(repoFile(fileName), "utf8") });
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: process.env.DOCS_BASE ?? "/agentfaces/",
  plugins: [react(), rootFiles()],
  resolve: {
    alias: [
      { find: /^agentfaces\/react$/, replacement: src("react/index.ts") },
      { find: /^agentfaces\/svg$/, replacement: src("svg/index.ts") },
      { find: /^agentfaces$/, replacement: src("index.ts") },
    ],
  },
  build: { outDir: "dist", emptyOutDir: true },
});
