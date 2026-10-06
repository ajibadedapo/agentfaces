import { EXPRESSION_NAMES, type ExpressionName } from "./expressions";
import { createRng, type Rng } from "./random";
import { STATE_EXPRESSIONS, type AgentState } from "./states";

export const BLINK_GAP = { min: 2500, max: 6000 } as const;
export const BLINK_DURATION = 150;
export const DOUBLE_BLINK_CHANCE = 0.2;
export const GAZE_GAP = { min: 1400, max: 3400 } as const;
export const GAZE_REST = { min: 0.3, max: 0.9 } as const;
export const SACCADE_GAP = { min: 500, max: 1500 } as const;
export const SACCADE_SIZE = 0.2;
export const SACCADE_DURATION = 70;
export const MOUTH_LAG = { min: 40, max: 80 } as const;

export type Cue =
  | { kind: "blink"; count: 1 | 2; duration: number }
  | { kind: "gaze"; x: number; y: number }
  | { kind: "saccade"; x: number; y: number; duration: number }
  | { kind: "expression"; name: ExpressionName; mouthDelay: number };

export interface DirectorOptions {
  state: AgentState;
  expression?: ExpressionName | null;
}

export class Director {
  private rng: Rng;
  private state: AgentState;
  private override: ExpressionName | null;
  private current: ExpressionName;
  private started = false;
  private nextBlink = 0;
  private nextGaze = 0;
  private nextSaccade = 0;
  private nextExpression = 0;
  private pendingExpression = true;
  private lastNow = 0;

  constructor(seed: string, options: DirectorOptions) {
    this.rng = createRng(`face:${seed}`);
    this.state = options.state;
    this.override = options.expression ?? null;
    this.current = this.override ?? STATE_EXPRESSIONS[this.state].pool[0];
  }

  get expression(): ExpressionName {
    return this.current;
  }

  set(options: DirectorOptions): void {
    const override = options.expression ?? null;
    if (options.state === this.state && override === this.override) return;
    this.state = options.state;
    this.override = override;
    this.current = override ?? STATE_EXPRESSIONS[this.state].pool[0];
    this.pendingExpression = true;
    this.nextExpression = 0;
  }

  resume(now: number): void {
    if (!this.started) return;
    const shift = now - this.lastNow;
    if (shift <= 0) return;
    this.nextBlink += shift;
    this.nextGaze += shift;
    this.nextSaccade += shift;
    this.nextExpression += shift;
    this.lastNow = now;
  }

  tick(now: number): Cue[] {
    const cues: Cue[] = [];
    this.lastNow = now;
    if (!this.started) {
      this.started = true;
      this.nextBlink = now + this.rng.range(BLINK_GAP.min, BLINK_GAP.max);
      this.nextGaze = now + this.rng.range(GAZE_GAP.min, GAZE_GAP.max);
      this.nextSaccade = now + this.rng.range(SACCADE_GAP.min, SACCADE_GAP.max);
      cues.push(this.restGaze());
    }
    if (this.pendingExpression) {
      this.pendingExpression = false;
      cues.push({ kind: "expression", name: this.current, mouthDelay: this.rng.range(MOUTH_LAG.min, MOUTH_LAG.max) });
      this.nextExpression = now + this.cadence();
    }
    if (now >= this.nextBlink) {
      cues.push({ kind: "blink", count: this.rng.chance(DOUBLE_BLINK_CHANCE) ? 2 : 1, duration: BLINK_DURATION });
      this.nextBlink = now + this.rng.range(BLINK_GAP.min, BLINK_GAP.max);
    }
    if (now >= this.nextGaze) {
      cues.push(this.restGaze());
      this.nextGaze = now + this.rng.range(GAZE_GAP.min, GAZE_GAP.max);
    }
    if (now >= this.nextSaccade) {
      const angle = this.rng.range(0, Math.PI * 2);
      cues.push({ kind: "saccade", x: Math.cos(angle) * SACCADE_SIZE, y: Math.sin(angle) * SACCADE_SIZE * 0.6, duration: SACCADE_DURATION });
      this.nextSaccade = now + this.rng.range(SACCADE_GAP.min, SACCADE_GAP.max);
    }
    if (!this.override && now >= this.nextExpression) {
      const pool = STATE_EXPRESSIONS[this.state].pool;
      if (pool.length > 1) {
        const others = pool.filter((name) => name !== this.current);
        this.current = this.rng.pick(others);
        cues.push({ kind: "expression", name: this.current, mouthDelay: this.rng.range(MOUTH_LAG.min, MOUTH_LAG.max) });
      }
      this.nextExpression = now + this.cadence();
    }
    return cues;
  }

  private cadence(): number {
    return STATE_EXPRESSIONS[this.state].cadence * this.rng.range(0.8, 1.25);
  }

  private restGaze(): Cue {
    const angle = this.rng.range(0, Math.PI * 2);
    const radius = this.rng.range(GAZE_REST.min, GAZE_REST.max);
    return { kind: "gaze", x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.7 };
  }
}

export function isExpressionName(value: unknown): value is ExpressionName {
  return typeof value === "string" && (EXPRESSION_NAMES as readonly string[]).includes(value);
}
