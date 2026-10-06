import { describe, expect, it } from "vitest";
import { DEFAULT_PALETTE, faceFor, SHAPE_NAMES, SHAPE_PATHS, STATE_LABEL, STATE_MOTION } from "../index";

describe("faceFor", () => {
  it("is deterministic", () => {
    expect(faceFor("agent-42")).toEqual(faceFor("agent-42"));
  });

  it("only uses the shapes and palette it is given", () => {
    const palette = ["#111111", "#222222", "#333333"];
    for (let i = 0; i < 200; i++) {
      const face = faceFor(`seed-${i}`, { shapes: ["triangle", "square"], palette });
      expect(["triangle", "square"]).toContain(face.shape);
      expect(palette).toContain(face.color);
    }
  });

  it("maps every seed to circle, triangle or square by default", () => {
    expect(Object.keys(SHAPE_PATHS).sort()).toEqual(["circle", "square", "triangle"]);
    expect([...SHAPE_NAMES].sort()).toEqual(["circle", "square", "triangle"]);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(faceFor(`seed-${i}`).shape);
    expect(seen.size).toBe(3);
  });

  it("falls back to the defaults for empty shape or palette lists", () => {
    const face = faceFor("x", { shapes: [], palette: [] });
    expect(SHAPE_NAMES).toContain(face.shape);
    expect(DEFAULT_PALETTE).toContain(face.color);
  });

  it("handles empty, very long and non-ASCII seeds", () => {
    for (const seed of ["", "x".repeat(10000), "Ọ̀rẹ́ 🤖 日本"]) {
      const face = faceFor(seed);
      expect(SHAPE_PATHS[face.shape]).toBeTruthy();
      expect(DEFAULT_PALETTE).toContain(face.color);
    }
  });

  it("spreads different seeds across colors", () => {
    const colors = new Set(Array.from({ length: 60 }, (_, i) => faceFor(`crew-${i}`).color));
    expect(colors.size).toBeGreaterThanOrEqual(7);
  });

  it("labels and animates the core states", () => {
    for (const s of ["idle", "thinking", "working", "needs-you", "done", "alert", "celebrate", "sleeping"] as const) {
      expect(STATE_LABEL[s].length).toBeGreaterThan(0);
      expect(STATE_MOTION[s].duration).toBeGreaterThan(0);
    }
    expect(STATE_MOTION.done.loop).toBe(false);
  });
});
