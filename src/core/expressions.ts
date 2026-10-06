import type { EyeParams, FaceParams, MouthParams } from "./face";

export const EXPRESSION_NAMES = [
  "calm",
  "glad",
  "pleased",
  "sly",
  "playful",
  "eager",
  "giggling",
  "cheering",
  "overjoyed",
  "smitten",
  "bashful",
  "flustered",
  "wistful",
  "serene",
  "intrigued",
  "pondering",
  "intent",
  "resolute",
  "doubtful",
  "puzzled",
  "watchful",
  "startled",
  "uneasy",
  "downcast",
  "weary",
  "drowsy",
  "heedful",
  "chatty",
] as const;

export type ExpressionName = (typeof EXPRESSION_NAMES)[number];

const EYE: EyeParams = { w: 18, h: 22, round: 1, slant: 0, lidTop: 0, lidBottom: 0, bowTop: 0.6, bowBottom: 1, lidSlant: 0, pupil: 0.58, ink: 1, glint: 1, dx: 0, dy: 0 };
const MOUTH: MouthParams = { width: 14, curve: 0.3, open: 0, lift: 0, dy: 0, show: 1 };

function eyes(both: Partial<EyeParams> = {}, left: Partial<EyeParams> = {}, right: Partial<EyeParams> = {}): Pick<FaceParams, "left" | "right"> {
  return { left: { ...EYE, ...both, ...left }, right: { ...EYE, ...both, ...right } };
}

function face(parts: Partial<Pick<FaceParams, "left" | "right">> & { mouth?: Partial<MouthParams>; blush?: number; gazeX?: number; gazeY?: number }): FaceParams {
  return {
    left: parts.left ?? EYE,
    right: parts.right ?? EYE,
    mouth: { ...MOUTH, ...parts.mouth },
    blush: parts.blush ?? 0,
    gazeX: parts.gazeX ?? 0,
    gazeY: parts.gazeY ?? 0,
  };
}

const ARC = { w: 19, lidBottom: 0.56, lidTop: 0.02, bowBottom: 1, bowTop: 0.2, ink: 0 } as const satisfies Partial<EyeParams>;

export const EXPRESSIONS: Record<ExpressionName, FaceParams> = {
  calm: face({ ...eyes(), mouth: { width: 14, curve: 0.25 } }),
  glad: face({ ...eyes({ lidBottom: 0.28, bowBottom: 1 }), mouth: { width: 22, curve: 0.85 } }),
  pleased: face({ ...eyes({ lidTop: 0.26, bowTop: 0.5, lidBottom: 0.1, dy: -1 }), mouth: { width: 17, curve: 0.6, dy: -0.5 } }),
  sly: face({ ...eyes({ lidTop: 0.4, bowTop: 0.4, lidBottom: 0.12, slant: 2, pupil: 0.56 }), mouth: { width: 15, curve: 0.5, lift: 0.65 }, gazeX: -0.3 }),
  playful: face({ ...eyes({}, {}, { h: 20, lidTop: 0.78, bowTop: -1, ink: 0 }), mouth: { width: 18, curve: 0.7, lift: 0.5 } }),
  eager: face({ ...eyes({ w: 18.5, h: 24, pupil: 0.62 }), mouth: { width: 20, curve: 0.75, open: 0.38 } }),
  giggling: face({ ...eyes({ ...ARC }), mouth: { width: 21, curve: 0.9, open: 0.6 } }),
  cheering: face({ ...eyes({ ...ARC, dy: -1 }), mouth: { width: 22, curve: 0.9, open: 0.5 } }),
  overjoyed: face({ ...eyes({ ...ARC, w: 20, dy: -1.5 }), mouth: { width: 24, curve: 0.9, open: 0.7 } }),
  smitten: face({ ...eyes({ lidBottom: 0.42, lidTop: 0.08, bowBottom: 1, pupil: 0.74 }), mouth: { width: 19, curve: 0.8, open: 0.25 }, blush: 0.5 }),
  bashful: face({ ...eyes({ lidTop: 0.25, bowTop: 0.8, dy: 1 }), mouth: { width: 9, curve: 0.5 }, blush: 0.9, gazeX: -0.55, gazeY: 0.6 }),
  flustered: face({ ...eyes({ lidTop: 0.3, bowTop: 0.9, pupil: 0.5, dy: 1 }), mouth: { width: 12, curve: -0.15, open: 0.08, dy: 1 }, blush: 1, gazeX: 0.5, gazeY: 0.55 }),
  wistful: face({ ...eyes({ lidTop: 0.42, bowTop: 1, pupil: 0.7 }), mouth: { width: 12, curve: 0.5, dy: 0.5 }, gazeX: 0.3, gazeY: -0.6 }),
  serene: face({ ...eyes({ w: 19, lidTop: 0.64, bowTop: -1, lidBottom: 0, pupil: 0.5, ink: 0, dy: 0.5 }), mouth: { width: 13, curve: 0.45 } }),
  intrigued: face({ ...eyes({ pupil: 0.6 }, { w: 18.5, h: 24.5 }, { h: 20.5, lidTop: 0.24, bowTop: 0.15 }), mouth: { width: 9, curve: 0.2, open: 0.12, lift: 0.35 }, gazeX: 0.45, gazeY: -0.3 }),
  pondering: face({ ...eyes({ lidTop: 0.24, bowTop: 0.1 }), mouth: { width: 10, curve: -0.1, lift: -0.6, dy: 0.5 }, gazeX: 0.75, gazeY: -0.8 }),
  intent: face({ ...eyes({ lidTop: 0.3, bowTop: 0, lidSlant: 0.45, slant: 3, pupil: 0.52 }), mouth: { width: 11, curve: 0.15 } }),
  resolute: face({ ...eyes({ slant: 4, lidTop: 0.32, bowTop: 0, lidSlant: 0.42, pupil: 0.54 }), mouth: { width: 14, curve: 0.12 } }),
  doubtful: face({ ...eyes({}, { lidTop: 0.46, bowTop: 0, lidSlant: 0.25 }, { lidTop: 0.08, bowTop: 0.3 }), mouth: { width: 12, curve: -0.05, lift: -0.55 }, gazeX: 0.4 }),
  puzzled: face({ ...eyes({}, { lidTop: 0.4, bowTop: 0.1, lidSlant: -0.3 }, { h: 23.5 }), mouth: { width: 12, curve: -0.2, lift: 0.6 }, gazeX: -0.35 }),
  watchful: face({ ...eyes({ w: 18, h: 25, pupil: 0.36, slant: 2, dy: -1 }), mouth: { width: 10, curve: 0, open: 0.18 } }),
  startled: face({ ...eyes({ w: 19.5, h: 25.5, pupil: 0.38, dy: -1 }), mouth: { width: 9, curve: 0, open: 0.7, dy: 1 } }),
  uneasy: face({ ...eyes({ slant: -6, h: 21.5, lidTop: 0.2, bowTop: -0.5, lidSlant: -0.6, pupil: 0.52 }), mouth: { width: 14, curve: -0.35, open: 0.1 }, gazeY: -0.2 }),
  downcast: face({ ...eyes({ slant: -8, lidTop: 0.3, bowTop: 0.6, lidSlant: -0.5, pupil: 0.6, dy: 1 }), mouth: { width: 13, curve: -0.65, dy: 1.5 }, gazeY: 0.3 }),
  weary: face({ ...eyes({ lidTop: 0.5, bowTop: 0, glint: 0.5 }), mouth: { width: 13, curve: -0.1 }, gazeX: 0.6 }),
  heedful: face({ ...eyes({ h: 23.5, pupil: 0.62, lidTop: 0.02, bowTop: 0.4, lidBottom: 0.06, bowBottom: 1, dy: -0.5 }), mouth: { width: 9, curve: 0.3 } }),
  chatty: face({ ...eyes({ lidBottom: 0.2, bowBottom: 1, pupil: 0.6 }), mouth: { width: 16, curve: 0.5, open: 0.34 } }),
  drowsy: face({ ...eyes({ lidTop: 0.56, bowTop: 0.3, pupil: 0.52, glint: 0.3, dy: 1 }), mouth: { width: 9, curve: 0.1, dy: 1 }, gazeY: 0.5 }),
};

const EYE_RANGE: Record<keyof EyeParams, [number, number]> = {
  w: [8, 24],
  h: [8, 30],
  round: [0, 1],
  slant: [-20, 20],
  lidTop: [0, 1],
  lidBottom: [0, 1],
  bowTop: [-1, 1],
  bowBottom: [-1, 1],
  lidSlant: [-1, 1],
  pupil: [0.2, 0.9],
  ink: [0, 1],
  glint: [0, 1],
  dx: [-4, 4],
  dy: [-4, 4],
};

const MOUTH_RANGE: Record<keyof MouthParams, [number, number]> = {
  width: [4, 32],
  curve: [-1, 1],
  open: [0, 1],
  lift: [-1, 1],
  dy: [-4, 4],
  show: [0, 1],
};

export function validateFace(face: FaceParams): string[] {
  const problems: string[] = [];
  const check = (label: string, value: number, [lo, hi]: [number, number]) => {
    if (!Number.isFinite(value) || value < lo || value > hi) problems.push(`${label}=${value} outside ${lo}..${hi}`);
  };
  for (const side of ["left", "right"] as const) {
    for (const key of Object.keys(EYE_RANGE) as (keyof EyeParams)[]) check(`${side}.${key}`, face[side][key], EYE_RANGE[key]);
    if (face[side].lidTop + face[side].lidBottom > 1) problems.push(`${side} lids cover more than the eye`);
  }
  for (const key of Object.keys(MOUTH_RANGE) as (keyof MouthParams)[]) check(`mouth.${key}`, face.mouth[key], MOUTH_RANGE[key]);
  check("blush", face.blush, [0, 1]);
  check("gazeX", face.gazeX, [-1, 1]);
  check("gazeY", face.gazeY, [-1, 1]);
  return problems;
}
