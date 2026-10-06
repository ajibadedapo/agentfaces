import { afterEach, describe, expect, it, vi } from "vitest";
import { bandsFromSpectrum, createAudioLevel, createLevelFeed, isAudioLevel, levelFromRms, LEVEL_SMOOTHING, pcm16Level, smoothLevel, STALE_STREAM_MS } from "./audio";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("smoothLevel", () => {
  it("rises faster than it falls", () => {
    const up = smoothLevel(0, 1, 16);
    const down = 1 - smoothLevel(1, 0, 16);
    expect(up).toBeGreaterThan(down);
    expect(up).toBeGreaterThan(0.4);
    expect(down).toBeLessThan(0.2);
  });

  it("does not move with no elapsed time and converges over time", () => {
    expect(smoothLevel(0.3, 1, 0)).toBe(0.3);
    let v = 0;
    for (let i = 0; i < 60; i++) v = smoothLevel(v, 0.8, 16);
    expect(v).toBeCloseTo(0.8, 3);
    for (let i = 0; i < 120; i++) v = smoothLevel(v, 0, 16);
    expect(v).toBeLessThan(0.001);
  });

  it("follows the time constants it is given", () => {
    expect(smoothLevel(0, 1, LEVEL_SMOOTHING.attack)).toBeCloseTo(1 - Math.exp(-1), 5);
    expect(smoothLevel(1, 0, LEVEL_SMOOTHING.release)).toBeCloseTo(Math.exp(-1), 5);
    expect(smoothLevel(0, 1, 16, 0, 0)).toBe(1);
  });
});

describe("level mapping", () => {
  it("maps RMS on a decibel scale and clamps to 0..1", () => {
    expect(levelFromRms(0)).toBe(0);
    expect(levelFromRms(-1)).toBe(0);
    expect(levelFromRms(Number.NaN)).toBe(0);
    expect(levelFromRms(1)).toBe(1);
    expect(levelFromRms(10 ** (-37 / 20))).toBeCloseTo(0.5, 2);
    expect(levelFromRms(0.001)).toBe(0);
  });

  it("reads 16-bit PCM chunks", () => {
    expect(pcm16Level(new Int16Array(0))).toBe(0);
    expect(pcm16Level(new Int16Array(480))).toBe(0);
    const loud = new Int16Array(480).map((_, i) => Math.round(Math.sin(i / 4) * 16000));
    expect(pcm16Level(loud)).toBeGreaterThan(0.8);
    expect(pcm16Level(loud.buffer)).toBeCloseTo(pcm16Level(loud), 6);
  });

  it("splits a spectrum into coarse low, mid and high bands", () => {
    const bins = new Uint8Array(512);
    const hzPerBin = 24000 / 512;
    for (let i = 0; i < bins.length; i++) if (i * hzPerBin > 2000 && i * hzPerBin < 6000) bins[i] = 255;
    const bright = bandsFromSpectrum(bins, 255, 0, 24000);
    expect(bright.high).toBeGreaterThan(0.9);
    expect(bright.low).toBe(0);
    expect(bandsFromSpectrum(new Uint8Array(0), 255, 0, 24000)).toEqual({ low: 0, mid: 0, high: 0 });
    for (const value of Object.values(bandsFromSpectrum(new Uint8Array(64).fill(255), 100, 0, 8000))) expect(value).toBeLessThanOrEqual(1);
  });
});

describe("createAudioLevel", () => {
  it("smooths a level callback and reads it once per frame time", () => {
    const callback = vi.fn(() => 1);
    const level = createAudioLevel(callback);
    expect(isAudioLevel(level)).toBe(true);
    expect(level.value).toBe(0);
    level.update(0);
    const first = level.value;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
    level.update(0);
    expect(callback).toHaveBeenCalledTimes(1);
    for (let t = 16; t < 400; t += 16) level.update(t);
    expect(level.value).toBeGreaterThan(0.99);
    expect(createAudioLevel(level)).toBe(level);
  });

  it("clamps gain, ignores bad values and keeps bands in range", () => {
    const values = [5, Number.NaN, -3, { level: 0.5, bands: { low: 4, mid: -1, high: Number.NaN } }];
    let i = 0;
    const level = createAudioLevel(() => values[i++ % values.length], { gain: 3 });
    for (let t = 0; t < 800; t += 16) {
      const v = level.update(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      for (const b of Object.values(level.bands ?? {})) {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(1);
      }
    }
    expect(level.bands).not.toBeNull();
  });

  it("schedules no timers or frames of its own", () => {
    vi.useFakeTimers();
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    const feed = createLevelFeed();
    const levels = [createAudioLevel(() => 0.5), createAudioLevel(feed)];
    feed.push(0.7);
    for (const level of levels) level.update(100);
    expect(vi.getTimerCount()).toBe(0);
    expect(raf).not.toHaveBeenCalled();
  });

  it("follows a pushed numeric stream and falls silent when it goes stale", () => {
    const feed = createLevelFeed();
    const level = createAudioLevel(feed, { attack: 0, release: 0 });
    feed.push(0.6);
    expect(level.update(0)).toBeCloseTo(0.6);
    expect(level.update(STALE_STREAM_MS - 10)).toBeCloseTo(0.6);
    expect(level.update(STALE_STREAM_MS + 20)).toBe(0);
    feed.push({ level: 0.4 });
    expect(level.update(STALE_STREAM_MS + 40)).toBeCloseTo(0.4);
  });

  it("stops reading and unsubscribes when closed", () => {
    const callback = vi.fn(() => 1);
    const level = createAudioLevel(callback);
    level.update(0);
    level.close();
    level.update(16);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(level.value).toBe(0);
    expect(level.closed).toBe(true);
    const feed = createLevelFeed();
    const off = vi.fn();
    const subscribe = vi.spyOn(feed, "subscribe").mockReturnValue(off);
    createAudioLevel(feed).close();
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(off).toHaveBeenCalledTimes(1);
  });

  it("rejects sources it cannot read", () => {
    expect(() => createAudioLevel({} as never)).toThrow(TypeError);
  });
});

class FakeAnalyser {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  amplitude = 0;
  get frequencyBinCount() {
    return this.fftSize / 2;
  }
  getFloatTimeDomainData(out: Float32Array) {
    for (let i = 0; i < out.length; i++) out[i] = Math.sin(i / 3) * this.amplitude;
  }
  getByteFrequencyData(out: Uint8Array) {
    out.fill(Math.round(this.amplitude * 255));
  }
}

class FakeNode {
  connected = new Set<unknown>();
  constructor(readonly context: FakeContext) {}
  connect(target: unknown) {
    this.connected.add(target);
  }
  disconnect(target?: unknown) {
    if (target === undefined) this.connected.clear();
    else this.connected.delete(target);
  }
}

class FakeContext {
  sampleRate = 48000;
  state = "running";
  destination = {};
  analysers: FakeAnalyser[] = [];
  streamSources: FakeNode[] = [];
  createAnalyser() {
    const analyser = new FakeAnalyser();
    this.analysers.push(analyser);
    return analyser;
  }
  createMediaStreamSource() {
    const node = new FakeNode(this);
    this.streamSources.push(node);
    return node;
  }
}

class FakeStream {}

describe("Web Audio sources", () => {
  it("measures an AudioNode on its own context and disconnects only its analyser", () => {
    vi.stubGlobal("AudioNode", FakeNode);
    const context = new FakeContext();
    const node = new FakeNode(context);
    const other = {};
    node.connect(other);
    const level = createAudioLevel(node as unknown as AudioNode, { attack: 0, release: 0 });
    const analyser = context.analysers[0];
    expect(analyser.fftSize).toBe(1024);
    expect(node.connected.has(analyser)).toBe(true);
    expect(level.update(0)).toBe(0);
    analyser.amplitude = 0.1;
    expect(level.update(16)).toBeGreaterThan(0.75);
    expect(level.bands?.mid).toBeGreaterThan(0);
    level.close();
    expect(node.connected.has(analyser)).toBe(false);
    expect(node.connected.has(other)).toBe(true);
  });

  it("measures a MediaStream on a given context without touching the speakers", () => {
    vi.stubGlobal("MediaStream", FakeStream);
    const context = new FakeContext();
    const level = createAudioLevel(new FakeStream() as unknown as MediaStream, { context: context as unknown as AudioContext, attack: 0, release: 0, bands: false });
    const source = context.streamSources[0];
    expect(source.connected.has(context.destination)).toBe(false);
    context.analysers[0].amplitude = 0.5;
    expect(level.update(0)).toBe(1);
    expect(level.bands).toBeNull();
    level.close();
    expect(source.connected.size).toBe(0);
  });

  it("follows a media element's srcObject as a WebRTC transport attaches it later", () => {
    vi.stubGlobal("MediaStream", FakeStream);
    const context = new FakeContext();
    const element = document.createElement("audio");
    Object.defineProperty(element, "srcObject", { value: null, writable: true });
    const level = createAudioLevel(element, { context: context as unknown as AudioContext, attack: 0, release: 0 });
    expect(level.update(0)).toBe(0);
    expect(context.analysers).toHaveLength(0);
    element.srcObject = new FakeStream() as unknown as MediaStream;
    level.update(16);
    expect(context.streamSources).toHaveLength(1);
    context.analysers[0].amplitude = 0.2;
    expect(level.update(32)).toBeGreaterThan(0.8);
    element.srcObject = new FakeStream() as unknown as MediaStream;
    level.update(48);
    expect(context.streamSources[0].connected.size).toBe(0);
    expect(context.streamSources).toHaveLength(2);
    level.close();
    expect(context.streamSources[1].connected.size).toBe(0);
  });

  it("reads silence when there is no Web Audio at all", () => {
    vi.stubGlobal("MediaStream", FakeStream);
    vi.stubGlobal("AudioContext", undefined);
    const level = createAudioLevel(new FakeStream() as unknown as MediaStream);
    expect(level.update(0)).toBe(0);
  });
});
