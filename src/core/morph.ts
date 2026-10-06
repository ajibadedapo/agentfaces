import type { Point, Polygon } from "./path";

export const MORPH_GRID = { min: -6, max: 106, step: 1 } as const;
export const MORPH_POINTS = 120;
export const MORPH_KEYFRAMES = 14;
export const MORPH_PUFF = 24;
const BLEND_SAMPLES = 64;
const GRID_SIZE = Math.round((MORPH_GRID.max - MORPH_GRID.min) / MORPH_GRID.step) + 1;

export interface MorphField {
  values: Float32Array;
  sharp?: Float32Array;
}

export const MORPH_SETTLE = 4;

export interface MorphLoop {
  points: Polygon;
  area: number;
}

const f = (n: number) => {
  const s = n.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
};

export function polygonArea(poly: Polygon): number {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) area += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
  return area / 2;
}

function gridCoord(i: number): number {
  return MORPH_GRID.min + i * MORPH_GRID.step;
}

export function signedDistanceField(poly: Polygon): MorphField {
  const n = GRID_SIZE;
  const values = new Float32Array(n * n);
  const count = poly.length;
  const ax = new Float64Array(count);
  const ay = new Float64Array(count);
  const vx = new Float64Array(count);
  const vy = new Float64Array(count);
  const inv = new Float64Array(count);
  for (let k = 0; k < count; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % count];
    ax[k] = a[0];
    ay[k] = a[1];
    vx[k] = b[0] - a[0];
    vy[k] = b[1] - a[1];
    const len = vx[k] * vx[k] + vy[k] * vy[k];
    inv[k] = len === 0 ? 0 : 1 / len;
  }
  for (let j = 0; j < n; j++) {
    const y = gridCoord(j);
    const crossings: number[] = [];
    for (let k = 0; k < count; k++) {
      const y0 = ay[k];
      const y1 = ay[k] + vy[k];
      if (y0 > y !== y1 > y) crossings.push(ax[k] + ((y - y0) / (y1 - y0)) * vx[k]);
    }
    crossings.sort((p, q) => p - q);
    for (let i = 0; i < n; i++) {
      const x = gridCoord(i);
      let best = Infinity;
      for (let k = 0; k < count; k++) {
        const px = x - ax[k];
        const py = y - ay[k];
        let t = (px * vx[k] + py * vy[k]) * inv[k];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - t * vx[k];
        const dy = py - t * vy[k];
        const d = dx * dx + dy * dy;
        if (d < best) best = d;
      }
      let inside = false;
      for (const c of crossings) {
        if (c > x) break;
        inside = !inside;
      }
      values[j * n + i] = inside ? -Math.sqrt(best) : Math.sqrt(best);
    }
  }
  return { values };
}

export const MORPH_SMOOTH = { radius: 2, passes: 3 } as const;

export function smoothField(field: MorphField, radius: number = MORPH_SMOOTH.radius, passes: number = MORPH_SMOOTH.passes): MorphField {
  const n = GRID_SIZE;
  let src = field.values;
  let tmp = new Float32Array(src.length);
  const width = radius * 2 + 1;
  for (let p = 0; p < passes; p++) {
    const horizontal = new Float32Array(src.length);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += src[j * n + Math.min(n - 1, Math.max(0, i + k))];
        horizontal[j * n + i] = sum / width;
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        let sum = 0;
        for (let k = -radius; k <= radius; k++) sum += horizontal[Math.min(n - 1, Math.max(0, j + k)) * n + i];
        tmp[j * n + i] = sum / width;
      }
    }
    src = tmp;
    tmp = new Float32Array(src.length);
  }
  return { values: src, sharp: field.values };
}

export function strokeFieldSuffixes(centre: readonly Point[], halfWidths: readonly number[], starts: readonly number[]): Map<number, MorphField> {
  const n = GRID_SIZE;
  const best = new Float32Array(n * n).fill(Infinity);
  const wanted = new Set(starts.map((start) => Math.max(0, Math.min(centre.length - 2, start))));
  const out = new Map<number, MorphField>();
  const xs = new Float64Array(n);
  for (let i = 0; i < n; i++) xs[i] = gridCoord(i);
  for (let k = centre.length - 2; k >= 0; k--) {
    const a = centre[k];
    const b = centre[k + 1];
    const vx = b[0] - a[0];
    const vy = b[1] - a[1];
    const len = vx * vx + vy * vy;
    const inv = len === 0 ? 0 : 1 / len;
    const w0 = halfWidths[k];
    const dw = halfWidths[k + 1] - w0;
    for (let j = 0; j < n; j++) {
      const py = xs[j] - a[1];
      const row = j * n;
      for (let i = 0; i < n; i++) {
        const px = xs[i] - a[0];
        let t = (px * vx + py * vy) * inv;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - t * vx;
        const dy = py - t * vy;
        const d = Math.sqrt(dx * dx + dy * dy) - (w0 + dw * t);
        if (d < best[row + i]) best[row + i] = d;
      }
    }
    if (wanted.has(k)) out.set(k, { values: best.slice() });
  }
  return out;
}

export function strokeField(centre: readonly Point[], halfWidths: readonly number[], from = 0): MorphField {
  const start = Math.max(0, Math.min(centre.length - 2, from));
  return strokeFieldSuffixes(centre, halfWidths, [start]).get(start)!;
}

export type MorphFieldSource = MorphField | ((e: number) => MorphField);

const fieldAt = (source: MorphFieldSource, e: number): MorphField => (typeof source === "function" ? source(e) : source);

export function blendField(from: MorphField, to: MorphField, e: number, into?: Float32Array): Float32Array {
  const out = into ?? new Float32Array(from.values.length);
  const a = from.values;
  const b = to.values;
  const puff = MORPH_PUFF * e * (1 - e);
  const sharp = to.sharp;
  const settle = e ** MORPH_SETTLE;
  if (sharp) for (let k = 0; k < out.length; k++) out[k] = a[k] + (b[k] + (sharp[k] - b[k]) * settle - a[k]) * e - puff;
  else for (let k = 0; k < out.length; k++) out[k] = a[k] + (b[k] - a[k]) * e - puff;

  return out;
}

export function contourLoops(values: Float32Array): MorphLoop[] {
  const n = GRID_SIZE;
  const inside = (v: number) => v < 0;
  const edgeKey = (i: number, j: number, horizontal: boolean) => (horizontal ? 0 : n * n) + j * n + i;
  const positions = new Map<number, Point>();
  const lerp = (i0: number, j0: number, i1: number, j1: number): Point => {
    const v0 = values[j0 * n + i0];
    const v1 = values[j1 * n + i1];
    const t = v0 === v1 ? 0.5 : v0 / (v0 - v1);
    return [gridCoord(i0) + (gridCoord(i1) - gridCoord(i0)) * t, gridCoord(j0) + (gridCoord(j1) - gridCoord(j0)) * t];
  };
  const links = new Map<number, number[]>();
  const link = (a: number, b: number) => {
    const la = links.get(a);
    if (la) la.push(b);
    else links.set(a, [b]);
    const lb = links.get(b);
    if (lb) lb.push(a);
    else links.set(b, [a]);
  };
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const tl = values[j * n + i];
      const tr = values[j * n + i + 1];
      const br = values[(j + 1) * n + i + 1];
      const bl = values[(j + 1) * n + i];
      const code = (inside(tl) ? 8 : 0) | (inside(tr) ? 4 : 0) | (inside(br) ? 2 : 0) | (inside(bl) ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const top = edgeKey(i, j, true);
      const bottom = edgeKey(i, j + 1, true);
      const left = edgeKey(i, j, false);
      const right = edgeKey(i + 1, j, false);
      const at = (key: number) => {
        if (positions.has(key)) return;
        if (key === top) positions.set(key, lerp(i, j, i + 1, j));
        else if (key === bottom) positions.set(key, lerp(i, j + 1, i + 1, j + 1));
        else if (key === left) positions.set(key, lerp(i, j, i, j + 1));
        else positions.set(key, lerp(i + 1, j, i + 1, j + 1));
      };
      const segment = (a: number, b: number) => {
        at(a);
        at(b);
        link(a, b);
      };
      const centreInside = inside((tl + tr + br + bl) / 4);
      switch (code) {
        case 1:
        case 14:
          segment(left, bottom);
          break;
        case 2:
        case 13:
          segment(bottom, right);
          break;
        case 3:
        case 12:
          segment(left, right);
          break;
        case 4:
        case 11:
          segment(top, right);
          break;
        case 6:
        case 9:
          segment(top, bottom);
          break;
        case 7:
        case 8:
          segment(left, top);
          break;
        case 5:
          if (centreInside) {
            segment(left, top);
            segment(bottom, right);
          } else {
            segment(left, bottom);
            segment(top, right);
          }
          break;
        case 10:
          if (centreInside) {
            segment(left, bottom);
            segment(top, right);
          } else {
            segment(left, top);
            segment(bottom, right);
          }
          break;
      }
    }
  }
  const seen = new Set<number>();
  const loops: MorphLoop[] = [];
  for (const startKey of links.keys()) {
    if (seen.has(startKey)) continue;
    const points: Polygon = [];
    let previous = -1;
    let current = startKey;
    while (!seen.has(current)) {
      seen.add(current);
      points.push(positions.get(current)!);
      const next = (links.get(current) ?? []).find((key) => key !== previous && !seen.has(key));
      if (next === undefined) break;
      previous = current;
      current = next;
    }
    if (points.length >= 3) loops.push({ points, area: polygonArea(points) });
  }
  return loops;
}

export function outerLoop(loops: MorphLoop[]): MorphLoop | null {
  let best: MorphLoop | null = null;
  for (const loop of loops) if (!best || Math.abs(loop.area) > Math.abs(best.area)) best = loop;
  return best;
}

export function insideCount(values: Float32Array): number {
  let count = 0;
  for (let k = 0; k < values.length; k++) if (values[k] < 0) count++;
  return count;
}

export function resampleLoop(poly: Polygon, count = MORPH_POINTS): Polygon {
  const clockwise = polygonArea(poly) > 0 ? poly : [...poly].reverse();
  const n = clockwise.length;
  const lengths: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const a = clockwise[i - 1];
    const b = clockwise[i % n];
    lengths.push(lengths[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = lengths[n];
  const out: Polygon = [];
  let seg = 0;
  for (let k = 0; k < count; k++) {
    const target = (total * k) / count;
    while (seg < n - 1 && lengths[seg + 1] < target) seg++;
    const a = clockwise[seg];
    const b = clockwise[(seg + 1) % n];
    const span = lengths[seg + 1] - lengths[seg] || 1;
    const t = Math.min(1, Math.max(0, (target - lengths[seg]) / span));
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

export function alignLoop(loop: Polygon, reference: Polygon): Polygon {
  const n = loop.length;
  let bestShift = 0;
  let bestCost = Infinity;
  for (let shift = 0; shift < n; shift++) {
    let cost = 0;
    for (let i = 0; i < n && cost < bestCost; i++) {
      const p = loop[(i + shift) % n];
      const q = reference[i];
      cost += (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestShift = shift;
    }
  }
  return [...loop.slice(bestShift), ...loop.slice(0, bestShift)];
}

export function blendSchedule(from: MorphField, to: MorphField, keyframes = MORPH_KEYFRAMES): number[] {
  const scratch = new Float32Array(from.values.length);
  const previous = new Uint8Array(from.values.length);
  const travelled: number[] = [0];
  const levels: number[] = [0];
  blendField(from, to, 0, scratch);
  for (let k = 0; k < scratch.length; k++) previous[k] = scratch[k] < 0 ? 1 : 0;
  for (let s = 1; s <= BLEND_SAMPLES; s++) {
    const e = s / BLEND_SAMPLES;
    blendField(from, to, e, scratch);
    let changed = 0;
    for (let k = 0; k < scratch.length; k++) {
      const now = scratch[k] < 0 ? 1 : 0;
      if (now !== previous[k]) changed++;
      previous[k] = now;
    }
    travelled.push(travelled[s - 1] + changed + 1e-3);
    levels.push(e);
  }
  const total = travelled[BLEND_SAMPLES];
  const out: number[] = [];
  let s = 0;
  for (let k = 0; k <= keyframes; k++) {
    const target = (total * k) / keyframes;
    while (s < BLEND_SAMPLES - 1 && travelled[s + 1] < target) s++;
    const span = travelled[s + 1] - travelled[s] || 1;
    const t = Math.min(1, Math.max(0, (target - travelled[s]) / span));
    out.push(levels[s] + (levels[s + 1] - levels[s]) * t);
  }
  out[0] = 0;
  out[keyframes] = 1;
  return out;
}

export const MORPH_RELAX = { passes: 4, shrink: 0.5, inflate: -0.53 } as const;

export function relaxLoop(loop: Polygon, passes: number = MORPH_RELAX.passes): Polygon {
  let current = loop;
  const n = loop.length;
  for (let p = 0; p < passes * 2; p++) {
    const weight = p % 2 === 0 ? MORPH_RELAX.shrink : MORPH_RELAX.inflate;
    current = current.map(([x, y], i) => {
      const a = current[(i - 1 + n) % n];
      const b = current[(i + 1) % n];
      return [x + ((a[0] + b[0]) / 2 - x) * weight, y + ((a[1] + b[1]) / 2 - y) * weight] as Point;
    });
  }
  return current;
}

export const MORPH_REFINE = { step: 4, depth: 3 } as const;

export interface MorphTrack {
  frames: Polygon[];
  times: number[];
  dropped: number[];
}

function largestStep(a: Polygon, b: Polygon): number {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.hypot(a[i][0] - b[i][0], a[i][1] - b[i][1]));
  return worst;
}

export function buildMorphTrack(fromOutline: Polygon, toOutline: Polygon, fromField: MorphField, toSource: MorphFieldSource, keyframes = MORPH_KEYFRAMES, points = MORPH_POINTS): MorphTrack {
  const levels = blendSchedule(fromField, fieldAt(toSource, 1), keyframes);
  const scratch = new Float32Array(fromField.values.length);
  const contourAt = (e: number): { loop: Polygon | null; dropped: number } => {
    blendField(fromField, fieldAt(toSource, e), e, scratch);
    const loops = contourLoops(scratch);
    const outer = outerLoop(loops);
    const kept = outer ? Math.abs(outer.area) : 0;
    const rest = loops.reduce((sum, loop) => sum + (loop === outer ? 0 : Math.abs(loop.area)), 0);
    return { loop: outer ? relaxLoop(resampleLoop(outer.points, points)) : null, dropped: rest / Math.max(1, kept) };
  };
  const frames: Polygon[] = [resampleLoop(fromOutline, points)];
  const times: number[] = [0];
  const dropped: number[] = [0];
  const refine = (fromLevel: number, toLevel: number, fromTime: number, toTime: number, target: Polygon, depth: number) => {
    const previous = frames[frames.length - 1];
    const aligned = alignLoop(target, previous);
    if (depth < MORPH_REFINE.depth && largestStep(previous, aligned) > MORPH_REFINE.step && toLevel > fromLevel) {
      const midLevel = (fromLevel + toLevel) / 2;
      const midTime = (fromTime + toTime) / 2;
      const mid = contourAt(midLevel);
      if (mid.loop) {
        refine(fromLevel, midLevel, fromTime, midTime, mid.loop, depth + 1);
        dropped.push(mid.dropped);
        frames.push(alignLoop(mid.loop, frames[frames.length - 1]));
        times.push(midTime);
        refine(midLevel, toLevel, midTime, toTime, target, depth + 1);
        return;
      }
    }
  };
  for (let k = 1; k <= keyframes; k++) {
    const level = levels[k];
    const time = k / keyframes;
    const sample = k === keyframes ? { loop: resampleLoop(toOutline, points), dropped: 0 } : contourAt(level);
    const loop = sample.loop ?? frames[frames.length - 1];
    refine(levels[k - 1], level, times[times.length - 1], time, loop, 0);
    frames.push(alignLoop(loop, frames[frames.length - 1]));
    times.push(time);
    dropped.push(sample.dropped);
  }
  return { frames, times, dropped };
}

export function framePoints(track: Pick<MorphTrack, "frames" | "times">, t: number): Polygon {
  const { frames, times } = track;
  const at = Math.min(1, Math.max(0, t));
  let k = 0;
  while (k < times.length - 2 && times[k + 1] < at) k++;
  const span = times[k + 1] - times[k] || 1;
  const u = Math.min(1, Math.max(0, (at - times[k]) / span));
  const a = frames[k];
  const b = frames[k + 1];
  return a.map(([x, y], i) => [x + (b[i][0] - x) * u, y + (b[i][1] - y) * u] as Point);
}

export function smoothClosedPath(points: Polygon): string {
  const n = points.length;
  let d = `M ${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)} ${f(c2x)} ${f(c2y)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d} Z`;
}
