import { flattenPath } from "./path";

export type ShapeName = "circle" | "triangle" | "square";

export const SHAPE_NAMES: readonly ShapeName[] = ["circle", "triangle", "square"];

export const SHAPE_PATHS: Record<ShapeName, string> = {
  circle: "M50 4.5a45.5 45.5 0 1 1 0 91a45.5 45.5 0 1 1 0-91z",
  triangle: "M50 8.1c4.2 0 7.3 2.1 9.4 6.3l34.6 62.9c4.2 7.3-1 14.7-9.4 14.7H15.4c-8.4 0-13.6-7.3-9.4-14.7l34.6-62.9c2.1-4.2 5.2-6.3 9.4-6.3z",
  square: "M17 4.5h66c6.9 0 12.5 5.6 12.5 12.5v66c0 6.9-5.6 12.5-12.5 12.5H17c-6.9 0-12.5-5.6-12.5-12.5v-66C4.5 10.1 10.1 4.5 17 4.5z",
};

export interface ShapeBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function bounds(d: string): ShapeBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of flattenPath(d)) {
    for (const [x, y] of poly) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

export const SHAPE_BOUNDS: Record<ShapeName, ShapeBounds> = Object.fromEntries((Object.keys(SHAPE_PATHS) as ShapeName[]).map((shape) => [shape, bounds(SHAPE_PATHS[shape])])) as Record<ShapeName, ShapeBounds>;
