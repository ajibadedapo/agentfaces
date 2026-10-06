import { describe, expect, it } from "vitest";
import { EXPRESSION_NAMES } from "./expressions";
import { Performer } from "./performer";
import { FACE_ANCHORS } from "./anchors";
import { renderFaceSvg } from "./still";
import { pathNumbers } from "./path";
import { SHAPE_PATHS } from "./shapes";
import { AGENT_STATES, CORE_STATES, EXTENDED_STATES, ORNAMENT_STATES, VOICE_STATES, STATE_CONFETTI, STATE_EXPRESSIONS, STATE_LABEL, STATE_ORNAMENT, STATE_MOTION, placementVariant, restExpression } from "./states";
import { tempo } from "./tempo";
import type { ShapeName } from "./shapes";

describe("placementVariant", () => {
  it("keeps every face in a list still whatever its state", () => {
    for (const state of AGENT_STATES) expect(placementVariant(state, "list")).toBe("still");
  });

  it("only moves a featured face when it carries a real state beyond resting", () => {
    expect(placementVariant("idle", "feature")).toBe("still");
    expect(placementVariant("sleeping", "feature")).toBe("still");
    for (const state of ["working", "thinking", "needs-you", "done", "alert", "celebrate"] as const) expect(placementVariant(state, "feature")).toBe("live");
  });
});

describe("states", () => {
  it("leads with the core agent work states, then extended, ornament and voice states", () => {
    expect(CORE_STATES).toEqual(["idle", "thinking", "working", "needs-you", "done", "alert", "celebrate", "sleeping"]);
    expect(EXTENDED_STATES).toEqual(["starting", "attentive", "exploring", "waiting", "handing-off", "heads-up"]);
    expect(ORNAMENT_STATES).toEqual(["typing", "running", "monitoring", "background"]);
    expect(VOICE_STATES).toEqual(["listening", "speaking"]);
    expect(AGENT_STATES).toHaveLength(20);
    expect(new Set(AGENT_STATES).size).toBe(AGENT_STATES.length);
  });

  it.each(AGENT_STATES)("%s has a label, a motion, a pool and a cadence", (state) => {
    expect(STATE_LABEL[state].length).toBeGreaterThan(0);
    expect(STATE_MOTION[state].duration).toBeGreaterThan(0);
    expect(STATE_EXPRESSIONS[state].cadence).toBeGreaterThan(500);
    expect(STATE_EXPRESSIONS[state].pool.length).toBeGreaterThan(0);
    for (const name of STATE_EXPRESSIONS[state].pool) expect(EXPRESSION_NAMES).toContain(name);
    expect(restExpression(state)).toBe(STATE_EXPRESSIONS[state].pool[0]);
  });

  it("derives every duration and cadence from the tempo scale", () => {
    const scale = new Set(Array.from({ length: 16 }, (_, step) => tempo(step)));
    for (const state of AGENT_STATES) {
      expect(scale.has(STATE_MOTION[state].duration)).toBe(true);
      expect(scale.has(STATE_EXPRESSIONS[state].cadence)).toBe(true);
    }
    expect(tempo(0)).toBe(400);
    expect(tempo(3)).toBe(800);
    expect(tempo(9)).toBe(3200);
  });

  it("keeps the core motions", () => {
    expect(STATE_MOTION.idle.kind).toBe("breathe");
    expect(STATE_MOTION.working.kind).toBe("bob");
    expect(STATE_MOTION.thinking.kind).toBe("tilt");
    expect(STATE_MOTION["needs-you"].kind).toBe("pulse");
    expect(STATE_MOTION.done).toEqual({ kind: "hop", duration: 400, loop: false });
    expect(STATE_LABEL["needs-you"]).toBe("Needs you");
  });

  it("maps every ornament state to an ornament and only celebrate to confetti", () => {
    expect(Object.keys(STATE_ORNAMENT).sort()).toEqual([...ORNAMENT_STATES].sort());
    expect(Object.keys(STATE_CONFETTI)).toEqual(["celebrate"]);
  });
});

describe("Performer", () => {
  it("produces identical frames for the same seed and settles to a still frame", () => {
    const frames = (seed: string) => {
      const p = new Performer(seed, FACE_ANCHORS.circle, { state: "idle" });
      const out: string[] = [];
      for (let t = 0; t < 20000; t += 16) {
        const g = p.update(t, 16);
        if (g) out.push(JSON.stringify(g));
      }
      return out;
    };
    const a = frames("same");
    expect(a).toEqual(frames("same"));
    expect(a).not.toEqual(frames("other"));
    expect(a.length).toBeLessThan(20000 / 16);
    expect(a.length).toBeGreaterThan(60);
  });

  it("returns null once settled and resumes on the next cue", () => {
    const p = new Performer("still", FACE_ANCHORS.square, { state: "sleeping", expression: "drowsy" });
    let nulls = 0;
    let frames = 0;
    for (let t = 0; t < 12000; t += 16) {
      if (p.update(t, 16)) frames++;
      else nulls++;
    }
    expect(nulls).toBeGreaterThan(frames);
  });

  it("lets the eyes lead and the mouth follow 40 to 80 ms later", () => {
    const p = new Performer("lag", FACE_ANCHORS.circle, { state: "idle", expression: "calm" });
    for (let t = 0; t < 3000; t += 16) p.update(t, 16);
    p.set({ state: "idle", expression: "startled" });
    const mouthHeight = (d: string) => {
      const ys = pathNumbers(d).filter((_, i) => i % 2 === 1);
      return Math.max(...ys) - Math.min(...ys);
    };
    let eyesMovedAt = -1;
    let mouthMovedAt = -1;
    let last = p.update(3000, 16)!;
    for (let t = 3016; t < 4000 && (eyesMovedAt < 0 || mouthMovedAt < 0); t += 8) {
      const g = p.update(t, 8) ?? last;
      if (eyesMovedAt < 0 && Math.abs(g.left.cy - last.left.cy) > 0.001) eyesMovedAt = t;
      if (mouthMovedAt < 0 && Math.abs(mouthHeight(g.mouth.d) - mouthHeight(last.mouth.d)) > 0.01) mouthMovedAt = t;
      last = g;
    }
    expect(eyesMovedAt).toBeGreaterThan(0);
    expect(mouthMovedAt - eyesMovedAt).toBeGreaterThanOrEqual(32);
    expect(mouthMovedAt - eyesMovedAt).toBeLessThanOrEqual(96);
  });

  it("blinks fast shut and slower open", () => {
    const p = new Performer("blink", FACE_ANCHORS.circle, { state: "sleeping", expression: "calm" });
    const closedness: Array<{ t: number; v: number }> = [];
    for (let t = 0; t < 12000; t += 8) {
      const g = p.update(t, 8);
      if (g) closedness.push({ t, v: 1 - g.left.scaleY });
    }
    const peak = closedness.reduce((best, f) => (f.v > best.v ? f : best), closedness[0]);
    expect(peak.v).toBeGreaterThan(0.2);
    const before = closedness.filter((f) => f.t < peak.t && f.t > peak.t - 400);
    const after = closedness.filter((f) => f.t > peak.t && f.t < peak.t + 400);
    const closeStart = before.find((f) => f.v > 0.01)!.t;
    const openEnd = [...after].reverse().find((f) => f.v > 0.01)!.t;
    expect(peak.t - closeStart).toBeLessThan(openEnd - peak.t);
  });

  it("turns the head toward the gaze and drifts slowly", () => {
    const p = new Performer("turn", FACE_ANCHORS.circle, { state: "idle", expression: "calm" });
    const xs: number[] = [];
    for (let t = 0; t < 8000; t += 16) {
      const g = p.update(t, 16);
      if (g) xs.push(g.mouth.d.split(" ")[1] as unknown as number);
    }
    expect(new Set(xs.map(Number)).size).toBeGreaterThan(20);
  });

  it("rest frame uses the state's first expression", () => {
    const p = new Performer("r", FACE_ANCHORS.triangle, { state: "done" });
    expect(p.rest().mouth.d).toBe(new Performer("x", FACE_ANCHORS.triangle, { state: "done", expression: "pleased" }).rest().mouth.d);
  });
});

describe("renderFaceSvg", () => {
  const shapes = Object.keys(SHAPE_PATHS) as ShapeName[];

  it.each(shapes)("renders %s with the body, two eyes and a mouth", (shape) => {
    const svg = renderFaceSvg({ shape, color: "#2B90FF", expression: "glad", size: 64, label: "Ada, Idle" });
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).toContain(SHAPE_PATHS[shape]);
    expect(svg).toContain('role="img" aria-label="Ada, Idle"');
    expect((svg.match(/<g transform=/g) ?? []).length).toBe(2);
    expect((svg.match(/stroke-linejoin="round"/g) ?? []).length).toBe(1);
    expect(svg).toContain("color:#2B90FF");
  });

  it("labels from the state by default and escapes custom labels", () => {
    expect(renderFaceSvg({ shape: "circle", color: "#000", state: "needs-you" })).toContain('aria-label="Needs you"');
    expect(renderFaceSvg({ shape: "circle", color: "#000", label: 'A "quoted" <agent>' })).toContain('aria-label="A &quot;quoted&quot; &lt;agent&gt;"');
  });

  it("omits the mouth when asked and hides decorative art", () => {
    const svg = renderFaceSvg({ shape: "circle", color: "#000", expression: "calm", mouth: false, decorative: true });
    expect(svg).not.toContain("stroke-linejoin");
    expect(svg).toContain('aria-hidden="true"');
  });
});
