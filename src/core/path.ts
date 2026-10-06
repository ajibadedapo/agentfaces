export type Point = readonly [number, number];
export type Polygon = Point[];

const NUMBER = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;
const SEGMENTS = 32;

function tokenize(d: string): Array<string | number> {
  const out: Array<string | number> = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) out.push(m[1] ? m[1] : Number(m[2]));
  return out;
}

function cubic(p0: Point, p1: Point, p2: Point, p3: Point, into: Polygon) {
  for (let i = 1; i <= SEGMENTS; i++) {
    const t = i / SEGMENTS;
    const u = 1 - t;
    const x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
    const y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
    into.push([x, y]);
  }
}

function quad(p0: Point, p1: Point, p2: Point, into: Polygon) {
  cubic(p0, [p0[0] + (2 / 3) * (p1[0] - p0[0]), p0[1] + (2 / 3) * (p1[1] - p0[1])], [p2[0] + (2 / 3) * (p1[0] - p2[0]), p2[1] + (2 / 3) * (p1[1] - p2[1])], p2, into);
}

function arc(p0: Point, rx: number, ry: number, rotation: number, large: number, sweep: number, p1: Point, into: Polygon) {
  if (rx === 0 || ry === 0) {
    into.push(p1);
    return;
  }
  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1 = cosPhi * dx + sinPhi * dy;
  const y1 = -sinPhi * dx + cosPhi * dy;
  let rxa = Math.abs(rx);
  let rya = Math.abs(ry);
  const lambda = (x1 * x1) / (rxa * rxa) + (y1 * y1) / (rya * rya);
  if (lambda > 1) {
    rxa *= Math.sqrt(lambda);
    rya *= Math.sqrt(lambda);
  }
  const sign = large === sweep ? -1 : 1;
  const num = rxa * rxa * rya * rya - rxa * rxa * y1 * y1 - rya * rya * x1 * x1;
  const den = rxa * rxa * y1 * y1 + rya * rya * x1 * x1;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cx1 = (coef * rxa * y1) / rya;
  const cy1 = (-coef * rya * x1) / rxa;
  const cx = cosPhi * cx1 - sinPhi * cy1 + (p0[0] + p1[0]) / 2;
  const cy = sinPhi * cx1 + cosPhi * cy1 + (p0[1] + p1[1]) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta = angle(1, 0, (x1 - cx1) / rxa, (y1 - cy1) / rya);
  let delta = angle((x1 - cx1) / rxa, (y1 - cy1) / rya, (-x1 - cx1) / rxa, (-y1 - cy1) / rya);
  if (!sweep && delta > 0) delta -= 2 * Math.PI;
  if (sweep && delta < 0) delta += 2 * Math.PI;
  const steps = Math.max(SEGMENTS, Math.ceil(Math.abs(delta) / (Math.PI / 64)));
  for (let i = 1; i <= steps; i++) {
    const t = theta + (delta * i) / steps;
    const ex = rxa * Math.cos(t);
    const ey = rya * Math.sin(t);
    into.push([cosPhi * ex - sinPhi * ey + cx, sinPhi * ex + cosPhi * ey + cy]);
  }
}

export function flattenPath(d: string): Polygon[] {
  const tokens = tokenize(d);
  const polygons: Polygon[] = [];
  let current: Polygon = [];
  let pos: Point = [0, 0];
  let start: Point = [0, 0];
  let lastControl: Point | null = null;
  let command = "";
  let i = 0;
  const read = () => tokens[i++] as number;
  const close = () => {
    if (current.length) polygons.push(current);
    current = [];
  };
  while (i < tokens.length) {
    const token = tokens[i];
    if (typeof token === "string") {
      command = token;
      i++;
      if (command === "Z" || command === "z") {
        close();
        pos = start;
        current = [];
        lastControl = null;
        continue;
      }
    }
    const rel = command === command.toLowerCase();
    const ox = rel ? pos[0] : 0;
    const oy = rel ? pos[1] : 0;
    switch (command.toUpperCase()) {
      case "M": {
        close();
        pos = [read() + ox, read() + oy];
        start = pos;
        current = [pos];
        command = rel ? "l" : "L";
        lastControl = null;
        break;
      }
      case "L": {
        pos = [read() + ox, read() + oy];
        current.push(pos);
        lastControl = null;
        break;
      }
      case "H": {
        pos = [read() + ox, pos[1]];
        current.push(pos);
        lastControl = null;
        break;
      }
      case "V": {
        pos = [pos[0], read() + oy];
        current.push(pos);
        lastControl = null;
        break;
      }
      case "C": {
        const c1: Point = [read() + ox, read() + oy];
        const c2: Point = [read() + ox, read() + oy];
        const end: Point = [read() + ox, read() + oy];
        cubic(pos, c1, c2, end, current);
        lastControl = c2;
        pos = end;
        break;
      }
      case "S": {
        const c1: Point = lastControl ? [2 * pos[0] - lastControl[0], 2 * pos[1] - lastControl[1]] : pos;
        const c2: Point = [read() + ox, read() + oy];
        const end: Point = [read() + ox, read() + oy];
        cubic(pos, c1, c2, end, current);
        lastControl = c2;
        pos = end;
        break;
      }
      case "Q": {
        const c1: Point = [read() + ox, read() + oy];
        const end: Point = [read() + ox, read() + oy];
        quad(pos, c1, end, current);
        lastControl = c1;
        pos = end;
        break;
      }
      case "T": {
        const c1: Point = lastControl ? [2 * pos[0] - lastControl[0], 2 * pos[1] - lastControl[1]] : pos;
        const end: Point = [read() + ox, read() + oy];
        quad(pos, c1, end, current);
        lastControl = c1;
        pos = end;
        break;
      }
      case "A": {
        const rx = read();
        const ry = read();
        const rotation = read();
        const large = read();
        const sweep = read();
        const end: Point = [read() + ox, read() + oy];
        arc(pos, rx, ry, rotation, large, sweep, end, current);
        pos = end;
        lastControl = null;
        break;
      }
      default:
        i++;
    }
  }
  close();
  return polygons;
}

export function pointInPolygons(polygons: Polygon[], x: number, y: number): boolean {
  let inside = false;
  for (const poly of polygons) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

export function distanceToOutline(polygons: Polygon[], x: number, y: number): number {
  let best = Infinity;
  for (const poly of polygons) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const vx = bx - ax;
      const vy = by - ay;
      const len = vx * vx + vy * vy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len));
      best = Math.min(best, Math.hypot(x - (ax + t * vx), y - (ay + t * vy)));
    }
  }
  return best;
}

export function pathNumbers(d: string): number[] {
  return (d.match(NUMBER) ?? []).map(Number);
}
