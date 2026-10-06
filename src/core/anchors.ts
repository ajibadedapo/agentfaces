import type { ShapeName } from "./shapes";
import { INK_FACE, SMALL_FACE, type FaceAnchor } from "./face";

export const FACE_ANCHORS: Record<ShapeName, FaceAnchor> = {
  circle: { cx: 50, cy: 49, scale: 1.3, safe: { x: 9.5, y: 21.5, w: 81, h: 64.5 } },
  triangle: { cx: 50, cy: 64, scale: 0.93, safe: { x: 21, y: 44, w: 58, h: 47 } },
  square: { cx: 50, cy: 49, scale: 1.3, safe: { x: 9.5, y: 21.5, w: 81, h: 64.5 } },
};

export const SMALL_BOOST: Record<ShapeName, number> = { circle: 1.12, triangle: 1.14, square: 1.2 };

export function smallFaceShare(size: number): number {
  return Math.min(1, Math.max(0, (SMALL_FACE.from - size) / (SMALL_FACE.from - SMALL_FACE.to)));
}

export function inkFaceShare(size: number): number {
  return Math.min(1, Math.max(0, (INK_FACE.from - size) / (INK_FACE.from - INK_FACE.to)));
}

export function anchorForSize(shape: ShapeName, size?: number): FaceAnchor {
  const base = FACE_ANCHORS[shape];
  if (size === undefined || size >= SMALL_FACE.from) return base;
  const share = smallFaceShare(size);
  const boost = 1 + share * (SMALL_BOOST[shape] - 1);
  const ink = inkFaceShare(size);
  return {
    ...base,
    scale: base.scale * boost,
    detail: {
      glint: size < SMALL_FACE.glintBelow ? 0 : 1,
      mouthWeight: 1 + share * (SMALL_FACE.mouthWeight - 1),
      eyeSpread: 1 - share * (1 - SMALL_FACE.eyeSpread),
      turn: 1 - share * (1 - SMALL_FACE.turn),
      ink,
      pixel: ink > 0 ? 100 / size : 0,
    },
  };
}
