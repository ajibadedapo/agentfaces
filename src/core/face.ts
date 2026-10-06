import type { Point } from "./path";

export interface EyeParams {
  w: number;
  h: number;
  round: number;
  slant: number;
  lidTop: number;
  lidBottom: number;
  bowTop: number;
  bowBottom: number;
  lidSlant: number;
  pupil: number;
  ink: number;
  glint: number;
  dx: number;
  dy: number;
}

export interface MouthParams {
  width: number;
  curve: number;
  open: number;
  lift: number;
  dy: number;
  show: number;
}

export interface FaceParams {
  left: EyeParams;
  right: EyeParams;
  mouth: MouthParams;
  blush: number;
  gazeX: number;
  gazeY: number;
}

export interface FacePose {
  blink: number;
  gazeX: number;
  gazeY: number;
  turn?: number;
}

export interface SafeArea {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceDetail {
  glint: number;
  mouthWeight: number;
  eyeSpread: number;
  turn: number;
  ink?: number;
  pixel?: number;
}

export interface FaceAnchor {
  cx: number;
  cy: number;
  scale: number;
  safe: SafeArea;
  detail?: FaceDetail;
}

export interface Circle {
  cx: number;
  cy: number;
  r: number;
}

export interface EyeGeometry {
  cx: number;
  cy: number;
  rotate: number;
  scaleY: number;
  sclera: string;
  scleraFill: string;
  aperture: string;
  lidTop: string;
  lidBottom: string;
  pupil: Circle & { opacity: number };
  pupilTravel: { x: number; y: number };
  glint: Circle & { opacity: number };
}

export interface MouthGeometry {
  d: string;
  stroke: number;
  opacity: number;
}

export interface BlushGeometry {
  left: { cx: number; cy: number; rx: number; ry: number };
  right: { cx: number; cy: number; rx: number; ry: number };
  opacity: number;
}

export interface FaceGeometry {
  left: EyeGeometry;
  right: EyeGeometry;
  mouth: MouthGeometry;
  blush: BlushGeometry;
  samples: Point[];
}

export const REST_POSE: FacePose = { blink: 0, gazeX: 0, gazeY: 0, turn: 0 };

export const FACE_COLORS = {
  sclera: "#FFFDF7",
  pupil: "#1C1B22",
  glint: "#FFFFFF",
  mouth: "#15131B",
  blush: "#FFFFFF",
} as const;

export const EYE_OFFSET_X = 12.5;
export const EYE_OFFSET_Y = -6;
export const MOUTH_OFFSET_Y = 16.5;
export const MOUTH_TONE = 0.62;
const MOUTH_OPEN_DEPTH = 7;
const MOUTH_STROKE = 2.7;
const MOUTH_OPEN_STROKE = 2.2;
export const BLINK_FLOOR = 0.08;
export const BLINK_SQUASH = 0.22;
export const TURN_SHIFT = 4;
export const TURN_EYE_SCALE = 0.08;
export const GLINT = { x: 0.36, y: -0.38, r: 0.32, minRadius: 0.5 } as const;
export const PUPIL_TRAVEL = { x: 0.95, y: 0.8, pad: 0.3 } as const;
export const LID_FOLLOW = 0.06;
export const SMALL_FACE = { from: 64, to: 24, glintBelow: 40, mouthWeight: 1.35, eyeSpread: 0.84, turn: 0.5 } as const;
export const FULL_DETAIL: FaceDetail = { glint: 1, mouthWeight: 1, eyeSpread: 1, turn: 1, ink: 0, pixel: 0 };
export const INK_FACE = { from: 37, to: 36, eyeW: 0.62, eyeH: 0.7, minEyePx: { w: 2, h: 3 }, mouthPx: 1.5, mouthTone: 0.92, mouthWidth: 1.18 } as const;
const LID_BOW = 0.34;
const LID_BOW_RAMP = 0.3;
const LID_TILT = 0.28;
const LID_PAD = 0.6;
const BLUSH_X = 19;
const BLUSH_Y = 7;
const BLUSH_RX = 5.5;
const BLUSH_RY = 2.6;
const BLUSH_OPACITY = 0.1;

const EYE_KEYS = ["w", "h", "round", "slant", "lidTop", "lidBottom", "bowTop", "bowBottom", "lidSlant", "pupil", "ink", "glint", "dx", "dy"] as const satisfies readonly (keyof EyeParams)[];
const MOUTH_KEYS = ["width", "curve", "open", "lift", "dy", "show"] as const satisfies readonly (keyof MouthParams)[];

export const FACE_VECTOR_LENGTH = EYE_KEYS.length * 2 + MOUTH_KEYS.length + 3;
export const MOUTH_VECTOR_RANGE = { start: EYE_KEYS.length * 2, end: EYE_KEYS.length * 2 + MOUTH_KEYS.length } as const;

export function toVector(face: FaceParams): number[] {
  const out: number[] = [];
  for (const k of EYE_KEYS) out.push(face.left[k]);
  for (const k of EYE_KEYS) out.push(face.right[k]);
  for (const k of MOUTH_KEYS) out.push(face.mouth[k]);
  out.push(face.blush, face.gazeX, face.gazeY);
  return out;
}

export function fromVector(v: ArrayLike<number>): FaceParams {
  let i = 0;
  const eye = (): EyeParams => {
    const e = {} as EyeParams;
    for (const k of EYE_KEYS) e[k] = v[i++];
    return e;
  };
  const left = eye();
  const right = eye();
  const mouth = {} as MouthParams;
  for (const k of MOUTH_KEYS) mouth[k] = v[i++];
  return { left, right, mouth, blush: v[i++], gazeX: v[i++], gazeY: v[i++] };
}

const f = (n: number) => {
  const s = n.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function unitDisc(x: number, y: number): Point {
  const length = Math.hypot(x, y);
  return length > 1 ? [x / length, y / length] : [x, y];
}

function rotatePoint(x: number, y: number, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

const ELLIPSE_HANDLE = 0.5523;

function scleraPath(W: number, H: number, round: number): string {
  const hw = W / 2;
  const hh = H / 2;
  const k = ELLIPSE_HANDLE + (1 - clamp(round, 0, 1)) * 0.3;
  const kx = f(hw * k);
  const ky = f(hh * k);
  return `M ${f(-hw)} 0 C ${f(-hw)} ${f(-hh * k)} ${f(-hw * k)} ${f(-hh)} 0 ${f(-hh)} C ${kx} ${f(-hh)} ${f(hw)} ${f(-hh * k)} ${f(hw)} 0 C ${f(hw)} ${ky} ${kx} ${f(hh)} 0 ${f(hh)} C ${f(-hw * k)} ${f(hh)} ${f(-hw)} ${ky} ${f(-hw)} 0 Z`;
}

interface LidEdge {
  yLeft: number;
  yRight: number;
  control: number;
}

function bowAmount(H: number, cover: number, bow: number): number {
  return LID_BOW * H * clamp(bow, -1, 1) * Math.min(1, cover / LID_BOW_RAMP);
}

function topEdge(H: number, cover: number, bow: number, tilt: number): LidEdge {
  const edge = -H / 2 + cover * H;
  return { yLeft: edge + tilt, yRight: edge - tilt, control: edge + bowAmount(H, cover, bow) };
}

function bottomEdge(H: number, cover: number, bow: number): LidEdge {
  const edge = H / 2 - cover * H;
  return { yLeft: edge, yRight: edge, control: edge - bowAmount(H, cover, bow) };
}

function topLid(W: number, H: number, edge: LidEdge): string {
  const hw = W / 2 + LID_PAD;
  const top = -H / 2 - LID_PAD;
  return `M ${f(-hw)} ${f(top)} H ${f(hw)} V ${f(edge.yRight)} Q 0 ${f(edge.control)} ${f(-hw)} ${f(edge.yLeft)} Z`;
}

function bottomLid(W: number, H: number, edge: LidEdge): string {
  const hw = W / 2 + LID_PAD;
  const bottom = H / 2 + LID_PAD;
  return `M ${f(-hw)} ${f(bottom)} H ${f(hw)} V ${f(edge.yRight)} Q 0 ${f(edge.control)} ${f(-hw)} ${f(edge.yLeft)} Z`;
}

function aperture(W: number, top: LidEdge, bottom: LidEdge): string {
  const hw = W / 2 + LID_PAD;
  return `M ${f(-hw)} ${f(top.yLeft)} Q 0 ${f(top.control)} ${f(hw)} ${f(top.yRight)} L ${f(hw)} ${f(bottom.yRight)} Q 0 ${f(bottom.control)} ${f(-hw)} ${f(bottom.yLeft)} Z`;
}

function mixHex(from: string, to: string, share: number): string {
  if (share <= 0) return from;
  if (share >= 1) return to;
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * share);
  return `#${((1 << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).slice(1).toUpperCase()}`;
}

function snapSpan(centre: number, span: number, unit: number, minPx: number): [number, number] {
  if (unit <= 0) return [centre, span];
  const px = Math.max(minPx, Math.round(span / unit));
  const snapped = px * unit;
  const start = Math.round((centre - snapped / 2) / unit) * unit;
  return [start + snapped / 2, snapped];
}

function eyeGeometry(eye: EyeParams, side: -1 | 1, face: FaceParams, anchor: FaceAnchor, pose: FacePose, samples: Point[]): EyeGeometry {
  const s = anchor.scale;
  const turn = clamp(pose.turn ?? 0, -1, 1);
  const blink = clamp(pose.blink, 0, 1);
  const detail = anchor.detail ?? FULL_DETAIL;
  const inkShare = clamp(detail.ink ?? 0, 0, 1);
  const unit = detail.pixel ?? 0;
  const rawW = eye.w * s * (1 - side * turn * TURN_EYE_SCALE) * (1 - inkShare * (1 - INK_FACE.eyeW));
  const rawH = eye.h * s * (1 - inkShare * (1 - INK_FACE.eyeH));
  const rawCx = anchor.cx + (side * (EYE_OFFSET_X * detail.eyeSpread + eye.dx) + turn * TURN_SHIFT * detail.turn) * s;
  const rawCy = anchor.cy + (EYE_OFFSET_Y + eye.dy) * s;
  const [cx, W] = snapSpan(rawCx, rawW, unit, INK_FACE.minEyePx.w);
  const [cy, H] = snapSpan(rawCy, rawH, unit, INK_FACE.minEyePx.h);
  const rotate = -side * eye.slant;
  const scaleY = 1 - blink * BLINK_SQUASH;
  const [gx, gy] = unitDisc(face.gazeX + pose.gazeX, face.gazeY + pose.gazeY);
  const lidCover = clamp(eye.lidTop, 0, 1);
  const lidWithGaze = lidCover + Math.max(0, gy) * LID_FOLLOW * (1 - lidCover);
  const lidWithBlink = lidWithGaze + blink * (1 - lidWithGaze);
  const coverBottom = clamp(eye.lidBottom, 0, 1);
  const tilt = side * clamp(eye.lidSlant, -1, 1) * H * LID_TILT * (1 - blink);
  const top = topEdge(H, lidWithBlink, eye.bowTop, tilt);
  const bottom = bottomEdge(H, coverBottom, eye.bowBottom);
  const r = (clamp(eye.pupil, 0, 1) * Math.min(W, H)) / 2;
  const travelX = Math.max(0, W / 2 - r - PUPIL_TRAVEL.pad * s) * PUPIL_TRAVEL.x;
  const travelY = Math.max(0, H / 2 - r - PUPIL_TRAVEL.pad * s) * PUPIL_TRAVEL.y;
  const ink = clamp(eye.ink, 0, 1);
  const pupil = { cx: gx * travelX, cy: gy * travelY, r, opacity: ink };
  const glint = { cx: pupil.cx + r * GLINT.x, cy: pupil.cy + r * GLINT.y, r: Math.max(GLINT.minRadius * s, r * GLINT.r), opacity: clamp(eye.glint, 0, 1) * ink * detail.glint };
  const hw = W / 2 + LID_PAD;
  const hh = H / 2 + LID_PAD;
  for (const [lx, ly] of [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
    [0, -hh],
    [0, hh],
    [-hw, 0],
    [hw, 0],
  ] as Point[]) {
    const [rx, ry] = rotatePoint(lx, ly * scaleY, rotate);
    samples.push([cx + rx, cy + ry]);
  }
  return { cx, cy, rotate, scaleY, sclera: scleraPath(W, H, eye.round), scleraFill: mixHex(FACE_COLORS.sclera, FACE_COLORS.pupil, inkShare), aperture: aperture(W, top, bottom), lidTop: topLid(W, H, top), lidBottom: bottomLid(W, H, bottom), pupil, pupilTravel: { x: travelX, y: travelY }, glint };
}

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function mouthGeometry(mouth: MouthParams, anchor: FaceAnchor, pose: FacePose, samples: Point[]): MouthGeometry {
  const s = anchor.scale;
  const cx = anchor.cx + clamp(pose.turn ?? 0, -1, 1) * TURN_SHIFT * (anchor.detail ?? FULL_DETAIL).turn * s;
  const cy = anchor.cy + (MOUTH_OFFSET_Y + mouth.dy) * s;
  const detail = anchor.detail ?? FULL_DETAIL;
  const inkShare = clamp(detail.ink ?? 0, 0, 1);
  const unit = detail.pixel ?? 0;
  const hw = (mouth.width * s * (1 + inkShare * (1 - clamp(mouth.open, 0, 1)) * (INK_FACE.mouthWidth - 1))) / 2;
  const depth = mouth.curve * hw * 0.5;
  const skew = mouth.lift * hw * 0.35;
  const yL = -depth + skew;
  const yR = -depth - skew;
  const openness = clamp(mouth.open, 0, 1);
  const open = openness * MOUTH_OPEN_DEPTH * s;
  const topMid = -open * 0.3;
  const bottomMid = open;
  const controlFor = (mid: number) => (8 * mid - (yL + yR)) / 6;
  const ct = controlFor(topMid);
  const cb = controlFor(bottomMid);
  const kx = hw * 0.45;
  const weight = detail.mouthWeight;
  const baseStroke = Math.max(1.4, (MOUTH_STROKE - (MOUTH_STROKE - MOUTH_OPEN_STROKE) * openness) * s * weight);
  const stroke = unit > 0 ? baseStroke + (Math.max(baseStroke, INK_FACE.mouthPx * unit) - baseStroke) * inkShare * Math.max(0, 1 - openness * 4) : baseStroke;
  const d = `M ${f(cx - hw)} ${f(cy + yL)} C ${f(cx - kx)} ${f(cy + ct)} ${f(cx + kx)} ${f(cy + ct)} ${f(cx + hw)} ${f(cy + yR)} C ${f(cx + kx)} ${f(cy + cb)} ${f(cx - kx)} ${f(cy + cb)} ${f(cx - hw)} ${f(cy + yL)} Z`;
  const pad = stroke / 2 + 0.2;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const x = cubicAt(cx - hw, cx - kx, cx + kx, cx + hw, t);
    const yTop = cy + cubicAt(yL, ct, ct, yR, t);
    const yBottom = cy + cubicAt(yR, cb, cb, yL, t);
    samples.push([x - pad, yTop - pad], [x + pad, yTop - pad], [x - pad, yBottom + pad], [x + pad, yBottom + pad]);
  }
  return { d, stroke, opacity: clamp(mouth.show, 0, 1) * (MOUTH_TONE + (INK_FACE.mouthTone - MOUTH_TONE) * inkShare) };
}

export function faceGeometry(face: FaceParams, anchor: FaceAnchor, pose: FacePose = REST_POSE): FaceGeometry {
  const samples: Point[] = [];
  const left = eyeGeometry(face.left, -1, face, anchor, pose, samples);
  const right = eyeGeometry(face.right, 1, face, anchor, pose, samples);
  const mouth = mouthGeometry(face.mouth, anchor, pose, samples);
  const s = anchor.scale;
  const shift = clamp(pose.turn ?? 0, -1, 1) * TURN_SHIFT * (anchor.detail ?? FULL_DETAIL).turn * s;
  const blushY = anchor.cy + BLUSH_Y * s;
  const blush: BlushGeometry = {
    left: { cx: anchor.cx - BLUSH_X * s + shift, cy: blushY, rx: BLUSH_RX * s, ry: BLUSH_RY * s },
    right: { cx: anchor.cx + BLUSH_X * s + shift, cy: blushY, rx: BLUSH_RX * s, ry: BLUSH_RY * s },
    opacity: clamp(face.blush, 0, 1) * BLUSH_OPACITY * (1 - clamp((anchor.detail ?? FULL_DETAIL).ink ?? 0, 0, 1)),
  };
  if (face.blush > 0) {
    for (const b of [blush.left, blush.right]) samples.push([b.cx - b.rx, b.cy], [b.cx + b.rx, b.cy], [b.cx, b.cy - b.ry], [b.cx, b.cy + b.ry]);
  }
  return { left, right, mouth, blush, samples };
}
