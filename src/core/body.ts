import { createRng } from "./random";
import { stepSprings, type SpringConfig } from "./spring";
import type { MotionKind } from "./states";

export interface BodyPose {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotate: number;
  turn: number;
}

export const REST_BODY: BodyPose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0, turn: 0 };

export const BODY_SPRINGS = {
  lift: { stiffness: 190, damping: 15, rest: 0.01 } as SpringConfig,
  sway: { stiffness: 110, damping: 14, rest: 0.01 } as SpringConfig,
  size: { stiffness: 150, damping: 18, rest: 0.0005 } as SpringConfig,
  turn: { stiffness: 55, damping: 12, rest: 0.002 } as SpringConfig,
  squash: { stiffness: 300, damping: 17, rest: 0.001 } as SpringConfig,
};

export const STRETCH_PER_VELOCITY = 0.0032;
export const STRETCH_LIMIT = 0.09;
export const LANDING_IMPULSE = 2.6;
export const CROUCH = { share: 0.12, squash: -0.09 } as const;
export const HOP_HEIGHT = 11;
export const BOB_HEIGHT = 7;
export const LEAN = { size: 1.035, sink: 1.6, tilt: -1.25, breath: 0.008, pulse: 0.05 } as const;
export const TALK = { nod: 2.6, swell: 0.022, sway: 1.4, breath: 0.01 } as const;

const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export class BodyPerformer {
  private kind: MotionKind;
  private duration: number;
  private loop: boolean;
  private phaseOffset: number;
  private start = -1;
  private lift = [0];
  private liftVelocity = [0];
  private sway = [0, 0];
  private swayVelocity = [0, 0];
  private size = [1];
  private sizeVelocity = [0];
  private turn = [0];
  private turnVelocity = [0];
  private squash = [0];
  private squashVelocity = [0];
  private airborne = false;
  private finished = false;

  constructor(seed: string, kind: MotionKind, duration: number, loop: boolean) {
    const rng = createRng(`body:${seed}`);
    this.phaseOffset = rng.next();
    this.kind = kind;
    this.duration = duration;
    this.loop = loop;
  }

  set(kind: MotionKind, duration: number, loop: boolean): void {
    if (kind === this.kind && duration === this.duration && loop === this.loop) return;
    this.kind = kind;
    this.duration = duration;
    this.loop = loop;
    this.start = -1;
    this.finished = false;
  }

  update(now: number, dt: number, level = 0): BodyPose {
    if (this.start < 0) this.start = now;
    const elapsed = now - this.start;
    const cycles = elapsed / this.duration + this.phaseOffset * (this.loop ? 1 : 0);
    if (!this.loop && elapsed >= this.duration) this.finished = true;
    const phase = this.finished ? 0 : cycles - Math.floor(cycles);
    const wave = Math.sin(phase * TAU);
    const targets = { lift: 0, swayX: 0, rotate: 0, size: 1, turn: 0, squash: 0 };
    if (!this.finished) {
      switch (this.kind) {
        case "breathe":
          targets.size = 1 + 0.018 * wave;
          targets.lift = -0.55 * Math.sin(phase * TAU + 0.7);
          break;
        case "bob":
          if (phase < CROUCH.share) targets.squash = CROUCH.squash * 0.6;
          else targets.lift = phase < 0.55 ? -BOB_HEIGHT : 0;
          break;
        case "hop":
          if (phase < CROUCH.share) targets.squash = CROUCH.squash;
          else targets.lift = phase < 0.52 ? -HOP_HEIGHT : 0;
          break;
        case "tilt":
          targets.rotate = 8 * wave;
          targets.lift = -0.4 * Math.abs(wave);
          break;
        case "pulse":
          targets.size = 1 + 0.1 * Math.max(0, Math.sin(phase * TAU)) ** 1.5;
          break;
        case "squash":
          targets.squash = phase < 0.5 ? -0.11 : 0.07;
          break;
        case "turn":
          targets.turn = wave;
          targets.swayX = 3 * wave;
          targets.rotate = 4 * wave;
          break;
        case "lean":
          targets.size = LEAN.size + LEAN.breath * wave + LEAN.pulse * clamp(level, 0, 1);
          targets.lift = LEAN.sink;
          targets.rotate = LEAN.tilt;
          break;
        case "talk":
          targets.size = 1 + TALK.breath * wave + TALK.swell * clamp(level, 0, 1);
          targets.lift = -TALK.nod * clamp(level, 0, 1);
          targets.rotate = TALK.sway * wave;
          break;
      }
    }
    const seconds = dt / 1000;
    const wasAirborne = this.lift[0] < -0.6;
    stepSprings(this.lift, this.liftVelocity, [targets.lift], seconds, BODY_SPRINGS.lift);
    stepSprings(this.sway, this.swayVelocity, [targets.swayX, targets.rotate], seconds, BODY_SPRINGS.sway);
    stepSprings(this.size, this.sizeVelocity, [targets.size], seconds, BODY_SPRINGS.size);
    stepSprings(this.turn, this.turnVelocity, [targets.turn], seconds, BODY_SPRINGS.turn);
    const landing = wasAirborne && this.lift[0] >= -0.6 && this.liftVelocity[0] > 8;
    if (landing) this.squashVelocity[0] = Math.min(this.squashVelocity[0], -LANDING_IMPULSE * clamp(this.liftVelocity[0] / 60, 0.3, 1));
    this.airborne = this.lift[0] < -0.6;
    const stretch = clamp(-this.liftVelocity[0] * STRETCH_PER_VELOCITY, -STRETCH_LIMIT, STRETCH_LIMIT);
    stepSprings(this.squash, this.squashVelocity, [targets.squash + stretch], seconds, BODY_SPRINGS.squash);
    const vertical = this.squash[0];
    return {
      x: this.sway[0],
      y: this.lift[0],
      scaleX: this.size[0] * (1 - vertical * 0.6),
      scaleY: this.size[0] * (1 + vertical),
      rotate: this.sway[1],
      turn: this.turn[0],
    };
  }

  get inAir(): boolean {
    return this.airborne;
  }
}
