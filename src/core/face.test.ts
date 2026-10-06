import { describe, expect, it } from "vitest";
import { EXPRESSIONS, EXPRESSION_NAMES, validateFace } from "./expressions";
import { anchorForSize, FACE_ANCHORS } from "./anchors";
import { FACE_COLORS, faceGeometry, fromVector, MOUTH_TONE, REST_POSE, toVector, type FacePose } from "./face";
import { SHAPE_PATHS } from "./shapes";
import { distanceToOutline, flattenPath, pathNumbers, pointInPolygons } from "./path";
import type { ShapeName } from "./shapes";

const SHAPES = Object.keys(SHAPE_PATHS) as ShapeName[];
const EDGE_MARGIN = 1.2;
const POSES: FacePose[] = [
  REST_POSE,
  { blink: 1, gazeX: 0, gazeY: 0 },
  { blink: 0, gazeX: 1, gazeY: 1 },
  { blink: 0, gazeX: -1, gazeY: -1 },
  { blink: 0, gazeX: 1, gazeY: -1 },
  { blink: 0, gazeX: -1, gazeY: 1 },
  { blink: 0, gazeX: 1, gazeY: 0, turn: 1 },
  { blink: 0, gazeX: -1, gazeY: 0, turn: -1 },
  { blink: 0.5, gazeX: 0, gazeY: -1, turn: 0.6 },
];

function pathBox(d: string): [number, number, number, number] {
  const numbers = pathNumbers(d);
  const xs = numbers.filter((_, i) => i % 2 === 0);
  const ys = numbers.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return [minX, minY, Math.max(...xs) - minX, Math.max(...ys) - minY];
}

describe("expressions", () => {
  it("defines our twenty six named expressions", () => {
    expect(EXPRESSION_NAMES).toHaveLength(26);
    expect(new Set(EXPRESSION_NAMES).size).toBe(EXPRESSION_NAMES.length);
  });

  it.each(EXPRESSION_NAMES)("%s has valid parameters", (name) => {
    expect(validateFace(EXPRESSIONS[name])).toEqual([]);
  });

  it("rejects out of range and over-covered lids", () => {
    const broken = structuredClone(EXPRESSIONS.calm);
    broken.left.lidTop = 0.7;
    broken.left.lidBottom = 0.6;
    broken.mouth.curve = 2;
    expect(validateFace(broken).length).toBeGreaterThanOrEqual(2);
  });

  it("round trips through the spring vector", () => {
    for (const name of EXPRESSION_NAMES) expect(fromVector(toVector(EXPRESSIONS[name]))).toEqual(EXPRESSIONS[name]);
  });

  it("keeps every path the same numeric structure so platforms can interpolate between expressions", () => {
    const anchor = FACE_ANCHORS.circle;
    const base = faceGeometry(EXPRESSIONS.calm, anchor, REST_POSE);
    for (const name of EXPRESSION_NAMES) {
      const g = faceGeometry(EXPRESSIONS[name], anchor, REST_POSE);
      for (const side of ["left", "right"] as const) {
        expect(pathNumbers(g[side].sclera).length).toBe(pathNumbers(base[side].sclera).length);
        expect(pathNumbers(g[side].lidTop).length).toBe(pathNumbers(base[side].lidTop).length);
        expect(pathNumbers(g[side].lidBottom).length).toBe(pathNumbers(base[side].lidBottom).length);
        expect(pathNumbers(g[side].aperture).length).toBe(pathNumbers(base[side].aperture).length);
      }
      expect(pathNumbers(g.mouth.d).length).toBe(pathNumbers(base.mouth.d).length);
    }
  });

  it("blinks by lowering the lid and squashing slightly, and turns the face along the body", () => {
    const anchor = FACE_ANCHORS.circle;
    const open = faceGeometry(EXPRESSIONS.calm, anchor, REST_POSE);
    const shut = faceGeometry(EXPRESSIONS.calm, anchor, { blink: 1, gazeX: 0, gazeY: 0 });
    expect(shut.left.scaleY).toBeLessThan(1);
    expect(shut.left.scaleY).toBeGreaterThan(0.7);
    expect(shut.left.lidTop).not.toBe(open.left.lidTop);
    const turned = faceGeometry(EXPRESSIONS.calm, anchor, { blink: 0, gazeX: 0, gazeY: 0, turn: 1 });
    expect(turned.left.cx).toBeGreaterThan(open.left.cx);
    expect(turned.right.cx).toBeGreaterThan(open.right.cx);
    expect(pathNumbers(turned.left.sclera)[0]).toBeLessThan(pathNumbers(turned.right.sclera)[0]);
    expect(turned.mouth.d).not.toBe(open.mouth.d);
  });

  it("draws the mouth as a thin tonal line unless the expression opens it", () => {
    const anchor = FACE_ANCHORS.circle;
    const neutral = faceGeometry(EXPRESSIONS.calm, anchor, REST_POSE);
    expect(neutral.mouth.opacity).toBeCloseTo(MOUTH_TONE, 5);
    expect(neutral.mouth.opacity).toBeLessThan(0.75);
    expect(neutral.mouth.stroke).toBeLessThan(3.6);
    const closedNumbers = pathNumbers(neutral.mouth.d);
    const topMidY = (closedNumbers[3] + closedNumbers[5]) / 2;
    const bottomMidY = (closedNumbers[9] + closedNumbers[11]) / 2;
    expect(Math.abs(topMidY - bottomMidY)).toBeLessThan(0.01);
    const laughing = faceGeometry(EXPRESSIONS.giggling, anchor, REST_POSE);
    const openNumbers = pathNumbers(laughing.mouth.d);
    const openDepth = (openNumbers[9] + openNumbers[11]) / 2 - (openNumbers[3] + openNumbers[5]) / 2;
    expect(openDepth).toBeGreaterThan(3);
    expect(openDepth).toBeLessThan(10 * anchor.scale);
    expect(laughing.mouth.stroke).toBeLessThan(neutral.mouth.stroke);
    const openCount = EXPRESSION_NAMES.filter((name) => EXPRESSIONS[name].mouth.open >= 0.3).length;
    expect(openCount).toBeLessThanOrEqual(7);
  });

  it("keeps blush at a trace and only on bashful, smitten and flustered", () => {
    for (const name of EXPRESSION_NAMES) {
      const g = faceGeometry(EXPRESSIONS[name], FACE_ANCHORS.circle, REST_POSE);
      expect(g.blush.opacity).toBeLessThanOrEqual(0.1);
      if (name !== "bashful" && name !== "smitten" && name !== "flustered") expect(g.blush.opacity).toBe(0);
    }
  });

  it("scales the face up and simplifies it at small sizes while keeping it inside every body", () => {
    expect(anchorForSize("circle", 64)).toEqual(FACE_ANCHORS.circle);
    expect(anchorForSize("circle")).toEqual(FACE_ANCHORS.circle);
    const small = anchorForSize("circle", 24);
    expect(small.scale).toBeGreaterThan(FACE_ANCHORS.circle.scale * 1.1);
    expect(anchorForSize("square", 24).scale).toBeGreaterThan(FACE_ANCHORS.square.scale * 1.18);
    expect(small.detail?.glint).toBe(0);
    expect(anchorForSize("circle", 48).detail?.glint).toBe(1);
    const tiny = faceGeometry(EXPRESSIONS.calm, small, REST_POSE);
    const normal = faceGeometry(EXPRESSIONS.calm, FACE_ANCHORS.circle, REST_POSE);
    expect(tiny.left.glint.opacity).toBe(0);
    expect(tiny.mouth.stroke).toBeGreaterThan(normal.mouth.stroke * 1.3);
    for (const shape of SHAPES) {
      const anchor = anchorForSize(shape, 24);
      const outline = flattenPath(SHAPE_PATHS[shape]);
      const bad: string[] = [];
      for (const name of EXPRESSION_NAMES) {
        for (const pose of POSES) {
          for (const [x, y] of faceGeometry(EXPRESSIONS[name], anchor, pose).samples) {
            if (!pointInPolygons(outline, x, y) || distanceToOutline(outline, x, y) < EDGE_MARGIN) bad.push(`${shape} ${name} ${x.toFixed(1)},${y.toFixed(1)}`);
          }
        }
      }
      expect(bad.slice(0, 5)).toEqual([]);
    }
  }, 30000);

  it("draws pixel-aligned solid ink eyes and a full-pixel mouth from 36 px down on every shape", () => {
    expect(anchorForSize("circle", 40).detail?.ink).toBe(0);
    expect(faceGeometry(EXPRESSIONS.calm, anchorForSize("circle", 40)).left.scleraFill).toBe(FACE_COLORS.sclera);
    for (const size of [24, 28, 32, 36]) {
      for (const shape of SHAPES) {
        const anchor = anchorForSize(shape, size);
        expect(anchor.detail?.ink).toBe(1);
        const unit = 100 / size;
        for (const name of ["calm", "glad", "startled", "drowsy"] as const) {
          const g = faceGeometry(EXPRESSIONS[name], anchor);
          for (const eye of [g.left, g.right]) {
            expect(eye.scleraFill).toBe(FACE_COLORS.pupil);
            const [, , w, h] = pathBox(eye.sclera);
            expect(Math.abs(w / unit - Math.round(w / unit))).toBeLessThan(0.02);
            expect(Math.abs(h / unit - Math.round(h / unit))).toBeLessThan(0.02);
            const left = (eye.cx - w / 2) / unit;
            const top = (eye.cy - h / 2) / unit;
            expect(Math.abs(left - Math.round(left))).toBeLessThan(0.02);
            expect(Math.abs(top - Math.round(top))).toBeLessThan(0.02);
            expect(w / unit).toBeGreaterThanOrEqual(2);
            expect(h / unit).toBeGreaterThanOrEqual(3);
          }
          if (EXPRESSIONS[name].mouth.open === 0) expect(g.mouth.stroke / unit).toBeGreaterThanOrEqual(1.5 - 1e-6);
          expect(g.mouth.opacity).toBeGreaterThan(0.85);
          expect(g.blush.opacity).toBe(0);
        }
      }
    }
  });

  it("hides the pupil on arc eyes and keeps it everywhere else", () => {
    const anchor = FACE_ANCHORS.circle;
    for (const name of ["cheering", "giggling"] as const) {
      const g = faceGeometry(EXPRESSIONS[name], anchor, REST_POSE);
      expect(g.left.pupil.opacity).toBe(0);
      expect(g.left.glint.opacity).toBe(0);
    }
    const wink = faceGeometry(EXPRESSIONS.playful, anchor, REST_POSE);
    expect(wink.right.pupil.opacity).toBe(0);
    expect(wink.left.pupil.opacity).toBe(1);
    const withPupil = EXPRESSION_NAMES.filter((name) => faceGeometry(EXPRESSIONS[name], anchor, REST_POSE).left.pupil.opacity === 1);
    expect(withPupil.length).toBeGreaterThanOrEqual(17);
  });

  it("tilts the top lid so the inner corner drops on fierce eyes and rises on sad eyes", () => {
    const anchor = FACE_ANCHORS.circle;
    const innerEdge = (lid: string, side: "left" | "right") => {
      const nums = pathNumbers(lid);
      const yRight = nums[3];
      const yLeft = nums[7];
      return side === "right" ? { inner: yLeft, outer: yRight } : { inner: yRight, outer: yLeft };
    };
    const fierce = faceGeometry(EXPRESSIONS.resolute, anchor, REST_POSE);
    expect(innerEdge(fierce.right.lidTop, "right").inner).toBeGreaterThan(innerEdge(fierce.right.lidTop, "right").outer);
    expect(innerEdge(fierce.left.lidTop, "left").inner).toBeGreaterThan(innerEdge(fierce.left.lidTop, "left").outer);
    const sad = faceGeometry(EXPRESSIONS.downcast, anchor, REST_POSE);
    expect(innerEdge(sad.right.lidTop, "right").inner).toBeLessThan(innerEdge(sad.right.lidTop, "right").outer);
    expect(fierce.right.rotate).toBeLessThan(0);
    expect(fierce.left.rotate).toBeGreaterThan(0);
  });

  it("bows the lids: a flat cut for intent, an arc for cheering", () => {
    const anchor = FACE_ANCHORS.circle;
    const focused = faceGeometry(EXPRESSIONS.intent, anchor, REST_POSE);
    const focusedNums = pathNumbers(focused.right.lidTop);
    expect(Math.abs(focusedNums[5] - (focusedNums[3] + focusedNums[7]) / 2)).toBeLessThan(0.01);
    const celebrate = faceGeometry(EXPRESSIONS.cheering, anchor, REST_POSE);
    const bottom = pathNumbers(celebrate.right.lidBottom);
    expect(bottom[5]).toBeLessThan(bottom[3] - 2);
  });

  it("lowers the lid a touch when the gaze drops", () => {
    const anchor = FACE_ANCHORS.circle;
    const level = faceGeometry(EXPRESSIONS.calm, anchor, REST_POSE);
    const down = faceGeometry(EXPRESSIONS.calm, anchor, { blink: 0, gazeX: 0, gazeY: 1 });
    expect(pathNumbers(down.left.lidTop)[3]).toBeGreaterThan(pathNumbers(level.left.lidTop)[3]);
  });

  it("is visibly distinct between expressions", () => {
    const seen = new Set<string>();
    for (const name of EXPRESSION_NAMES) seen.add(JSON.stringify(faceGeometry(EXPRESSIONS[name], FACE_ANCHORS.circle, REST_POSE)));
    expect(seen.size).toBe(EXPRESSION_NAMES.length);
  });
});

describe("face fit", () => {
  const outlines = Object.fromEntries(SHAPES.map((s) => [s, flattenPath(SHAPE_PATHS[s])])) as Record<ShapeName, ReturnType<typeof flattenPath>>;

  it.each(SHAPES)("%s safe area sits on the body", (shape) => {
    const { safe } = FACE_ANCHORS[shape];
    const outline = outlines[shape];
    const points = [
      [safe.x + safe.w / 2, safe.y],
      [safe.x + safe.w / 2, safe.y + safe.h],
      [safe.x, safe.y + safe.h / 2],
      [safe.x + safe.w, safe.y + safe.h / 2],
      [safe.x + safe.w / 2, safe.y + safe.h / 2],
    ];
    const bad = points.filter(([x, y]) => !pointInPolygons(outline, x, y)).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`);
    expect(bad).toEqual([]);
  });

  for (const shape of SHAPES) {
    it.each(EXPRESSION_NAMES)(`${shape} keeps %s inside the body in every pose`, (name) => {
      const anchor = FACE_ANCHORS[shape];
      const outline = outlines[shape];
      const bad: string[] = [];
      for (const pose of POSES) {
        const g = faceGeometry(EXPRESSIONS[name], anchor, pose);
        for (const [x, y] of g.samples) {
          const inside = pointInPolygons(outline, x, y) && distanceToOutline(outline, x, y) >= EDGE_MARGIN;
          const inSafe = x >= anchor.safe.x && x <= anchor.safe.x + anchor.safe.w && y >= anchor.safe.y && y <= anchor.safe.y + anchor.safe.h;
          if (!inside || !inSafe) bad.push(`${x.toFixed(1)},${y.toFixed(1)} blink=${pose.blink} gaze=${pose.gazeX},${pose.gazeY}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
