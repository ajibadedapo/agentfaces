import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENT_STATES, EXPRESSION_NAMES, SHAPE_NAMES } from "../src/index";
import { buildFaceSet } from "../src/svg/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function exportStills(target = join(root, "dist", "stills")): string[] {
  rmSync(target, { recursive: true, force: true });
  const written: string[] = [];
  for (const shape of SHAPE_NAMES) {
    for (const [file, content] of Object.entries(buildFaceSet(shape).files)) {
      const path = join(target, shape, file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content);
      written.push(path);
    }
  }
  const index = join(target, "index.json");
  writeFileSync(index, `${JSON.stringify({ shapes: SHAPE_NAMES, states: AGENT_STATES, expressions: EXPRESSION_NAMES }, null, 2)}\n`);
  written.push(index);
  return written;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const written = exportStills(process.argv[2]);
  console.log(`wrote ${written.length} files`);
}
