import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { createAudioLevel, createLevelFeed, pathNumbers } from "agentfaces";
import { AgentFace, useAudioLevel, webTicker } from "./index";

let frames: Array<FrameRequestCallback> = [];

function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({ matches: query.includes("reduce") ? matches : false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), onchange: null, dispatchEvent: vi.fn() })),
  });
}

beforeEach(() => {
  frames = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  stubReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const flush = (now: number) => {
  const pending = frames.splice(0, frames.length);
  act(() => {
    for (const cb of pending) cb(now);
  });
};

const run = (from: number, to: number) => {
  for (let t = from; t < to; t += 16) flush(t);
};

const mouthOf = (container: HTMLElement) => container.querySelector("[data-af-part='mouth']")!.getAttribute("d");

const mouthHeight = (container: HTMLElement) => {
  const ys = pathNumbers(mouthOf(container) ?? "").filter((_, i) => i % 2 === 1);
  return Number((Math.max(...ys) - Math.min(...ys)).toFixed(2));
};

describe("AgentFace voice states", () => {
  it("labels listening and speaking", () => {
    render(
      <>
        <AgentFace state="listening" name="Ada" variant="still" />
        <AgentFace state="speaking" name="Bo" variant="still" />
      </>,
    );
    expect(screen.getByRole("img", { name: "Ada, Listening" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Bo, Speaking" })).toBeTruthy();
  });

  it("opens the mouth with the output level while speaking", () => {
    let level = 0;
    const { container } = render(<AgentFace seed="talk" shape="circle" state="speaking" audio={() => level} />);
    run(0, 4000);
    const closed = mouthHeight(container);
    level = 1;
    run(4000, 4400);
    const open = mouthHeight(container);
    expect(open).toBeGreaterThan(closed + 4);
    level = 0;
    run(4400, 5000);
    expect(mouthHeight(container)).toBeCloseTo(closed, 0);
  });

  it("keeps a callback level across re-renders that pass a new function", () => {
    const first = vi.fn(() => 0.5);
    const second = vi.fn(() => 0.5);
    const { rerender } = render(<AgentFace seed="r" state="speaking" audio={first} />);
    run(0, 200);
    rerender(<AgentFace seed="r" state="speaking" audio={second} />);
    run(200, 400);
    expect(first).toHaveBeenCalled();
    expect(second).toHaveBeenCalled();
    expect(second.mock.calls.length).toBeGreaterThan(5);
  });

  it("reads a shared level once per frame for many faces on one ticker", () => {
    const callback = vi.fn(() => 0.4);
    const shared = createAudioLevel(callback);
    const { unmount } = render(
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <AgentFace key={i} seed={`s${i}`} state={i % 2 ? "speaking" : "listening"} audio={shared} />
        ))}
      </>,
    );
    expect(webTicker.size).toBe(6);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    run(0, 160);
    expect(callback).toHaveBeenCalledTimes(10);
    unmount();
    expect(shared.closed).toBe(false);
    expect(webTicker.size).toBe(0);
  });

  it("falls back to a synthetic voice when speaking without audio and holds still with audio null", () => {
    const synthetic = render(<AgentFace seed="syn" shape="square" state="speaking" />);
    run(0, 1500);
    const seen = new Set<number>();
    for (let t = 1500; t < 4000; t += 16) {
      flush(t);
      seen.add(mouthHeight(synthetic.container));
    }
    expect(seen.size).toBeGreaterThan(10);
    synthetic.unmount();
    const silent = render(<AgentFace seed="syn" shape="square" state="speaking" audio={null} expression="chatty" />);
    run(0, 3000);
    const heights = new Set<number>();
    for (let t = 3000; t < 4000; t += 16) {
      flush(t);
      heights.add(mouthHeight(silent.container));
    }
    expect(heights.size).toBe(1);
  });

  it("runs no timers, ticker or audio for still faces", () => {
    const AudioContext = vi.fn();
    vi.stubGlobal("AudioContext", AudioContext);
    const callback = vi.fn(() => 1);
    const feed = createLevelFeed();
    const subscribe = vi.spyOn(feed, "subscribe");
    render(
      <>
        <AgentFace state="speaking" variant="still" audio={callback} />
        <AgentFace state="listening" variant="still" audio={feed} />
        <AgentFace state="speaking" variant="still" />
      </>,
    );
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(webTicker.size).toBe(0);
    expect(callback).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
    expect(AudioContext).not.toHaveBeenCalled();
  });

  it("shows a static face with no audio-driven motion under reduced motion", () => {
    stubReducedMotion(true);
    const callback = vi.fn(() => 1);
    const { container } = render(<AgentFace seed="rm" state="speaking" audio={callback} />);
    const before = mouthOf(container);
    flush(0);
    expect(webTicker.size).toBe(0);
    expect(callback).not.toHaveBeenCalled();
    expect(mouthOf(container)).toBe(before);
    expect(container.querySelector("[data-af-variant='still']")).toBeTruthy();
    cleanup();
    stubReducedMotion(false);
    const forced = render(<AgentFace seed="rm" state="listening" audio={callback} reducedMotion />);
    expect(webTicker.size).toBe(0);
    expect(forced.container.querySelector("[data-af-variant='still']")).toBeTruthy();
    expect(callback).not.toHaveBeenCalled();
  });

  it("pulses the body with the input level while listening", () => {
    let level = 0;
    const { container } = render(<AgentFace seed="pulse" shape="circle" state="listening" audio={() => level} />);
    run(0, 2000);
    const body = container.querySelector("[data-af-part='body']")!;
    const scale = () => Number(/scale\(([-\d.]+)/.exec(body.getAttribute("transform") ?? "")?.[1]);
    const quiet = scale();
    level = 1;
    run(2000, 2600);
    expect(scale()).toBeGreaterThan(quiet);
  });
});

describe("useAudioLevel", () => {
  it("creates one level per source, keeps it across callback changes and closes it on unmount", () => {
    const { result, rerender, unmount } = renderHook(({ cb }) => useAudioLevel(cb), { initialProps: { cb: (() => 0.3) as () => number } });
    const level = result.current!;
    expect(level).not.toBeNull();
    level.update(0);
    rerender({ cb: () => 0.9 });
    expect(result.current).toBe(level);
    for (let t = 16; t < 500; t += 16) level.update(t);
    expect(level.value).toBeGreaterThan(0.85);
    unmount();
    expect(level.closed).toBe(true);
  });

  it("returns null without a source and passes an existing level through without closing it", () => {
    const { result } = renderHook(() => useAudioLevel(null));
    expect(result.current).toBeNull();
    const existing = createAudioLevel(() => 0);
    const passed = renderHook(() => useAudioLevel(existing));
    expect(passed.result.current).toBe(existing);
    passed.unmount();
    expect(existing.closed).toBe(false);
  });
});
