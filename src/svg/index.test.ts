import { describe, expect, it } from "vitest";
import { AGENT_STATES, EXPRESSION_NAMES, SHAPE_NAMES, SHAPE_PATHS } from "agentfaces";
import { buildFaceSet, faceSymbol, renderFaceSvg } from "./index";

describe("agentfaces/svg", () => {
  it("builds a still per state and per expression, a sprite and a manifest for a shape", () => {
    const { manifest, files } = buildFaceSet("square");
    expect(manifest.frames).toHaveLength(AGENT_STATES.length + EXPRESSION_NAMES.length);
    expect(manifest.frames.filter((f) => f.kind === "state").map((f) => f.name)).toEqual([...AGENT_STATES]);
    expect(manifest.frames.filter((f) => f.kind === "expression").map((f) => f.name)).toEqual([...EXPRESSION_NAMES]);
    for (const frame of manifest.frames) {
      expect(files[frame.file]).toContain(SHAPE_PATHS.square);
      expect(files[frame.file]).toContain(`aria-label="${frame.label}"`);
    }
    expect((files["sprite.svg"].match(/<symbol /g) ?? []).length).toBe(manifest.frames.length);
    expect(files["sprite.svg"]).toContain('id="square-state-needs-you"');
    const parsed = JSON.parse(files["manifest.json"]);
    expect(parsed.anchor).toEqual(manifest.anchor);
    expect(parsed.pools.idle.pool[0]).toBe("calm");
  });

  it("keeps clip path ids unique across a sprite", () => {
    for (const shape of SHAPE_NAMES) {
      const sprite = buildFaceSet(shape).files["sprite.svg"];
      const ids = [...sprite.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("tints with currentColor by default and renders a symbol", () => {
    expect(buildFaceSet("circle").files["states/idle.svg"]).toContain("color:currentColor");
    expect(faceSymbol("x", { shape: "circle", color: "#000" })).toMatch(/^<symbol id="x" viewBox="0 0 100 100">/);
    expect(renderFaceSvg({ shape: "triangle", color: "#2F6BFF", state: "working", size: 48 })).toContain('width="48" height="48"');
  });
});
