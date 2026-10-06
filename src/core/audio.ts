export interface LevelBands {
  low: number;
  mid: number;
  high: number;
}

export interface LevelFrame {
  level: number;
  bands?: LevelBands;
}

/** Returns the current level (0..1), or a level with coarse bands. Called once per frame with the ticker time. */
export type LevelCallback = (now: number) => number | LevelFrame;

/** Anything that pushes levels (0..1) to listeners, for example a native audio meter. */
export interface LevelStream {
  subscribe(listener: (value: number | LevelFrame) => void): () => void;
}

/** A smoothed audio level. It never schedules work: call update(now) from a ticker and read value and bands. */
export interface AudioLevel {
  readonly value: number;
  readonly bands: LevelBands | null;
  update(now: number): number;
  close(): void;
  readonly closed: boolean;
}

export type AudioLevelSource = MediaStream | AudioNode | HTMLMediaElement | LevelCallback | LevelStream | AudioLevel;

export interface AudioLevelOptions {
  /** Rise time constant in ms. Defaults to 24. */
  attack?: number;
  /** Fall time constant in ms. Defaults to 110. */
  release?: number;
  /** Multiplies the raw level before clamping to 0..1. Defaults to 1. */
  gain?: number;
  /** Signal level in dBFS that maps to 0 for Web Audio sources. Defaults to -58. */
  floorDb?: number;
  /** Signal level in dBFS that maps to 1 for Web Audio sources. Defaults to -16. */
  ceilingDb?: number;
  /** Compute coarse low, mid and high bands for Web Audio sources. Defaults to true. */
  bands?: boolean;
  /** AudioContext for MediaStream and media element sources. A shared context is created when omitted. */
  context?: AudioContext;
}

export const LEVEL_SMOOTHING = { attack: 24, release: 110 } as const;
export const LEVEL_RANGE_DB = { floor: -58, ceiling: -16 } as const;
export const BAND_EDGES_HZ = { low: [90, 650], mid: [650, 1900], high: [1900, 6200] } as const;
export const STALE_STREAM_MS = 260;
const FFT_SIZE = 1024;
const MAX_DT = 100;
const FIRST_DT = 16;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** One-pole attack and release envelope step. Time constants in ms. */
export function smoothLevel(current: number, target: number, dt: number, attack: number = LEVEL_SMOOTHING.attack, release: number = LEVEL_SMOOTHING.release): number {
  const tau = target > current ? attack : release;
  if (tau <= 0) return target;
  const share = 1 - Math.exp(-Math.max(0, dt) / tau);
  return current + (target - current) * share;
}

/** Maps an RMS amplitude (0..1) to a 0..1 level on a decibel scale. */
export function levelFromRms(rms: number, floorDb: number = LEVEL_RANGE_DB.floor, ceilingDb: number = LEVEL_RANGE_DB.ceiling): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return clamp01((db - floorDb) / (ceilingDb - floorDb));
}

/** Level of a chunk of 16-bit PCM audio, for example a Realtime API audio delta. */
export function pcm16Level(data: ArrayBuffer | Int16Array, floorDb?: number, ceilingDb?: number): number {
  const samples = data instanceof Int16Array ? data : new Int16Array(data, 0, Math.floor(data.byteLength / 2));
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] / 32768;
    sum += s * s;
  }
  return levelFromRms(Math.sqrt(sum / samples.length), floorDb, ceilingDb);
}

/** Averages linear frequency bins spanning fromHz..toHz into coarse low, mid and high bands (0..1). */
export function bandsFromSpectrum(bins: ArrayLike<number>, maxValue: number, fromHz: number, toHz: number): LevelBands {
  const count = bins.length;
  const span = toHz - fromHz;
  const band = ([lo, hi]: readonly [number, number]) => {
    if (count === 0 || span <= 0) return 0;
    const start = Math.max(0, Math.floor(((lo - fromHz) / span) * count));
    const end = Math.min(count, Math.max(start + 1, Math.ceil(((hi - fromHz) / span) * count)));
    if (start >= count) return 0;
    let sum = 0;
    for (let i = start; i < end; i++) sum += bins[i];
    return clamp01(sum / (end - start) / maxValue);
  };
  return { low: band(BAND_EDGES_HZ.low), mid: band(BAND_EDGES_HZ.mid), high: band(BAND_EDGES_HZ.high) };
}

const LEVEL_BRAND = Symbol.for("agentfaces.audioLevel");

export function isAudioLevel(value: unknown): value is AudioLevel {
  return typeof value === "object" && value !== null && (value as Record<symbol, unknown>)[LEVEL_BRAND] === true;
}

function isLevelStream(value: unknown): value is LevelStream {
  return typeof value === "object" && value !== null && typeof (value as LevelStream).subscribe === "function";
}

function readFrame(value: number | LevelFrame): LevelFrame {
  return typeof value === "number" ? { level: value } : value;
}

export interface LevelFeed extends LevelStream {
  push(value: number | LevelFrame): void;
}

/** A numeric stream you push levels into, for platforms without Web Audio such as React Native. */
export function createLevelFeed(): LevelFeed {
  const listeners = new Set<(value: number | LevelFrame) => void>();
  return {
    push(value) {
      for (const listener of Array.from(listeners)) listener(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface Reader {
  read(now: number): LevelFrame;
  close(): void;
}

function callbackReader(callback: LevelCallback): Reader {
  return { read: (now) => readFrame(callback(now)), close() {} };
}

function streamReader(stream: LevelStream): Reader {
  let latest: LevelFrame = { level: 0 };
  let at = -1;
  let pushed = false;
  const off = stream.subscribe((value) => {
    latest = readFrame(value);
    pushed = true;
  });
  return {
    read(now) {
      if (pushed) {
        pushed = false;
        at = now;
      }
      if (at < 0 || now - at > STALE_STREAM_MS) return { level: 0 };
      return latest;
    },
    close: off,
  };
}

type ContextConstructor = new () => AudioContext;
let sharedContext: AudioContext | null = null;
const elementSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();

function audioContextConstructor(): ContextConstructor | null {
  if (typeof globalThis === "undefined") return null;
  const scope = globalThis as unknown as { AudioContext?: ContextConstructor; webkitAudioContext?: ContextConstructor };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

function resumeWhenAllowed(context: AudioContext): void {
  if (context.state !== "suspended") return;
  void context.resume?.().catch(() => {});
  if (typeof document === "undefined") return;
  const wake = () => {
    void context.resume?.().catch(() => {});
    document.removeEventListener("pointerdown", wake);
    document.removeEventListener("keydown", wake);
  };
  document.addEventListener("pointerdown", wake, { once: true });
  document.addEventListener("keydown", wake, { once: true });
}

/** The AudioContext shared by every level that was not given its own. Created on first use. */
export function sharedAudioContext(): AudioContext | null {
  if (sharedContext && sharedContext.state !== "closed") return sharedContext;
  const Context = audioContextConstructor();
  if (!Context) return null;
  sharedContext = new Context();
  return sharedContext;
}

function isMediaElement(value: unknown): value is HTMLMediaElement {
  return typeof HTMLMediaElement !== "undefined" && value instanceof HTMLMediaElement;
}

function isMediaStream(value: unknown): value is MediaStream {
  return typeof MediaStream !== "undefined" && value instanceof MediaStream;
}

function isAudioNode(value: unknown): value is AudioNode {
  return typeof AudioNode !== "undefined" && value instanceof AudioNode;
}

function analyserReader(source: MediaStream | AudioNode | HTMLMediaElement, options: AudioLevelOptions): Reader | null {
  let context: AudioContext | BaseAudioContext;
  let input: AudioNode;
  let release: () => void = () => {};
  if (isAudioNode(source)) {
    context = source.context;
    input = source;
  } else {
    const shared = options.context ?? sharedAudioContext();
    if (!shared) return null;
    context = shared;
    resumeWhenAllowed(shared);
    if (isMediaStream(source)) {
      const node = shared.createMediaStreamSource(source);
      input = node;
      release = () => node.disconnect();
    } else {
      let node = elementSources.get(source);
      if (!node) {
        node = shared.createMediaElementSource(source);
        node.connect(shared.destination);
        elementSources.set(source, node);
      }
      input = node;
    }
  }
  const analyser = context.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0.35;
  input.connect(analyser);
  const wave = new Float32Array(analyser.fftSize);
  const spectrum = options.bands === false ? null : new Uint8Array(analyser.frequencyBinCount);
  const nyquist = context.sampleRate / 2;
  return {
    read() {
      analyser.getFloatTimeDomainData(wave);
      let sum = 0;
      for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
      const level = levelFromRms(Math.sqrt(sum / wave.length), options.floorDb, options.ceilingDb);
      if (!spectrum) return { level };
      analyser.getByteFrequencyData(spectrum);
      return { level, bands: bandsFromSpectrum(spectrum, 255, 0, nyquist) };
    },
    close() {
      try {
        input.disconnect(analyser);
      } catch {
        input.disconnect();
      }
      release();
    },
  };
}

const SILENT: LevelFrame = { level: 0 };

function elementReader(element: HTMLMediaElement, options: AudioLevelOptions): Reader {
  let bound: MediaStream | HTMLMediaElement | null = null;
  let reader: Reader | null = null;
  return {
    read(now) {
      const stream = isMediaStream(element.srcObject) ? element.srcObject : null;
      const target = stream ?? (element.currentSrc || element.src ? element : null);
      if (target !== bound) {
        reader?.close();
        reader = target ? analyserReader(target, options) : null;
        bound = target;
      }
      return reader ? reader.read(now) : SILENT;
    },
    close() {
      reader?.close();
      reader = null;
    },
  };
}

function readerFor(source: Exclude<AudioLevelSource, AudioLevel>, options: AudioLevelOptions): Reader {
  if (typeof source === "function") return callbackReader(source);
  if (isMediaElement(source)) return elementReader(source, options);
  if (isMediaStream(source) || isAudioNode(source)) return analyserReader(source, options) ?? { read: () => SILENT, close() {} };
  if (isLevelStream(source)) return streamReader(source);
  throw new TypeError("agentfaces: createAudioLevel needs a MediaStream, AudioNode, HTMLMediaElement, level callback or level stream");
}

/**
 * Turns a MediaStream, AudioNode, HTMLMediaElement, level callback or level stream into a smoothed level (0..1)
 * with optional coarse bands. Nothing runs until update(now) is called, so one shared ticker can drive every level.
 */
export function createAudioLevel(source: AudioLevelSource, options: AudioLevelOptions = {}): AudioLevel {
  if (isAudioLevel(source)) return source;
  const reader = readerFor(source, options);
  const attack = options.attack ?? LEVEL_SMOOTHING.attack;
  const release = options.release ?? LEVEL_SMOOTHING.release;
  const gain = options.gain ?? 1;
  let value = 0;
  let bands: LevelBands | null = null;
  let last = Number.NaN;
  let closed = false;
  return {
    [LEVEL_BRAND]: true,
    get value() {
      return value;
    },
    get bands() {
      return bands;
    },
    get closed() {
      return closed;
    },
    update(now) {
      if (closed || now === last) return value;
      const dt = Number.isNaN(last) ? FIRST_DT : Math.min(MAX_DT, Math.max(0, now - last));
      last = now;
      const frame = reader.read(now);
      value = clamp01(smoothLevel(value, clamp01(frame.level * gain), dt, attack, release));
      if (frame.bands) {
        const next = frame.bands;
        const prev = bands ?? { low: 0, mid: 0, high: 0 };
        bands = {
          low: clamp01(smoothLevel(prev.low, clamp01(next.low), dt, attack, release)),
          mid: clamp01(smoothLevel(prev.mid, clamp01(next.mid), dt, attack, release)),
          high: clamp01(smoothLevel(prev.high, clamp01(next.high), dt, attack, release)),
        };
      }
      return value;
    },
    close() {
      if (closed) return;
      closed = true;
      value = 0;
      reader.close();
    },
  } as AudioLevel;
}
