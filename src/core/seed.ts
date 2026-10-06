import { DEFAULT_PALETTE } from "./palette";
import { hashSeed } from "./random";
import { SHAPE_NAMES, type ShapeName } from "./shapes";

export interface FaceForOptions {
  shapes?: readonly ShapeName[];
  palette?: readonly string[];
}

export interface FacePick {
  shape: ShapeName;
  color: string;
}

export function faceFor(seed: string, { shapes = SHAPE_NAMES, palette = DEFAULT_PALETTE }: FaceForOptions = {}): FacePick {
  const pool = shapes.length ? shapes : SHAPE_NAMES;
  const colors = palette.length ? palette : DEFAULT_PALETTE;
  const h = hashSeed(seed);
  return { shape: pool[h % pool.length], color: colors[(h >>> 8) % colors.length] };
}
