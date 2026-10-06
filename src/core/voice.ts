import type { LevelBands, LevelCallback } from "./audio";
import { smoothLevel } from "./audio";
import type { FaceParams } from "./face";
import { createRng } from "./random";
import type { AgentState, VoiceState } from "./states";

export function isVoiceState(state: unknown): state is VoiceState {
  return state === "listening" || state === "speaking";
}

export interface MouthShape {
  open: number;
  width: number;
}

export const CLOSED_MOUTH: MouthShape = { open: 0, width: 1 };

export const VOICE_MOUTH = {
  gate: 0.035,
  maxOpen: 0.88,
  openCurve: 0.78,
  minWidth: 0.8,
  maxWidth: 1.2,
  tiltWidth: 0.24,
  jawNarrow: 0.07,
  attack: 32,
  release: 74,
  widthEase: 60,
} as const;

const clamp = (n: number, lo: number, hi: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo);

/** Spectral tilt in -1..1: negative for dark, rounded sounds, positive for bright, spread ones. */
export function bandTilt(bands: LevelBands | null | undefined): number {
  if (!bands) return 0;
  const low = clamp(bands.low, 0, 1);
  const mid = clamp(bands.mid, 0, 1);
  const high = clamp(bands.high, 0, 1);
  const total = low + mid + high;
  if (total < 0.02) return 0;
  return clamp((high - low) / total, -1, 1);
}

/** Maps a level (0..1) and optional coarse bands to mouth openness (0..maxOpen) and a width factor. */
export function mouthForLevel(level: number, bands?: LevelBands | null): MouthShape {
  const l = clamp(level, 0, 1);
  if (l < VOICE_MOUTH.gate) return { open: 0, width: clamp(1 + bandTilt(bands) * VOICE_MOUTH.tiltWidth * 0.3, VOICE_MOUTH.minWidth, VOICE_MOUTH.maxWidth) };
  const open = VOICE_MOUTH.maxOpen * ((l - VOICE_MOUTH.gate) / (1 - VOICE_MOUTH.gate)) ** VOICE_MOUTH.openCurve;
  const width = 1 + bandTilt(bands) * VOICE_MOUTH.tiltWidth - open * VOICE_MOUTH.jawNarrow;
  return { open: clamp(open, 0, VOICE_MOUTH.maxOpen), width: clamp(width, VOICE_MOUTH.minWidth, VOICE_MOUTH.maxWidth) };
}

export interface MouthModelOptions {
  attack?: number;
  release?: number;
}

/** Smooths mouth shapes with a fast opening and a slightly slower closing. */
export class MouthModel {
  private shape: MouthShape = { ...CLOSED_MOUTH };
  private attack: number;
  private release: number;

  constructor(options: MouthModelOptions = {}) {
    this.attack = options.attack ?? VOICE_MOUTH.attack;
    this.release = options.release ?? VOICE_MOUTH.release;
  }

  get current(): MouthShape {
    return this.shape;
  }

  update(level: number, bands: LevelBands | null | undefined, dt: number): MouthShape {
    const target = mouthForLevel(level, bands);
    this.shape = {
      open: clamp(smoothLevel(this.shape.open, target.open, dt, this.attack, this.release), 0, VOICE_MOUTH.maxOpen),
      width: clamp(smoothLevel(this.shape.width, target.width, dt, VOICE_MOUTH.widthEase, VOICE_MOUTH.widthEase), VOICE_MOUTH.minWidth, VOICE_MOUTH.maxWidth),
    };
    return this.shape;
  }

  reset(): void {
    this.shape = { ...CLOSED_MOUTH };
  }
}

export const LISTEN_FACE = { lidLift: 0.12, pupilGrow: 0.06 } as const;
export const SPEAK_FACE = { baseWidth: 15, cheek: 0.06, curveKeep: 0.45 } as const;

/** Applies live voice input to face parameters: an audio-driven mouth when speaking, attentive eyes when listening. */
export function applyVoice(face: FaceParams, state: AgentState, level: number, mouth: MouthShape | null): FaceParams {
  const l = clamp(level, 0, 1);
  if (state === "listening") {
    const eye = (e: FaceParams["left"]) => ({ ...e, lidTop: clamp(e.lidTop - l * LISTEN_FACE.lidLift, 0, 1), pupil: clamp(e.pupil + l * LISTEN_FACE.pupilGrow, 0.2, 0.9) });
    return { ...face, left: eye(face.left), right: eye(face.right) };
  }
  if (state !== "speaking" || !mouth) return face;
  const open = clamp(mouth.open, 0, 1);
  const base = Math.max(face.mouth.width, SPEAK_FACE.baseWidth);
  const cheek = (e: FaceParams["left"]) => ({ ...e, lidBottom: clamp(e.lidBottom + l * SPEAK_FACE.cheek, 0, 1 - e.lidTop) });
  return {
    ...face,
    left: cheek(face.left),
    right: cheek(face.right),
    mouth: {
      ...face.mouth,
      open,
      width: clamp(base * clamp(mouth.width, 0.5, 1.5), 4, 32),
      curve: face.mouth.curve * (1 - open * (1 - SPEAK_FACE.curveKeep)),
      lift: face.mouth.lift * (1 - open),
      show: 1,
    },
  };
}

export interface SyntheticVoiceOptions {
  /** Syllables per second. Defaults to 4.6. */
  rate?: number;
  /** Loudness of the loudest syllables (0..1). Defaults to 0.9. */
  loudness?: number;
  /** Seconds of silence between phrases, as [min, max]. Defaults to [0.45, 0.95]. */
  pause?: [number, number];
}

interface Syllable {
  start: number;
  end: number;
  peak: number;
  tilt: number;
}

const VOWEL_TILTS = [-0.7, -0.35, 0, 0.3, 0.65] as const;

/** A seeded, time-driven speech-like level with coarse bands. Useful for demos, tests and speaking without audio. */
export function createSyntheticVoice(seed = "voice", options: SyntheticVoiceOptions = {}): LevelCallback {
  const rng = createRng(`voice:${seed}`);
  const rate = options.rate ?? 4.6;
  const loudness = clamp(options.loudness ?? 0.9, 0, 1);
  const [pauseMin, pauseMax] = options.pause ?? [0.45, 0.95];
  const beat = 1000 / rate;
  const queue: Syllable[] = [];
  let origin = Number.NaN;
  let cursor = 0;
  let left = 0;
  const plan = () => {
    if (left <= 0) {
      if (queue.length > 0 || cursor > 0) cursor += rng.range(pauseMin, pauseMax) * 1000;
      left = Math.round(rng.range(4, 12));
    }
    const length = beat * rng.range(0.7, 1.35);
    const gap = rng.chance(0.22) ? beat * rng.range(0.25, 0.6) : beat * rng.range(0.04, 0.12);
    queue.push({ start: cursor, end: cursor + length, peak: loudness * rng.range(0.5, 1), tilt: rng.pick(VOWEL_TILTS) });
    cursor += length + gap;
    left--;
  };
  return (now) => {
    if (Number.isNaN(origin)) origin = now;
    const t = now - origin;
    while (cursor <= t + beat * 2) plan();
    while (queue.length > 0 && queue[0].end < t) queue.shift();
    const current = queue[0];
    if (!current || t < current.start) return { level: 0, bands: { low: 0, mid: 0, high: 0 } };
    const p = (t - current.start) / (current.end - current.start);
    const envelope = p < 0.22 ? Math.sin((p / 0.22) * (Math.PI / 2)) : Math.cos(((p - 0.22) / 0.78) * (Math.PI / 2)) ** 1.4;
    const level = current.peak * envelope;
    const tilt = current.tilt;
    return { level, bands: { low: level * (0.6 - tilt * 0.4), mid: level * 0.55, high: level * (0.6 + tilt * 0.4) } };
  };
}
