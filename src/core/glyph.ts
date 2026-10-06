import type { ShapeName } from "./shapes";
import type { ExpressionName } from "./expressions";
import type { Circle, FaceAnchor } from "./face";
import { buildMorphTrack, framePoints, signedDistanceField, smoothClosedPath, smoothField, strokeField, strokeFieldSuffixes, type MorphField, type MorphFieldSource, type MorphTrack } from "./morph";
import { flattenPath, type Point, type Polygon } from "./path";
import { SHAPE_PATHS } from "./shapes";
import { stepSprings, type SpringConfig } from "./spring";
import { springFromFeel, tempo } from "./tempo";
import type { AgentState } from "./states";

export type GlyphKind = "bang" | "question" | "check" | "heart";

export interface GlyphFaceAnchor {
  cx: number;
  cy: number;
  scale: number;
}

export interface GlyphGrowth {
  centre: Point[];
  halfWidths: number[];
  trim: number;
  start: number;
}

export interface GlyphSpec {
  outline: Polygon;
  dot: Circle | null;
  face: GlyphFaceAnchor | null;
  growth?: GlyphGrowth;
}

export interface GlyphSchedule {
  rest: number;
  hold: number;
  loop: boolean;
}

export const GLYPH_POINTS = 180;
export const GLYPH_SPRING_FEEL = { frequency: 1.67, dampingRatio: 0.62 } as const;
export const GLYPH_SPRING: SpringConfig = springFromFeel(GLYPH_SPRING_FEEL, 0.002);
export const GLYPH_FACE_FADE = 0.3;
export const GLYPH_FIELD_SMOOTH = { radius: 4, passes: 3 } as const;
export const GLYPH_GROWTH_STEP = 3;
export const GLYPH_DOT_POP = { from: 0.76, to: 0.98 } as const;
export const STATE_GLYPH: Partial<Record<AgentState, GlyphKind>> = { alert: "bang", "needs-you": "question", done: "check" };
export const EXPRESSION_GLYPH: Partial<Record<ExpressionName, GlyphKind>> = { smitten: "heart" };
const glyphSchedule = (rest: number, hold: number, loop: boolean): GlyphSchedule => ({ rest: tempo(rest), hold: tempo(hold), loop });

export const GLYPH_SCHEDULE: Partial<Record<AgentState, GlyphSchedule>> = {
  "needs-you": glyphSchedule(8, 7, true),
  done: glyphSchedule(3, 7, false),
  alert: glyphSchedule(6, 6, true),
};

const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const f = (n: number) => {
  const s = n.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
};

function arcPoints(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, steps: number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return out;
}

function linePoints(from: Point, to: Point, steps: number, skipFirst = true): Point[] {
  const out: Point[] = [];
  for (let i = skipFirst ? 1 : 0; i <= steps; i++) {
    const t = i / steps;
    out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return out;
}

function roundedCorner(a: Point, corner: Point, b: Point, radius: number, steps: number): Point[] {
  const dirA = unit([a[0] - corner[0], a[1] - corner[1]]);
  const dirB = unit([b[0] - corner[0], b[1] - corner[1]]);
  const cosTheta = dirA[0] * dirB[0] + dirA[1] * dirB[1];
  const theta = Math.acos(clamp(cosTheta, -1, 1));
  const tangentLength = radius / Math.tan(theta / 2);
  const startPoint: Point = [corner[0] + dirA[0] * tangentLength, corner[1] + dirA[1] * tangentLength];
  const endPoint: Point = [corner[0] + dirB[0] * tangentLength, corner[1] + dirB[1] * tangentLength];
  const bisector = unit([dirA[0] + dirB[0], dirA[1] + dirB[1]]);
  const centreDistance = radius / Math.sin(theta / 2);
  const centre: Point = [corner[0] + bisector[0] * centreDistance, corner[1] + bisector[1] * centreDistance];
  const angleStart = Math.atan2(startPoint[1] - centre[1], startPoint[0] - centre[0]);
  let angleEnd = Math.atan2(endPoint[1] - centre[1], endPoint[0] - centre[0]);
  let sweep = angleEnd - angleStart;
  if (sweep > Math.PI) sweep -= TAU;
  if (sweep < -Math.PI) sweep += TAU;
  angleEnd = angleStart + sweep;
  const out: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const ang = angleStart + ((angleEnd - angleStart) * i) / steps;
    out.push([centre[0] + radius * Math.cos(ang), centre[1] + radius * Math.sin(ang)]);
  }
  return out;
}

function unit(v: Point): Point {
  const len = Math.hypot(v[0], v[1]) || 1;
  return [v[0] / len, v[1] / len];
}

export function strokeOutline(centre: Point[], width: (t: number) => number): Polygon {
  const n = centre.length;
  const left: Point[] = [];
  const right: Point[] = [];
  const lengths: number[] = [0];
  for (let i = 1; i < n; i++) lengths.push(lengths[i - 1] + Math.hypot(centre[i][0] - centre[i - 1][0], centre[i][1] - centre[i - 1][1]));
  const total = lengths[n - 1] || 1;
  const tangentAt = (i: number): Point => {
    const a = centre[Math.max(0, i - 1)];
    const b = centre[Math.min(n - 1, i + 1)];
    return unit([b[0] - a[0], b[1] - a[1]]);
  };
  for (let i = 0; i < n; i++) {
    const [tx, ty] = tangentAt(i);
    const half = width(lengths[i] / total) / 2;
    left.push([centre[i][0] - ty * half, centre[i][1] + tx * half]);
    right.push([centre[i][0] + ty * half, centre[i][1] - tx * half]);
  }
  const cap = (at: Point, tangent: Point, half: number, flip: boolean): Point[] => {
    const base = Math.atan2(tangent[1], tangent[0]) + (flip ? Math.PI : 0);
    const out: Point[] = [];
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const ang = base - Math.PI / 2 + (Math.PI * i) / steps;
      out.push([at[0] + Math.cos(ang) * half, at[1] + Math.sin(ang) * half]);
    }
    return out;
  };
  const startHalf = width(0) / 2;
  const endHalf = width(1) / 2;
  const endTangent = tangentAt(n - 1);
  const startTangent = tangentAt(0);
  const endCap = cap(centre[n - 1], endTangent, endHalf, false);
  const startCap = cap(centre[0], startTangent, startHalf, true);
  return [...left, ...endCap.reverse(), ...right.reverse(), ...startCap.reverse()];
}

function heartOutline(): Polygon {
  const raw: Point[] = [];
  const steps = 240;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    raw.push([x, -y]);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of raw) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const scale = Math.min(92 / (maxX - minX), 86 / (maxY - minY));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return raw.map(([x, y]) => [50 + (x - cx) * scale, 52 + (y - cy) * scale] as Point);
}

const bangWidth = (t: number) => 23 - 8 * t;
const BANG_STEM = { from: [50, 15] as Point, to: [50, 60] as Point };

function bangOutline(): Polygon {
  return strokeOutline(linePoints(BANG_STEM.from, BANG_STEM.to, 60, false), bangWidth);
}

export const GLYPH_DOT_GAP = 4;
export const GLYPH_DOT_GROWTH = 2;

export function dotBelowStroke(end: Point, endWidth: number): Circle {
  const half = endWidth / 2;
  const r = half + GLYPH_DOT_GROWTH;
  return { cx: end[0], cy: end[1] + half + GLYPH_DOT_GAP + r, r };
}

function cubicPoints(p0: Point, p1: Point, p2: Point, p3: Point, steps: number, skipFirst: boolean): Point[] {
  const out: Point[] = [];
  for (let i = skipFirst ? 1 : 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
  }
  return out;
}

export const QUESTION_HOOK = { cx: 51, cy: 31.5, r: 20.5, from: 177, to: 405, steps: 84 } as const;
export const QUESTION_TAIL = { end: [50, 62] as Point, lead: 6, settle: 7, steps: 28 } as const;

const bump = (t: number, at: number, spread: number) => Math.exp(-(((t - at) / spread) ** 2));

export const QUESTION_GROWTH = { trim: 0.42, start: 0.5 } as const;

const questionWidth = (t: number) => 12.6 + 3.4 * bump(t, 0.42, 0.2) + 1.2 * bump(t, 0, 0.07);

function questionCentre(): Point[] {
  const { cx, cy, r, from, to, steps } = QUESTION_HOOK;
  const hook = arcPoints(cx, cy, r, from, to, steps);
  const end = hook[hook.length - 1];
  const angle = (to * Math.PI) / 180;
  const lead: Point = [end[0] - Math.sin(angle) * QUESTION_TAIL.lead, end[1] + Math.cos(angle) * QUESTION_TAIL.lead];
  const settle: Point = [QUESTION_TAIL.end[0], QUESTION_TAIL.end[1] - QUESTION_TAIL.settle];
  return [...hook, ...cubicPoints(end, lead, settle, QUESTION_TAIL.end, QUESTION_TAIL.steps, true)];
}

function arcFractions(centre: readonly Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < centre.length; i++) lengths.push(lengths[i - 1] + Math.hypot(centre[i][0] - centre[i - 1][0], centre[i][1] - centre[i - 1][1]));
  const total = lengths[lengths.length - 1] || 1;
  return lengths.map((l) => l / total);
}

function questionOutline(): Polygon {
  return strokeOutline(questionCentre(), questionWidth);
}

function questionGrowth(): GlyphGrowth {
  const centre = questionCentre();
  return { centre, halfWidths: arcFractions(centre).map((t) => questionWidth(t) / 2), trim: QUESTION_GROWTH.trim, start: QUESTION_GROWTH.start };
}

function checkOutline(): Polygon {
  const a: Point = [19, 52];
  const corner: Point = [41, 74];
  const b: Point = [83, 30];
  const bend = roundedCorner(a, corner, b, 9, 16);
  const centre = [...linePoints(a, bend[0], 30, false), ...bend.slice(1), ...linePoints(bend[bend.length - 1], b, 50)];
  return strokeOutline(centre, (t) => 13.4 + 2.4 * bump(t, 0.3, 0.22) - 0.8 * t);
}

export const GLYPHS: Record<GlyphKind, GlyphSpec> = {
  bang: { outline: bangOutline(), dot: dotBelowStroke(BANG_STEM.to, bangWidth(1)), face: null },
  question: { outline: questionOutline(), dot: dotBelowStroke(QUESTION_TAIL.end, questionWidth(1)), face: null, growth: questionGrowth() },
  check: { outline: checkOutline(), dot: null, face: null },
  heart: { outline: heartOutline(), dot: null, face: { cx: 50, cy: 47, scale: 0.92 } },
};

function signedArea(poly: Polygon): number {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return area / 2;
}

export function resampleOutline(poly: Polygon, count = GLYPH_POINTS): Polygon {
  const clockwise = signedArea(poly) > 0 ? poly : [...poly].reverse();
  let top = 0;
  for (let i = 1; i < clockwise.length; i++) {
    const [x, y] = clockwise[i];
    const [tx, ty] = clockwise[top];
    if (y < ty - 1e-9 || (Math.abs(y - ty) <= 1e-9 && x < tx)) top = i;
  }
  const ordered = [...clockwise.slice(top), ...clockwise.slice(0, top)];
  const n = ordered.length;
  const lengths: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const a = ordered[i - 1];
    const b = ordered[i % n];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[n];
  const out: Polygon = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / count;
    while (seg < n - 1 && lengths[seg + 1] < target) seg++;
    const a = ordered[seg];
    const b = ordered[(seg + 1) % n];
    const span = lengths[seg + 1] - lengths[seg] || 1;
    const t = clamp((target - lengths[seg]) / span, 0, 1);
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

const bodyOutlines = new Map<ShapeName, Polygon>();

export function bodyOutline(shape: ShapeName): Polygon {
  let outline = bodyOutlines.get(shape);
  if (!outline) {
    outline = resampleOutline(flattenPath(SHAPE_PATHS[shape])[0]);
    bodyOutlines.set(shape, outline);
  }
  return outline;
}

const glyphOutlines = new Map<GlyphKind, Polygon>();

export function glyphOutline(kind: GlyphKind): Polygon {
  let outline = glyphOutlines.get(kind);
  if (!outline) {
    outline = resampleOutline(GLYPHS[kind].outline);
    glyphOutlines.set(kind, outline);
  }
  return outline;
}

export function outlinePath(points: Polygon): string {
  let d = "";
  for (let i = 0; i < points.length; i++) d += `${i === 0 ? "M" : " L"} ${f(points[i][0])} ${f(points[i][1])}`;
  return `${d} Z`;
}

const bodyFields = new Map<ShapeName, MorphField>();
const glyphFields = new Map<string, MorphField>();
const glyphSources = new Map<GlyphKind, MorphFieldSource>();
const tracks = new Map<string, MorphTrack>();

function softAndSharp(sharp: MorphField): MorphField {
  return { values: smoothField(sharp, GLYPH_FIELD_SMOOTH.radius, GLYPH_FIELD_SMOOTH.passes).values, sharp: sharp.values };
}

const smoothstep = (lo: number, hi: number, x: number) => {
  const u = clamp((x - lo) / (hi - lo), 0, 1);
  return u * u * (3 - 2 * u);
};

export function glyphGrowthIndex(growth: GlyphGrowth, e: number): number {
  const raw = growth.trim * (1 - smoothstep(growth.start, 1, e)) * (growth.centre.length - 1);
  return Math.round(raw / GLYPH_GROWTH_STEP) * GLYPH_GROWTH_STEP;
}

function glyphFieldSource(kind: GlyphKind): MorphFieldSource {
  let source = glyphSources.get(kind);
  if (!source) {
    source = createGlyphFieldSource(kind);
    glyphSources.set(kind, source);
  }
  return source;
}

function createGlyphFieldSource(kind: GlyphKind): MorphFieldSource {
  const spec = GLYPHS[kind];
  const growth = spec.growth;
  if (!growth) return softAndSharp(signedDistanceField(spec.outline));
  let raw: Map<number, MorphField> | null = null;
  return (e: number) => {
    const from = glyphGrowthIndex(growth, e);
    const key = `${kind}:${from}`;
    let field = glyphFields.get(key);
    if (!field) {
      if (!raw) {
        const starts: number[] = [];
        for (let k = 0; k <= glyphGrowthIndex(growth, 0); k += GLYPH_GROWTH_STEP) starts.push(k);
        raw = strokeFieldSuffixes(growth.centre, growth.halfWidths, starts);
      }
      field = softAndSharp(raw.get(from) ?? strokeField(growth.centre, growth.halfWidths, from));
      glyphFields.set(key, field);
    }
    return field;
  };
}

export function morphTrack(shape: ShapeName, kind: GlyphKind): MorphTrack {
  const key = `${shape}:${kind}`;
  let track = tracks.get(key);
  if (!track) {
    let bodyField = bodyFields.get(shape);
    if (!bodyField) {
      bodyField = smoothField(signedDistanceField(bodyOutline(shape)));
      bodyFields.set(shape, bodyField);
    }
    track = buildMorphTrack(bodyOutline(shape), glyphOutline(kind), bodyField, glyphFieldSource(kind));
    tracks.set(key, track);
  }
  return track;
}

export function morphPath(shape: ShapeName, kind: GlyphKind, t: number): string {
  return smoothClosedPath(framePoints(morphTrack(shape, kind), t));
}

export function morphKeyframes(shape: ShapeName, kind: GlyphKind): { input: number[]; paths: string[] } {
  const track = morphTrack(shape, kind);
  return { input: [...track.times], paths: track.frames.map((frame) => smoothClosedPath(frame)) };
}

export const GLYPH_DOT_SEED = 0.35;
const DOT_BACK = 1.6;

export function glyphDotScale(t: number): number {
  const p = (t - GLYPH_DOT_POP.from) / (GLYPH_DOT_POP.to - GLYPH_DOT_POP.from);
  if (p <= 0) return 0;
  const q = Math.min(1, p) - 1;
  const eased = 1 + (DOT_BACK + 1) * q * q * q + DOT_BACK * q * q;
  return GLYPH_DOT_SEED + (1 - GLYPH_DOT_SEED) * eased;
}

export function glyphDot(kind: GlyphKind, t: number): Circle | null {
  const dot = GLYPHS[kind].dot;
  if (!dot) return null;
  return { cx: dot.cx, cy: dot.cy, r: dot.r * glyphDotScale(t) };
}

export function glyphDotStops(): { input: number[]; scale: number[] } {
  const input = [0, GLYPH_DOT_POP.from, GLYPH_DOT_POP.from + 0.001];
  for (let k = 1; k <= 8; k++) input.push(GLYPH_DOT_POP.from + ((GLYPH_DOT_POP.to - GLYPH_DOT_POP.from) * k) / 8);
  return { input, scale: input.map((t) => glyphDotScale(t)) };
}

export function glyphFaceOpacity(kind: GlyphKind, t: number): number {
  if (GLYPHS[kind].face) return 1;
  return 1 - clamp(t / GLYPH_FACE_FADE, 0, 1);
}

export function glyphAnchor(base: FaceAnchor, kind: GlyphKind, t: number): FaceAnchor {
  const face = GLYPHS[kind].face;
  if (!face) return base;
  const k = clamp(t, 0, 1);
  return { ...base, cx: base.cx + (face.cx - base.cx) * k, cy: base.cy + (face.cy - base.cy) * k, scale: base.scale + (face.scale - base.scale) * k };
}

export interface GlyphFrame {
  kind: GlyphKind;
  t: number;
  path: string | null;
  dot: Circle | null;
  faceOpacity: number;
}

export class GlyphPerformer {
  private shape: ShapeName;
  private state: AgentState;
  private t = [0];
  private velocity = [0];
  private start = -1;
  private finished = false;
  private active: GlyphKind | null = null;
  private dirty = true;

  constructor(shape: ShapeName, state: AgentState) {
    this.shape = shape;
    this.state = state;
  }

  set(shape: ShapeName, state: AgentState): void {
    if (shape === this.shape && state === this.state) return;
    this.shape = shape;
    this.state = state;
    this.start = -1;
    this.finished = false;
    this.dirty = true;
  }

  private wanted(now: number, expression: ExpressionName): GlyphKind | null {
    const byExpression = EXPRESSION_GLYPH[expression];
    if (byExpression) return byExpression;
    const kind = STATE_GLYPH[this.state];
    const schedule = GLYPH_SCHEDULE[this.state];
    if (!kind || !schedule) return null;
    if (this.start < 0) this.start = now;
    const elapsed = now - this.start;
    const cycle = schedule.rest + schedule.hold;
    if (!schedule.loop) {
      if (elapsed >= cycle) this.finished = true;
      if (this.finished) return null;
      return elapsed >= schedule.rest ? kind : null;
    }
    return elapsed % cycle >= schedule.rest ? kind : null;
  }

  update(now: number, dt: number, expression: ExpressionName): GlyphFrame | null {
    const wanted = this.wanted(now, expression);
    if (wanted) this.active = wanted;
    const target = wanted ? 1 : 0;
    const settled = stepSprings(this.t, this.velocity, [target], dt / 1000, GLYPH_SPRING);
    const kind = this.active;
    if (!kind) return null;
    if (settled && target === 0) {
      if (!this.dirty) return null;
      this.dirty = false;
      this.active = null;
      return { kind, t: 0, path: null, dot: null, faceOpacity: 1 };
    }
    this.dirty = true;
    const t = Math.max(0, this.t[0]);
    return { kind, t, path: morphPath(this.shape, kind, t), dot: glyphDot(kind, t), faceOpacity: glyphFaceOpacity(kind, t) };
  }

  get progress(): number {
    return this.t[0];
  }
}

export function glyphKindsFor(state: AgentState, pool: readonly ExpressionName[], expression?: ExpressionName | null): GlyphKind[] {
  const kinds = new Set<GlyphKind>();
  const byState = STATE_GLYPH[state];
  if (byState) kinds.add(byState);
  for (const name of expression ? [expression] : pool) {
    const byExpression = EXPRESSION_GLYPH[name];
    if (byExpression) kinds.add(byExpression);
  }
  return [...kinds];
}

export function warmMorphs(shape: ShapeName, kinds: readonly GlyphKind[]): () => void {
  if (!kinds.length) return () => {};
  let cancelled = false;
  const pending = [...kinds];
  const step = () => {
    if (cancelled) return;
    const kind = pending.shift();
    if (!kind) return;
    morphTrack(shape, kind);
    if (pending.length) timer = setTimeout(step, 16);
  };
  let timer: ReturnType<typeof setTimeout> = setTimeout(step, 32);
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
