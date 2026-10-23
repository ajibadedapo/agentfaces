import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { morphKeyframes, SHAPE_PATHS } from "agentfaces";

const fake = vi.hoisted(() => {
  type Done = (result: { finished: boolean }) => void;
  interface Anim {
    kind: string;
    start(done?: Done): void;
    stop(): void;
  }
  interface Leaf extends Anim {
    complete(): void;
  }
  const active = new Set<Leaf>();
  const loops = new Set<Anim>();
  const started: string[] = [];

  class Node {
    constructor(readonly read: () => unknown) {}
    interpolate(config: { inputRange: number[]; outputRange: Array<number | string> }) {
      return new Node(() => {
        const x = Number(this.read());
        const { inputRange: input, outputRange: output } = config;
        if (typeof output[0] === "string") {
          let best = 0;
          for (let i = 1; i < input.length; i++) if (Math.abs(input[i] - x) < Math.abs(input[best] - x)) best = i;
          return output[best];
        }
        if (x <= input[0]) return output[0];
        for (let i = 1; i < input.length; i++) {
          if (x <= input[i]) {
            const t = (x - input[i - 1]) / (input[i] - input[i - 1]);
            return Number(output[i - 1]) + t * (Number(output[i]) - Number(output[i - 1]));
          }
        }
        return output[output.length - 1];
      });
    }
  }

  class Value extends Node {
    current: number;
    constructor(value: number) {
      super(() => this.current);
      this.current = value;
    }
    setValue(value: number) {
      this.current = value;
    }
    stopAnimation(callback?: (value: number) => void) {
      callback?.(this.current);
    }
  }

  const leaf = (kind: string, finish: () => void): Leaf => {
    let done: Done | undefined;
    const self: Leaf = {
      kind,
      start(callback) {
        done = callback;
        started.push(kind);
        active.add(self);
      },
      stop() {
        if (!active.delete(self)) return;
        done?.({ finished: false });
      },
      complete() {
        if (!active.delete(self)) return;
        finish();
        done?.({ finished: true });
      },
    };
    return self;
  };

  const to = (kind: string) => (value: Value, config: { toValue: number }) => leaf(kind, () => value.setValue(config.toValue));

  const sequence = (list: Anim[]): Anim => {
    let index = -1;
    let stopped = false;
    return {
      kind: "sequence",
      start(done) {
        stopped = false;
        const next = (result: { finished: boolean }) => {
          if (stopped) return;
          if (!result.finished) return done?.(result);
          index += 1;
          if (index >= list.length) return done?.({ finished: true });
          list[index].start(next);
        };
        next({ finished: true });
      },
      stop() {
        stopped = true;
        list[index]?.stop();
      },
    };
  };

  const parallel = (list: Anim[]): Anim => ({
    kind: "parallel",
    start(done) {
      let left = list.length;
      if (!left) return done?.({ finished: true });
      for (const item of list)
        item.start((result) => {
          left -= 1;
          if (left === 0) done?.(result);
        });
    },
    stop() {
      for (const item of list) item.stop();
    },
  });

  const loop = (inner: Anim): Anim => {
    const self: Anim = {
      kind: "loop",
      start() {
        started.push("loop");
        loops.add(self);
      },
      stop() {
        loops.delete(self);
        inner.stop();
      },
    };
    return self;
  };

  const resolve = (value: unknown): unknown => {
    if (value instanceof Node) return value.read();
    if (Array.isArray(value)) return value.map(resolve);
    if (value && typeof value === "object" && !("$$typeof" in value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]));
    return value;
  };

  const step = () => {
    for (const item of [...active]) item.complete();
  };

  return { Node, Value, leaf, to, sequence, parallel, loop, resolve, active, loops, started, step };
});

vi.mock("react-native", async () => {
  const React = await import("react");
  const host = (tag: string) => {
    const Host = ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
      const attributes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(fake.resolve(props) as Record<string, unknown>)) attributes[key === "style" ? "rnstyle" : key.toLowerCase()] = typeof value === "object" ? JSON.stringify(value) : value;
      return React.createElement(tag, attributes, children);
    };
    return Host;
  };
  const identity = (f: (t: number) => number = (t) => t) => f;
  return {
    View: host("rn-view"),
    AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(false), addEventListener: () => ({ remove() {} }) },
    Easing: { inOut: identity, in: identity, out: identity, sin: (t: number) => t, quad: (t: number) => t, cubic: (t: number) => t, ease: (t: number) => t, linear: (t: number) => t },
    Animated: {
      Value: fake.Value,
      View: host("rn-animated-view"),
      createAnimatedComponent: (Component: (props: Record<string, unknown>) => ReactNode) => (props: Record<string, unknown>) => React.createElement(Component, fake.resolve(props) as Record<string, unknown>),
      spring: fake.to("spring"),
      timing: fake.to("timing"),
      delay: () => fake.leaf("delay", () => undefined),
      sequence: fake.sequence,
      parallel: fake.parallel,
      loop: fake.loop,
      add: (a: unknown, b: unknown) => new fake.Node(() => Number(fake.resolve(a)) + Number(fake.resolve(b))),
      multiply: (a: unknown, b: unknown) => new fake.Node(() => Number(fake.resolve(a)) * Number(fake.resolve(b))),
    },
  };
});

vi.mock("react-native-svg", async () => {
  const React = await import("react");
  const svg = (tag: string) => {
    const Svg = ({ children, ...props }: { children?: ReactNode } & Record<string, unknown>) => {
      const attributes: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(props)) attributes[key === "style" ? "rnstyle" : key.toLowerCase()] = typeof value === "object" ? JSON.stringify(value) : value;
      return React.createElement(tag, attributes, children);
    };
    return Svg;
  };
  return { default: svg("rn-svg"), G: svg("rn-g"), Path: svg("rn-path"), Circle: svg("rn-circle"), Ellipse: svg("rn-ellipse"), Defs: svg("rn-defs"), ClipPath: svg("rn-clippath") };
});

const { AgentFace } = await import("./AgentFace");
const { nativeTicker } = await import("./ticker");

const numbers = (d: string | null) => (d?.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

function face(props: Record<string, unknown>) {
  return createElement(AgentFace, { seed: "pause", shape: "circle", color: "#3366FF", size: 96, name: "Ada", ...props });
}

async function mount(props: Record<string, unknown>) {
  let current = props;
  const view = render(face(current));
  await act(async () => {});
  return {
    ...view,
    update: (next: Record<string, unknown>) => {
      current = { ...current, ...next };
      act(() => view.rerender(face(current)));
    },
  };
}

const bodyPath = (container: HTMLElement) => container.querySelector("rn-path")?.getAttribute("d") ?? null;

beforeEach(() => {
  vi.useFakeTimers({ now: new Date("2026-10-23T12:00:00.123Z") });
  fake.active.clear();
  fake.loops.clear();
  fake.started.length = 0;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AgentFace on React Native, paused", () => {
  it("leaves the ticker while paused and joins it again on resume", async () => {
    const view = await mount({ state: "needs-you" });
    expect(nativeTicker.size).toBe(1);
    view.update({ paused: true });
    expect(nativeTicker.size).toBe(0);
    view.update({ paused: false });
    expect(nativeTicker.size).toBe(1);
  });

  it("keeps the same rendered face across pause and resume", async () => {
    const view = await mount({ state: "running" });
    const before = view.container.querySelector("[testid='agentface-live']");
    expect(before).not.toBeNull();
    view.update({ paused: true });
    expect(view.container.querySelector("[testid='agentface-live']")).toBe(before);
    view.update({ paused: false });
    expect(view.container.querySelector("[testid='agentface-live']")).toBe(before);
  });

  it("stops every loop on a running face but keeps its spinner and shrunk body", async () => {
    const view = await mount({ state: "running" });
    expect(fake.loops.size).toBeGreaterThan(0);
    view.update({ paused: true });
    act(() => fake.step());
    expect(fake.loops.size).toBe(0);
    expect(view.container.querySelector("rn-circle[strokedasharray='72 217']")).not.toBeNull();
    expect(view.container.querySelector("rn-g[scale='0.8']")).not.toBeNull();
  });

  it("shows the alert bang while paused and holds it when it resumes", async () => {
    const view = await mount({ state: "alert" });
    view.update({ paused: true });
    act(() => fake.step());
    view.update({});
    const bang = morphKeyframes("circle", "bang").paths;
    expect(numbers(bodyPath(view.container))).toEqual(numbers(bang[bang.length - 1]));
    expect(numbers(bodyPath(view.container))).not.toEqual(numbers(SHAPE_PATHS.circle));
    expect([...fake.active].map((item) => item.kind)).toEqual([]);
    view.update({ paused: false });
    act(() => fake.step());
    view.update({});
    expect(numbers(bodyPath(view.container))).toEqual(numbers(bang[bang.length - 1]));
  });

  it("resumes confetti where it stopped instead of replaying the burst delay", async () => {
    const view = await mount({ state: "celebrate" });
    expect(fake.started).toContain("delay");
    view.update({ paused: true });
    expect(fake.loops.size).toBe(0);
    fake.started.length = 0;
    view.update({ paused: false });
    expect(fake.started).not.toContain("delay");
    expect(fake.started).toContain("timing");
  });

  it("does not replay a one-shot hop on resume", async () => {
    const view = await mount({ state: "done" });
    for (let i = 0; i < 8; i++) act(() => fake.step());
    view.update({ paused: true });
    act(() => fake.step());
    fake.started.length = 0;
    view.update({ paused: false });
    expect(fake.started.filter((kind) => kind === "spring")).toHaveLength(0);
  });
});
