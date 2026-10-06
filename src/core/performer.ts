import { Director, type Cue, type DirectorOptions } from "./director";
import { EXPRESSIONS } from "./expressions";
import { faceGeometry, fromVector, MOUTH_VECTOR_RANGE, toVector, type FaceAnchor, type FaceGeometry, type FacePose } from "./face";
import { createRng } from "./random";
import { applyVoice, type MouthShape } from "./voice";
import type { AgentState } from "./states";
import { FACE_SPRING, GAZE_SPRING, SACCADE_SPRING, stepSprings, TURN_SPRING } from "./spring";

const BLINK_GAP = 60;
export const BLINK_CLOSE_SHARE = 0.32;
export const GAZE_DRIFT = { x: 0.07, y: 0.05, periodX: 2300, periodY: 3100 } as const;
export const HEAD_FOLLOW = 0.65;
const SACCADE_SETTLE_DISTANCE = 0.06;
const VOICE_EPSILON = 0.002;

export interface VoiceInput {
  state: AgentState;
  level: number;
  mouth: MouthShape | null;
}

export class Performer {
  readonly director: Director;
  private anchor: FaceAnchor;
  private values: number[];
  private velocities: number[];
  private targets: number[];
  private pendingMouth: { at: number; vector: number[] } | null = null;
  private gaze = [0, 0];
  private gazeVelocity = [0, 0];
  private gazeTarget = [0, 0];
  private saccading = false;
  private jitter: { x: number; y: number; start: number; duration: number } | null = null;
  private head = [0];
  private headVelocity = [0];
  private headTarget = [0];
  private driftPhase: [number, number];
  private blink: { start: number; count: number; duration: number } | null = null;
  private settled = false;
  private dirty = true;
  private voice: VoiceInput | null = null;
  private paintedVoice: VoiceInput | null = null;

  constructor(seed: string, anchor: FaceAnchor, options: DirectorOptions) {
    this.director = new Director(seed, options);
    this.anchor = anchor;
    const rng = createRng(`drift:${seed}`);
    this.driftPhase = [rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2)];
    this.values = toVector(EXPRESSIONS[this.director.expression]);
    this.velocities = this.values.map(() => 0);
    this.targets = [...this.values];
  }

  set(options: DirectorOptions): void {
    this.director.set(options);
  }

  resume(now: number): void {
    this.director.resume(now);
    this.blink = null;
    this.jitter = null;
    if (this.pendingMouth) this.pendingMouth.at = now;
    this.dirty = true;
  }

  setVoice(voice: VoiceInput | null): void {
    this.voice = voice;
  }

  setAnchor(anchor: FaceAnchor): void {
    this.anchor = anchor;
    this.dirty = true;
  }

  rest(): FaceGeometry {
    return faceGeometry(EXPRESSIONS[this.director.expression], this.anchor);
  }

  snapToTarget(): void {
    if (this.pendingMouth) {
      this.applyMouth(this.pendingMouth.vector);
      this.pendingMouth = null;
    }
    this.values = [...this.targets];
    this.velocities.fill(0);
    this.gaze = [...this.gazeTarget];
    this.gazeVelocity = [0, 0];
    this.dirty = true;
  }

  update(now: number, dt: number): FaceGeometry | null {
    for (const cue of this.director.tick(now)) this.apply(cue, now);
    if (this.pendingMouth && now >= this.pendingMouth.at) {
      this.applyMouth(this.pendingMouth.vector);
      this.pendingMouth = null;
    }
    const seconds = dt / 1000;
    const faceSettled = stepSprings(this.values, this.velocities, this.targets, seconds, FACE_SPRING);
    const gazeSettled = stepSprings(this.gaze, this.gazeVelocity, this.gazeTarget, seconds, this.saccading ? SACCADE_SPRING : GAZE_SPRING);
    if (this.saccading && Math.hypot(this.gaze[0] - this.gazeTarget[0], this.gaze[1] - this.gazeTarget[1]) < SACCADE_SETTLE_DISTANCE) this.saccading = false;
    const headSettled = stepSprings(this.head, this.headVelocity, this.headTarget, seconds, TURN_SPRING);
    const pose = this.pose(now);
    const transient = this.blink !== null || this.jitter !== null || this.pendingMouth !== null;
    const moving = !faceSettled || !gazeSettled || !headSettled || transient;
    const voiceChanged = voiceDiffers(this.voice, this.paintedVoice);
    if (!moving && this.settled && !this.dirty && !voiceChanged) return null;
    this.settled = !moving;
    this.dirty = false;
    this.paintedVoice = this.voice;
    const params = fromVector(this.values);
    return faceGeometry(this.voice ? applyVoice(params, this.voice.state, this.voice.level, this.voice.mouth) : params, this.anchor, pose);
  }

  private applyMouth(vector: number[]): void {
    for (let i = MOUTH_VECTOR_RANGE.start; i < MOUTH_VECTOR_RANGE.end; i++) this.targets[i] = vector[i];
  }

  private apply(cue: Cue, now: number): void {
    switch (cue.kind) {
      case "expression": {
        const vector = toVector(EXPRESSIONS[cue.name]);
        for (let i = 0; i < vector.length; i++) if (i < MOUTH_VECTOR_RANGE.start || i >= MOUTH_VECTOR_RANGE.end) this.targets[i] = vector[i];
        this.pendingMouth = { at: now + cue.mouthDelay, vector };
        break;
      }
      case "gaze":
        this.gazeTarget = [cue.x, cue.y];
        this.headTarget = [cue.x * HEAD_FOLLOW];
        this.saccading = true;
        break;
      case "saccade":
        this.jitter = { x: cue.x, y: cue.y, start: now, duration: cue.duration };
        break;
      case "blink":
        if (!this.blink) this.blink = { start: now, count: cue.count, duration: cue.duration };
        break;
    }
  }

  private pose(now: number): FacePose {
    let blink = 0;
    if (this.blink) {
      const span = this.blink.duration * this.blink.count + BLINK_GAP * (this.blink.count - 1);
      const t = now - this.blink.start;
      if (t >= span) this.blink = null;
      else {
        const slot = this.blink.duration + BLINK_GAP;
        const local = t % slot;
        if (local < this.blink.duration) {
          const p = local / this.blink.duration;
          if (p < BLINK_CLOSE_SHARE) {
            const q = p / BLINK_CLOSE_SHARE;
            blink = q * q;
          } else {
            const q = (p - BLINK_CLOSE_SHARE) / (1 - BLINK_CLOSE_SHARE);
            blink = 1 - (1 - (1 - q) * (1 - q) * (1 - q));
          }
        }
      }
    }
    let jx = 0;
    let jy = 0;
    if (this.jitter) {
      const t = now - this.jitter.start;
      if (t >= this.jitter.duration * 2) this.jitter = null;
      else {
        const p = t / (this.jitter.duration * 2);
        const amount = p < 0.5 ? p * 2 : 2 - p * 2;
        jx = this.jitter.x * amount;
        jy = this.jitter.y * amount;
      }
    }
    const focus = this.director.focus;
    const driftX = GAZE_DRIFT.x * focus * Math.sin((now / GAZE_DRIFT.periodX) * Math.PI * 2 + this.driftPhase[0]);
    const driftY = GAZE_DRIFT.y * focus * Math.sin((now / GAZE_DRIFT.periodY) * Math.PI * 2 + this.driftPhase[1]);
    return { blink, gazeX: this.gaze[0] + jx + driftX, gazeY: this.gaze[1] + jy + driftY, turn: this.head[0] };
  }
}

function voiceDiffers(a: VoiceInput | null, b: VoiceInput | null): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  if (a.state !== b.state || Math.abs(a.level - b.level) > VOICE_EPSILON) return true;
  if (!a.mouth || !b.mouth) return a.mouth !== b.mouth;
  return Math.abs(a.mouth.open - b.mouth.open) > VOICE_EPSILON || Math.abs(a.mouth.width - b.mouth.width) > VOICE_EPSILON;
}
