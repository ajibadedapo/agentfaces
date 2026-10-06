import { describe, expect, it } from "vitest";
import { FACE_ANCHORS } from "./anchors";
import { EXPRESSIONS } from "./expressions";
import { faceGeometry, REST_POSE, type FacePose } from "./face";
import { bodyOutline, EXPRESSION_GLYPH, GLYPH_POINTS, GLYPH_SCHEDULE, GLYPHS, glyphAnchor, glyphDot, glyphDotStops, glyphFaceOpacity, glyphKindsFor, glyphOutline, GlyphPerformer, morphKeyframes, morphPath, morphTrack, QUESTION_HOOK, STATE_GLYPH, type GlyphKind } from "./glyph";
import { framePoints, MORPH_POINTS, polygonArea } from "./morph";
import type { Polygon } from "./path";
import { distanceToOutline, flattenPath, pathNumbers, pointInPolygons } from "./path";
import { SHAPE_PATHS } from "./shapes";
import { AGENT_STATES } from "./states";
import type { ShapeName } from "./shapes";

const KINDS = Object.keys(GLYPHS) as GlyphKind[];
const SHAPES = Object.keys(SHAPE_PATHS) as ShapeName[];
const POSES: FacePose[] = [REST_POSE, { blink: 1, gazeX: 0, gazeY: 0 }, { blink: 0, gazeX: 1, gazeY: 1 }, { blink: 0, gazeX: -1, gazeY: -1 }, { blink: 0, gazeX: 1, gazeY: 0, turn: 1 }, { blink: 0, gazeX: -1, gazeY: 0, turn: -1 }];

function segmentsCross(a: readonly number[], b: readonly number[], c: readonly number[], d: readonly number[]): boolean {
  const orient = (p: readonly number[], q: readonly number[], r: readonly number[]) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = orient(c, d, a);
  const d2 = orient(c, d, b);
  const d3 = orient(a, b, c);
  const d4 = orient(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function selfIntersections(poly: Polygon): number {
  let count = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) count++;
    }
  }
  return count;
}

function sharpestConvexTurn(poly: Polygon): number {
  const orientation = Math.sign(polygonArea(poly));
  let worst = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[(i - 1 + n) % n];
    const b = poly[i];
    const c = poly[(i + 1) % n];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.sign(cross) !== orientation) continue;
    let turn = Math.abs(Math.atan2(c[1] - b[1], c[0] - b[0]) - Math.atan2(b[1] - a[1], b[0] - a[0]));
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    worst = Math.max(worst, (turn * 180) / Math.PI);
  }
  return worst;
}

describe("glyph morphs", () => {
  it("maps alert, needs you and done to a glyph, and smitten to the heart", () => {
    expect(STATE_GLYPH.alert).toBe("bang");
    expect(STATE_GLYPH["needs-you"]).toBe("question");
    expect(STATE_GLYPH.done).toBe("check");
    expect(EXPRESSION_GLYPH.smitten).toBe("heart");
    for (const state of AGENT_STATES) expect(Boolean(GLYPH_SCHEDULE[state])).toBe(state in STATE_GLYPH);
  });

  it.each(KINDS)("%s stays inside the 100 unit frame with a margin and its dot clears the main stroke", (kind) => {
    const outline = glyphOutline(kind);
    expect(outline).toHaveLength(GLYPH_POINTS);
    for (const [x, y] of outline) {
      expect(x).toBeGreaterThanOrEqual(2);
      expect(x).toBeLessThanOrEqual(98);
      expect(y).toBeGreaterThanOrEqual(2);
      expect(y).toBeLessThanOrEqual(98);
    }
    const dot = GLYPHS[kind].dot;
    if (dot) {
      expect(dot.cy + dot.r).toBeLessThanOrEqual(96);
      expect(distanceToOutline([outline], dot.cx, dot.cy)).toBeGreaterThan(dot.r + 2);
      expect(pointInPolygons([outline], dot.cx, dot.cy)).toBe(false);
    }
  });

  it.each(KINDS)("%s has real area and a plausible footprint", (kind) => {
    const outline = glyphOutline(kind);
    let area = 0;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) area += outline[j][0] * outline[i][1] - outline[i][0] * outline[j][1];
    expect(Math.abs(area) / 2).toBeGreaterThan(kind === "heart" ? 3000 : 600);
    expect(pointInPolygons([outline], 50, kind === "check" ? 68 : kind === "heart" ? 50 : kind === "question" ? 13 : 30)).toBe(true);
  });

  it("resamples every body to the same point count so the morph interpolates point for point", () => {
    for (const shape of SHAPES) {
      const outline = bodyOutline(shape);
      expect(outline).toHaveLength(GLYPH_POINTS);
      expect(outline[0][1]).toBeLessThanOrEqual(Math.min(...outline.map(([, y]) => y)) + 0.01);
      const body = SHAPE_PATHS[shape];
      for (const [x, y] of outline) expect(distanceToOutline(flattenPath(body), x, y)).toBeLessThan(0.6);
    }
  });

  it("keeps the morph path structure constant from body to glyph", () => {
    for (const shape of SHAPES) {
      const body = flattenPath(SHAPE_PATHS[shape]);
      for (const kind of KINDS) {
        const counts = [0, 0.3, 0.7, 1].map((t) => pathNumbers(morphPath(shape, kind, t)).length);
        expect(new Set(counts).size).toBe(1);
        expect(counts[0]).toBe(2 + MORPH_POINTS * 6);
        const track = morphTrack(shape, kind);
        for (const [x, y] of track.frames[0]) expect(distanceToOutline(body, x, y)).toBeLessThan(0.6);
        for (const [x, y] of track.frames[track.frames.length - 1]) expect(distanceToOutline([GLYPHS[kind].outline], x, y)).toBeLessThan(0.6);
        const keyframes = morphKeyframes(shape, kind);
        expect(keyframes.input[0]).toBe(0);
        expect(keyframes.input[keyframes.input.length - 1]).toBe(1);
        expect(new Set(keyframes.paths.map((d) => pathNumbers(d).length)).size).toBe(1);
        for (let i = 1; i < keyframes.input.length; i++) expect(keyframes.input[i]).toBeGreaterThan(keyframes.input[i - 1]);
      }
    }
  }, 30000);

  it.each(KINDS)("every in-between frame of the %s morph is one clean silhouette from every body", (kind) => {
    for (const shape of SHAPES) {
      const track = morphTrack(shape, kind);
      expect(Math.max(...track.dropped)).toBeLessThan(0.005);
      const ownCorner = Math.max(45, sharpestConvexTurn(track.frames[track.frames.length - 1]));
      for (let k = 1; k < 48; k++) {
        const t = k / 48;
        const frame = framePoints(track, t);
        const label = `${shape} ${kind} t=${t.toFixed(3)}`;
        expect(selfIntersections(frame), label).toBe(0);
        expect(polygonArea(frame), label).toBeGreaterThan(600);
        if (t > 0.08 && t < 0.92) expect(sharpestConvexTurn(frame), label).toBeLessThanOrEqual(ownCorner);
      }
    }
  });

  it("builds the question mark from a parametric hook and a tangent-continuous tail", () => {
    const outline = glyphOutline("question");
    expect(pointInPolygons([outline], QUESTION_HOOK.cx, QUESTION_HOOK.cy)).toBe(false);
    expect(pointInPolygons([outline], QUESTION_HOOK.cx + QUESTION_HOOK.r, QUESTION_HOOK.cy)).toBe(true);
    expect(pointInPolygons([outline], QUESTION_HOOK.cx, QUESTION_HOOK.cy - QUESTION_HOOK.r)).toBe(true);
    const growth = GLYPHS.question.growth!;
    const centre = growth.centre;
    for (let i = 2; i < centre.length; i++) {
      const a = Math.atan2(centre[i - 1][1] - centre[i - 2][1], centre[i - 1][0] - centre[i - 2][0]);
      const b = Math.atan2(centre[i][1] - centre[i - 1][1], centre[i][0] - centre[i - 1][0]);
      let turn = Math.abs(b - a);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      expect(turn).toBeLessThan(0.2);
    }
  });

  it("hides the face for the marks, keeps it on the heart, and pops the dot late", () => {
    expect(glyphFaceOpacity("bang", 0)).toBe(1);
    expect(glyphFaceOpacity("bang", 0.15)).toBeCloseTo(0.5, 5);
    expect(glyphFaceOpacity("bang", 1)).toBe(0);
    expect(glyphFaceOpacity("heart", 1)).toBe(1);
    expect(glyphDot("bang", 0.4)?.r).toBe(0);
    expect(glyphDot("bang", 0.7)?.r).toBe(0);
    expect(glyphDot("bang", 0.78)!.r).toBeGreaterThan(GLYPHS.bang.dot!.r * 0.3);
    expect(glyphDot("bang", 1)?.r).toBeCloseTo(GLYPHS.bang.dot!.r, 2);
    const stops = glyphDotStops();
    expect(stops.input).toHaveLength(stops.scale.length);
    expect(Math.max(...stops.scale)).toBeGreaterThan(1);
    expect(stops.scale[stops.scale.length - 1]).toBeCloseTo(1, 5);
    expect(glyphDot("check", 1)).toBeNull();
  });

  it("fits the smitten face inside the heart once the morph lands, from every body anchor", () => {
    const outline = [glyphOutline("heart")];
    const anchors = SHAPES.map((shape) => glyphAnchor(FACE_ANCHORS[shape], "heart", 1));
    expect(glyphAnchor(FACE_ANCHORS.triangle, "heart", 0)).toEqual(FACE_ANCHORS.triangle);
    expect(glyphAnchor(FACE_ANCHORS.triangle, "bang", 1)).toEqual(FACE_ANCHORS.triangle);
    for (const anchor of anchors) {
      for (const pose of POSES) {
        const bad = faceGeometry(EXPRESSIONS.smitten, anchor, pose).samples.filter(([x, y]) => !pointInPolygons(outline, x, y) || distanceToOutline(outline, x, y) < 1.2);
        expect(bad.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)} anchor=${anchor.cx},${anchor.cy}`)).toEqual([]);
      }
    }
  });

  it("names the glyphs a character can reach so renderers can warm them before the first morph", () => {
    expect(glyphKindsFor("alert", ["uneasy"])).toEqual(["bang"]);
    expect(glyphKindsFor("idle", ["calm", "smitten"])).toEqual(["heart"]);
    expect(glyphKindsFor("idle", ["calm", "smitten"], "glad")).toEqual([]);
    expect(glyphKindsFor("done", ["pleased"], "smitten").sort()).toEqual(["check", "heart"]);
  });

  it("springs in after the rest, holds, springs out, and stays a body once a one-shot state finishes", () => {
    const performer = new GlyphPerformer("circle", "done");
    const frames: Array<ReturnType<GlyphPerformer["update"]>> = [];
    for (let t = 0; t <= 6000; t += 16) frames.push(performer.update(t, 16, "pleased"));
    const first = frames.findIndex((frame) => frame !== null);
    expect(first * 16).toBeGreaterThanOrEqual(GLYPH_SCHEDULE.done!.rest);
    const peak = Math.max(...frames.map((frame) => frame?.t ?? 0));
    expect(peak).toBeGreaterThan(0.98);
    const last = frames[frames.length - 1];
    expect(last).toBeNull();
    const resets = frames.filter((frame) => frame && frame.path === null);
    expect(resets).toHaveLength(1);
    expect(frames.filter((frame) => frame && frame.kind === "check" && frame.t > 0.5).length).toBeGreaterThan(50);
  });

  it("loops for alert and morphs to the heart on the smitten expression in any state", () => {
    const alerting = new GlyphPerformer("triangle", "alert");
    let peaks = 0;
    let wasUp = false;
    for (let t = 0; t <= 12000; t += 16) {
      const frame = alerting.update(t, 16, "uneasy");
      const up = (frame?.t ?? 0) > 0.9;
      if (up && !wasUp) peaks++;
      wasUp = up;
    }
    expect(peaks).toBeGreaterThanOrEqual(3);
    const idle = new GlyphPerformer("circle", "idle");
    expect(idle.update(0, 16, "calm")).toBeNull();
    let heart: ReturnType<GlyphPerformer["update"]> = null;
    for (let t = 16; t <= 1200; t += 16) heart = idle.update(t, 16, "smitten");
    expect(heart?.kind).toBe("heart");
    expect(heart?.t).toBeGreaterThan(0.9);
    expect(heart?.faceOpacity).toBe(1);
    let back: ReturnType<GlyphPerformer["update"]> = heart;
    for (let t = 1216; t <= 3200; t += 16) back = idle.update(t, 16, "glad") ?? back;
    expect(back?.path).toBeNull();
    expect(idle.update(3300, 16, "glad")).toBeNull();
  });
});
