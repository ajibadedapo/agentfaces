import { describe, expect, it } from "vitest";
import { FACE_ANCHORS } from "./anchors";
import { BodyPerformer, LEAN_TILT } from "./body";
import { Director, GAZE_REST } from "./director";
import { EXPRESSIONS, validateFace } from "./expressions";
import { faceGeometry, REST_POSE } from "./face";
import { distanceToOutline, flattenPath, pointInPolygons } from "./path";
import { Performer } from "./performer";
import { SHAPE_PATHS, type ShapeName } from "./shapes";
import { STATE_EXPRESSIONS, STATE_FOCUS, STATE_LABEL, STATE_MOTION, VOICE_STATES } from "./states";
import { applyVoice, bandTilt, createSyntheticVoice, isVoiceState, mouthForLevel, MouthModel, VOICE_MOUTH } from "./voice";

const SHAPES = Object.keys(SHAPE_PATHS) as ShapeName[];
const WEIRD = [Number.NaN, -1, -0.01, 0, 0.01, 0.03, 0.2, 0.5, 0.8, 1, 1.5, Infinity, -Infinity];

describe("voice states", () => {
  it("adds listening and speaking with labels, motion and resting expressions", () => {
    expect(VOICE_STATES).toEqual(["listening", "speaking"]);
    expect(STATE_LABEL.listening).toBe("Listening");
    expect(STATE_LABEL.speaking).toBe("Speaking");
    expect(STATE_MOTION.listening.kind).toBe("lean");
    expect(STATE_MOTION.speaking.kind).toBe("talk");
    expect(STATE_EXPRESSIONS.listening.pool[0]).toBe("heedful");
    expect(STATE_EXPRESSIONS.speaking.pool[0]).toBe("chatty");
    expect(isVoiceState("listening")).toBe(true);
    expect(isVoiceState("working")).toBe(false);
  });

  it("keeps the listening gaze near the viewer", () => {
    const director = new Director("focus", { state: "listening" });
    for (let t = 0; t < 60000; t += 50) {
      for (const cue of director.tick(t)) if (cue.kind === "gaze") expect(Math.hypot(cue.x, cue.y)).toBeLessThanOrEqual(GAZE_REST.max * STATE_FOCUS.listening! + 1e-9);
    }
  });
});

describe("mouthForLevel", () => {
  it("stays in bounds for any level and bands", () => {
    for (const level of WEIRD) {
      for (const a of WEIRD) {
        for (const b of [0, 0.5, 1, Number.NaN]) {
          const shape = mouthForLevel(level, { low: a, mid: b, high: 1 - (Number.isFinite(a) ? a : 0) });
          expect(shape.open).toBeGreaterThanOrEqual(0);
          expect(shape.open).toBeLessThanOrEqual(VOICE_MOUTH.maxOpen);
          expect(shape.width).toBeGreaterThanOrEqual(VOICE_MOUTH.minWidth);
          expect(shape.width).toBeLessThanOrEqual(VOICE_MOUTH.maxWidth);
        }
      }
    }
  });

  it("closes below the gate and opens further as the level rises", () => {
    expect(mouthForLevel(0).open).toBe(0);
    expect(mouthForLevel(VOICE_MOUTH.gate * 0.9).open).toBe(0);
    let previous = -1;
    for (let l = 0; l <= 1; l += 0.05) {
      const open = mouthForLevel(l).open;
      expect(open).toBeGreaterThanOrEqual(previous);
      previous = open;
    }
    expect(mouthForLevel(1).open).toBeCloseTo(VOICE_MOUTH.maxOpen);
  });

  it("spreads for bright sounds and rounds for dark ones", () => {
    expect(bandTilt(null)).toBe(0);
    expect(bandTilt({ low: 0, mid: 0, high: 0 })).toBe(0);
    const bright = mouthForLevel(0.6, { low: 0.05, mid: 0.3, high: 0.8 });
    const dark = mouthForLevel(0.6, { low: 0.8, mid: 0.3, high: 0.05 });
    const flat = mouthForLevel(0.6);
    expect(bright.width).toBeGreaterThan(flat.width);
    expect(dark.width).toBeLessThan(flat.width);
    expect(bright.open).toBe(dark.open);
  });
});

describe("MouthModel", () => {
  it("opens quickly, closes a little slower and stays in bounds", () => {
    const model = new MouthModel();
    const opened = model.update(1, null, 16).open;
    model.reset();
    for (let i = 0; i < 40; i++) model.update(1, null, 16);
    expect(model.current.open).toBeCloseTo(VOICE_MOUTH.maxOpen, 2);
    const closing = VOICE_MOUTH.maxOpen - model.update(0, null, 16).open;
    expect(opened).toBeGreaterThan(closing);
    for (const level of WEIRD) {
      const shape = model.update(level, { low: level, mid: level, high: level }, 16);
      expect(shape.open).toBeGreaterThanOrEqual(0);
      expect(shape.open).toBeLessThanOrEqual(VOICE_MOUTH.maxOpen);
      expect(shape.width).toBeGreaterThanOrEqual(VOICE_MOUTH.minWidth);
      expect(shape.width).toBeLessThanOrEqual(VOICE_MOUTH.maxWidth);
    }
  });
});

describe("applyVoice", () => {
  const outlines = Object.fromEntries(SHAPES.map((s) => [s, flattenPath(SHAPE_PATHS[s])])) as Record<ShapeName, ReturnType<typeof flattenPath>>;
  const extremes = [
    { open: 0, width: VOICE_MOUTH.minWidth },
    { open: VOICE_MOUTH.maxOpen, width: VOICE_MOUTH.maxWidth },
    { open: VOICE_MOUTH.maxOpen, width: VOICE_MOUTH.minWidth },
    { open: 0.4, width: 1 },
  ];

  it("leaves other states alone", () => {
    expect(applyVoice(EXPRESSIONS.calm, "working", 1, { open: 1, width: 1 })).toBe(EXPRESSIONS.calm);
    expect(applyVoice(EXPRESSIONS.calm, "speaking", 1, null)).toBe(EXPRESSIONS.calm);
  });

  it("lifts the lids and widens the pupils a touch while listening", () => {
    const quiet = applyVoice(EXPRESSIONS.heedful, "listening", 0, null);
    const loud = applyVoice(EXPRESSIONS.heedful, "listening", 1, null);
    expect(loud.left.lidTop).toBeLessThanOrEqual(quiet.left.lidTop);
    expect(loud.left.pupil).toBeGreaterThan(quiet.left.pupil);
    expect(loud.mouth).toEqual(quiet.mouth);
  });

  for (const shape of SHAPES) {
    it(`keeps a speaking face valid and inside the ${shape} body at every mouth extreme`, () => {
      const anchor = FACE_ANCHORS[shape];
      const bad: string[] = [];
      for (const name of [...STATE_EXPRESSIONS.speaking.pool, ...STATE_EXPRESSIONS.listening.pool]) {
        for (const mouth of extremes) {
          for (const level of [0, 1]) {
            const face = applyVoice(EXPRESSIONS[name], "speaking", level, mouth);
            expect(validateFace(face)).toEqual([]);
            for (const [x, y] of faceGeometry(face, anchor, REST_POSE).samples) {
              const inside = pointInPolygons(outlines[shape], x, y) && distanceToOutline(outlines[shape], x, y) >= 1.2;
              const inSafe = x >= anchor.safe.x && x <= anchor.safe.x + anchor.safe.w && y >= anchor.safe.y && y <= anchor.safe.y + anchor.safe.h;
              if (!inside || !inSafe) bad.push(`${name} open=${mouth.open} ${x.toFixed(1)},${y.toFixed(1)}`);
            }
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
});

describe("Performer with voice", () => {
  it("repaints when the voice changes and settles when it holds", () => {
    const performer = new Performer("v", FACE_ANCHORS.circle, { state: "speaking" });
    let t = 0;
    for (; t < 20000; t += 16) performer.update(t, 16);
    performer.setVoice({ state: "speaking", level: 0, mouth: { open: 0, width: 1 } });
    const closed = performer.update((t += 16), 16);
    expect(closed).not.toBeNull();
    performer.setVoice({ state: "speaking", level: 0.8, mouth: { open: 0.7, width: 1.1 } });
    const open = performer.update((t += 16), 16);
    expect(open?.mouth.d).not.toBe(closed?.mouth.d);
  });
});

describe("BodyPerformer voice motion", () => {
  it("leans in while listening and pulses with the input level", () => {
    const quiet = new BodyPerformer("b", "lean", STATE_MOTION.listening.duration, true);
    const loud = new BodyPerformer("b", "lean", STATE_MOTION.listening.duration, true);
    let a = quiet.update(0, 16);
    let b = loud.update(0, 16, 1);
    for (let t = 16; t < 1500; t += 16) {
      a = quiet.update(t, 16, 0);
      b = loud.update(t, 16, 1);
    }
    expect(a.scaleX).toBeGreaterThan(1);
    expect(b.scaleX).toBeGreaterThan(a.scaleX);
    expect(a.rotate).toBeCloseTo(LEAN_TILT.circle);
  });

  it("tilts only the circle while listening and keeps straight-edged shapes upright", () => {
    expect(LEAN_TILT).toEqual({ circle: -1.25, triangle: 0, square: 0 });
    for (const shape of SHAPES) {
      const body = new BodyPerformer("t", "lean", STATE_MOTION.listening.duration, true);
      body.setShape(shape);
      let pose = body.update(0, 16, 0.5);
      for (let t = 16; t < 2000; t += 16) pose = body.update(t, 16, 0.5);
      expect(pose.rotate).toBeCloseTo(LEAN_TILT[shape], 3);
      expect(pose.scaleX).toBeGreaterThan(1);
      expect(pose.y).toBeGreaterThan(1);
    }
  });

  it("nods up with the output level while speaking", () => {
    const body = new BodyPerformer("b", "talk", STATE_MOTION.speaking.duration, true);
    let pose = body.update(0, 16, 1);
    for (let t = 16; t < 800; t += 16) pose = body.update(t, 16, 1);
    expect(pose.y).toBeLessThan(-1);
  });
});

describe("createSyntheticVoice", () => {
  it("is deterministic per seed, in range, with syllables and pauses", () => {
    const a = createSyntheticVoice("seed");
    const b = createSyntheticVoice("seed");
    const c = createSyntheticVoice("other");
    let silent = 0;
    let voiced = 0;
    let differs = false;
    for (let t = 1000; t < 21000; t += 16) {
      const fa = a(t) as { level: number; bands: { low: number; mid: number; high: number } };
      const fb = b(t) as { level: number };
      const fc = c(t) as { level: number };
      expect(fa.level).toBe(fb.level);
      if (fa.level !== fc.level) differs = true;
      expect(fa.level).toBeGreaterThanOrEqual(0);
      expect(fa.level).toBeLessThanOrEqual(1);
      for (const band of Object.values(fa.bands)) expect(band).toBeGreaterThanOrEqual(0);
      if (fa.level < 0.02) silent++;
      if (fa.level > 0.3) voiced++;
    }
    expect(differs).toBe(true);
    expect(silent).toBeGreaterThan(50);
    expect(voiced).toBeGreaterThan(200);
  });
});
