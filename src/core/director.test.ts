import { describe, expect, it } from "vitest";
import { BLINK_GAP, Director, GAZE_REST, type Cue } from "./director";
import { EXPRESSION_NAMES } from "./expressions";
import { AGENT_STATES, STATE_EXPRESSIONS } from "./states";

function run(seed: string, state: (typeof AGENT_STATES)[number], seconds: number, expression?: (typeof EXPRESSION_NAMES)[number]): Array<{ t: number; cue: Cue }> {
  const director = new Director(seed, { state, expression });
  const log: Array<{ t: number; cue: Cue }> = [];
  for (let t = 0; t <= seconds * 1000; t += 16) {
    for (const cue of director.tick(t)) log.push({ t, cue });
  }
  return log;
}

describe("Director", () => {
  it("is deterministic for the same seed", () => {
    expect(run("agent-1", "idle", 60)).toEqual(run("agent-1", "idle", 60));
  });

  it("differs between seeds", () => {
    expect(JSON.stringify(run("agent-1", "idle", 60))).not.toBe(JSON.stringify(run("agent-2", "idle", 60)));
  });

  it("opens with the state's resting expression and a resting gaze slightly off centre", () => {
    const first = run("a", "working", 0.1).map((e) => e.cue);
    const gaze = first.find((c) => c.kind === "gaze");
    const expression = first.find((c) => c.kind === "expression");
    expect(expression).toEqual({ kind: "expression", name: STATE_EXPRESSIONS.working.pool[0], mouthDelay: expect.any(Number) });
    expect(gaze && gaze.kind === "gaze" && Math.hypot(gaze.x, gaze.y)).toBeGreaterThan(GAZE_REST.min * 0.7);
    expect(gaze && gaze.kind === "gaze" && Math.hypot(gaze.x, gaze.y)).toBeLessThanOrEqual(GAZE_REST.max);
  });

  it("blinks every 2.5 to 6 seconds", () => {
    const blinks = run("b", "idle", 120).filter((e) => e.cue.kind === "blink");
    expect(blinks.length).toBeGreaterThan(15);
    for (let i = 1; i < blinks.length; i++) {
      const gap = blinks[i].t - blinks[i - 1].t;
      expect(gap).toBeGreaterThanOrEqual(BLINK_GAP.min - 16);
      expect(gap).toBeLessThanOrEqual(BLINK_GAP.max + 16);
    }
  });

  it("only picks expressions from the state's pool and never repeats back to back", () => {
    for (const state of AGENT_STATES) {
      const names = run(`s-${state}`, state, 90).filter((e) => e.cue.kind === "expression").map((e) => (e.cue as { name: string }).name);
      for (const name of names) expect(STATE_EXPRESSIONS[state].pool).toContain(name);
      for (let i = 1; i < names.length; i++) expect(names[i]).not.toBe(names[i - 1]);
      if (STATE_EXPRESSIONS[state].pool.length > 1) expect(names.length).toBeGreaterThan(3);
    }
  });

  it("holds an explicit expression and still blinks and drifts", () => {
    const log = run("c", "idle", 60, "smitten");
    const names = log.filter((e) => e.cue.kind === "expression").map((e) => (e.cue as { name: string }).name);
    expect(names).toEqual(["smitten"]);
    expect(log.some((e) => e.cue.kind === "blink")).toBe(true);
    expect(log.filter((e) => e.cue.kind === "gaze").length).toBeGreaterThan(5);
    expect(log.some((e) => e.cue.kind === "saccade")).toBe(true);
  });

  it("resumes after a pause without a burst of overdue cues", () => {
    const paused = new Director("p", { state: "idle" });
    const plain = new Director("p", { state: "idle" });
    for (let t = 0; t <= 1000; t += 16) {
      paused.tick(t);
      plain.tick(t);
    }
    paused.resume(61000);
    const afterResume = paused.tick(61000);
    const withoutResume = plain.tick(61000);
    expect(withoutResume.filter((c) => c.kind === "blink").length).toBeGreaterThan(0);
    expect(afterResume.filter((c) => c.kind === "blink" || c.kind === "gaze" || c.kind === "saccade")).toEqual([]);
    const later = [];
    for (let t = 61016; t <= 68000; t += 16) later.push(...paused.tick(t));
    expect(later.some((c) => c.kind === "blink")).toBe(true);
  });

  it("switches expression immediately when the state changes", () => {
    const director = new Director("d", { state: "idle" });
    director.tick(0);
    director.tick(16);
    director.set({ state: "sleeping" });
    const cues = director.tick(32);
    expect(cues).toContainEqual({ kind: "expression", name: "drowsy", mouthDelay: expect.any(Number) });
    for (const cue of cues) if (cue.kind === "expression") expect(cue.mouthDelay).toBeGreaterThanOrEqual(40);
    expect(director.expression).toBe("drowsy");
  });
});
