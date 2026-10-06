import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("shadcn registry", () => {
  const source = JSON.parse(read("registry.json"));
  const built = JSON.parse(read("docs/public/r/agent-face.json"));

  it("publishes the agent-face item built from the current source", () => {
    expect(built.$schema).toBe("https://ui.shadcn.com/schema/registry-item.json");
    expect(built.name).toBe("agent-face");
    expect(built.type).toBe("registry:component");
    expect(built.dependencies).toEqual(["agentfaces"]);
    expect(built.files).toHaveLength(1);
    expect(built.files[0].target).toBe("components/agent-face.tsx");
    expect(built.files[0].content).toBe(read(source.items[0].files[0].path));
  });

  it("ships a client component that only depends on the agentfaces package", () => {
    const content: string = built.files[0].content;
    expect(content.startsWith('"use client";')).toBe(true);
    const imports = Array.from(content.matchAll(/from "([^"]+)"/g), (match) => match[1]);
    expect(imports.every((name) => name === "agentfaces" || name.startsWith("agentfaces/"))).toBe(true);
  });
});
