import { describe, expect, it } from "vitest";
import { BodyPerformer, REST_BODY, type BodyPose } from "./body";
import { STATE_MOTION } from "./states";

function run(seed: string, kind: Parameters<BodyPerformer["set"]>[0], duration: number, loop: boolean, ms: number, step = 16): BodyPose[] {
  const body = new BodyPerformer(seed, kind, duration, loop);
  const frames: BodyPose[] = [];
  for (let t = 0; t <= ms; t += step) frames.push(body.update(t, step));
  return frames;
}

describe("BodyPerformer", () => {
  it("is deterministic per seed and offsets the phase between seeds", () => {
    expect(run("a", "breathe", 3200, true, 4000)).toEqual(run("a", "breathe", 3200, true, 4000));
    expect(JSON.stringify(run("a", "breathe", 3200, true, 4000))).not.toBe(JSON.stringify(run("b", "breathe", 3200, true, 4000)));
  });

  it("breathes with a slow scale and a tiny vertical drift", () => {
    const frames = run("b", "breathe", 3200, true, 6400);
    const scales = frames.map((f) => f.scaleY);
    const ys = frames.map((f) => f.y);
    expect(Math.max(...scales)).toBeGreaterThan(1.01);
    expect(Math.min(...scales)).toBeLessThan(0.995);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(2);
  });

  it("hops with stretch in the air and compression plus overshoot on landing", () => {
    const frames = run("h", "hop", 560, true, 3000);
    const airborne = frames.filter((f) => f.y < -4);
    expect(airborne.length).toBeGreaterThan(5);
    expect(Math.max(...frames.map((f) => f.scaleY))).toBeGreaterThan(1.04);
    expect(Math.min(...frames.map((f) => f.scaleY))).toBeLessThan(0.95);
    const landed = frames.findIndex((f, i) => i > 0 && frames[i - 1].y < -0.6 && f.y >= -0.6);
    const after = frames.slice(landed, landed + 30);
    expect(Math.min(...after.map((f) => f.scaleY))).toBeLessThan(0.97);
    expect(Math.max(...after.map((f) => f.scaleY))).toBeGreaterThan(1.0);
  });

  it("crouches before a hop so the launch has anticipation", () => {
    const frames = run("c", "hop", 560, false, 560);
    const liftOff = frames.findIndex((f) => f.y < -1);
    expect(liftOff).toBeGreaterThan(2);
    expect(Math.min(...frames.slice(0, liftOff).map((f) => f.scaleY))).toBeLessThan(0.985);
  });

  it("never snaps: every parameter moves a bounded amount per frame", () => {
    for (const [state, spec] of Object.entries(STATE_MOTION)) {
      const frames = run(state, spec.kind, spec.duration, spec.loop, 4000);
      for (let i = 1; i < frames.length; i++) {
        expect(Math.abs(frames[i].y - frames[i - 1].y)).toBeLessThan(2.2);
        expect(Math.abs(frames[i].scaleY - frames[i - 1].scaleY)).toBeLessThan(0.08);
        expect(Math.abs(frames[i].rotate - frames[i - 1].rotate)).toBeLessThan(1.5);
        expect(Math.abs(frames[i].turn - frames[i - 1].turn)).toBeLessThan(0.1);
      }
    }
  });

  it("turns the head and finishes a one-shot motion at rest", () => {
    const turning = run("t", "turn", 2400, true, 4800);
    expect(Math.max(...turning.map((f) => f.turn))).toBeGreaterThan(0.6);
    expect(Math.min(...turning.map((f) => f.turn))).toBeLessThan(-0.6);
    const once = run("o", "hop", 420, false, 3000);
    const last = once[once.length - 1];
    expect(Math.abs(last.y)).toBeLessThan(0.05);
    expect(Math.abs(last.scaleY - 1)).toBeLessThan(0.01);
  });

  it("changes motion kind without resetting the current pose", () => {
    const body = new BodyPerformer("s", "hop", 560, true);
    let pose = REST_BODY;
    for (let t = 0; t <= 300; t += 16) pose = body.update(t, 16);
    const before = pose;
    body.set("breathe", 3200, true);
    const next = body.update(316, 16);
    expect(Math.abs(next.y - before.y)).toBeLessThan(2.2);
  });
});
