import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const skip = new Set(["node_modules", "dist", ".git", "coverage", ".next", ".expo"]);
const binary = /\.(png|jpg|jpeg|gif|webp|ico|woff2?)$/i;
const banned = [{ char: "\u2014", name: "em dash" }];
const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (!binary.test(entry) && entry !== "package-lock.json") {
      const lines = readFileSync(path, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const { char, name } of banned) if (line.includes(char)) problems.push(`${relative(root, path)}:${i + 1} contains an ${name}`);
      });
    }
  }
}

walk(root);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
