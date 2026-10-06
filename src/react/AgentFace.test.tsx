import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { AgentFace, webTicker } from "./AgentFace";
import { AgentFacesProvider } from "../shared/theme";
import { AGENT_STATES, EXPRESSION_NAMES, FACE_COLORS, renderFaceSvg, STATE_LABEL } from "agentfaces";

let frames: Array<FrameRequestCallback> = [];

function matchMediaStub(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
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
  Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: matchMediaStub(false) });
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

describe("AgentFace web", () => {
  it("labels every state as name, state and hides decorative art", () => {
    for (const state of AGENT_STATES) {
      const { unmount } = render(<AgentFace seed="a" state={state} name="Ada" variant="still" />);
      expect(screen.getByRole("img", { name: `Ada, ${STATE_LABEL[state]}` })).toBeTruthy();
      unmount();
    }
    const { container } = render(<AgentFace seed="a" state="celebrate" name="Ada" decorative variant="still" />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("still variant renders one frame with no timers, no ticker, no ornament and no confetti", () => {
    const { container } = render(
      <>
        <AgentFace seed="a" state="celebrate" variant="still" />
        <AgentFace seed="b" state="background" variant="still" />
      </>,
    );
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(webTicker.size).toBe(0);
    expect(container.querySelectorAll("[data-af-variant='still']")).toHaveLength(2);
    expect(container.querySelector("[data-af-confetti]")).toBeNull();
    expect(container.querySelector("[data-af-ornament]")).toBeNull();
    expect(container.querySelector("[data-af-motion]")).toBeNull();
  });

  it("still frame matches the SVG string renderer for the same shape and expression", () => {
    const { container } = render(<AgentFace seed="a" shape="triangle" color="#2B90FF" expression="glad" variant="still" />);
    const still = renderFaceSvg({ shape: "triangle", color: "#2B90FF", expression: "glad", size: 48 });
    const mouth = still.match(/<path d="(M [^"]+Z)" fill="#15131B"/)?.[1];
    expect(mouth).toBeTruthy();
    expect(container.querySelector("[data-af-part='mouth']")?.getAttribute("d")).toBe(mouth);
  });

  it("drives every live character from a single shared ticker", () => {
    const { unmount } = render(
      <>
        {Array.from({ length: 9 }, (_, i) => (
          <AgentFace key={i} seed={`c-${i}`} state="working" />
        ))}
      </>,
    );
    expect(webTicker.size).toBe(9);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flush(1000);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    unmount();
    expect(webTicker.size).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("paints frames into the SVG without re-rendering React", () => {
    const { container } = render(<AgentFace seed="paint" state="celebrate" />);
    const mouth = container.querySelector("[data-af-part='mouth']")!;
    const before = mouth.getAttribute("d");
    flush(0);
    for (let t = 16; t < 7000; t += 16) flush(t);
    expect(mouth.getAttribute("d")).not.toBe(before);
    expect(container.querySelector("[data-af-confetti]")).toBeTruthy();
    expect(container.querySelector("[data-af-motion='hop']")).toBeTruthy();
  });

  it("morphs the body into a glyph for alert, hides the face, pops the dot, and restores the body", () => {
    const { container } = render(<AgentFace seed="glyph" shape="circle" state="alert" />);
    const shape = container.querySelector("[data-af-part='shape']")!;
    const body = container.querySelector("[data-af-part='body']")!;
    const face = container.querySelector("[data-af-face]")!;
    const dot = container.querySelector("[data-af-part='glyph-dot']")!;
    const original = shape.getAttribute("d");
    expect(dot.getAttribute("r")).toBe("0");
    flush(0);
    for (let t = 16; t < 1200; t += 16) flush(t);
    expect(shape.getAttribute("d")).toBe(original);
    for (let t = 1200; t < 2600; t += 16) flush(t);
    expect(body.getAttribute("data-af-glyph")).toBe("bang");
    expect(shape.getAttribute("d")).not.toBe(original);
    expect(shape.getAttribute("d")!.startsWith("M ")).toBe(true);
    expect(Number(face.getAttribute("opacity"))).toBeLessThan(0.05);
    expect(Number(dot.getAttribute("r"))).toBeGreaterThan(8);
    for (let t = 2600; t < 4400; t += 16) flush(t);
    expect(shape.getAttribute("d")).toBe(original);
    expect(body.hasAttribute("data-af-glyph")).toBe(false);
    expect(Number(face.getAttribute("opacity"))).toBe(1);
  });

  it("keeps the face riding on the heart for the smitten expression", () => {
    const { container } = render(<AgentFace seed="heart" shape="square" expression="smitten" state="idle" />);
    const shape = container.querySelector("[data-af-part='shape']")!;
    const face = container.querySelector("[data-af-face]")!;
    const original = shape.getAttribute("d");
    flush(0);
    for (let t = 16; t < 1500; t += 16) flush(t);
    expect(container.querySelector("[data-af-part='body']")!.getAttribute("data-af-glyph")).toBe("heart");
    expect(shape.getAttribute("d")).not.toBe(original);
    expect(Number(face.getAttribute("opacity"))).toBe(1);
    expect(container.querySelector("[data-af-part='glyph-dot']")!.getAttribute("r")).toBe("0.00");
  });

  it("renders no glyph parts for states without one, in the static variant, or under reduced motion", () => {
    const { container, unmount } = render(<AgentFace seed="g" state="working" />);
    expect(container.querySelector("[data-af-part='glyph-dot']")).toBeNull();
    unmount();
    const stat = render(<AgentFace seed="g" shape="circle" state="alert" variant="still" />);
    expect(stat.container.querySelector("[data-af-part='glyph-dot']")).toBeNull();
    expect(stat.container.querySelector("[data-af-part='shape']")!.getAttribute("d")!.startsWith("M50 4.5a")).toBe(true);
    stat.unmount();
    render(<AgentFace seed="g" state="alert" reducedMotion />);
    expect(container.querySelector("[data-af-part='glyph-dot']")).toBeNull();
  });

  it("draws solid ink eyes without a glint at small sizes and keeps the white eye with a glint when large", () => {
    const small = render(<AgentFace seed="s" shape="circle" expression="calm" variant="still" size={24} />);
    const big = render(<AgentFace seed="s" shape="circle" expression="calm" variant="still" size={96} />);
    const sclera = (c: HTMLElement) => c.querySelector("[data-af-part='sclera']")!.getAttribute("fill");
    expect(sclera(small.container)).toBe(FACE_COLORS.pupil);
    expect(sclera(big.container)).toBe(FACE_COLORS.sclera);
    expect(small.container.querySelector("[data-af-part='glint']")!.getAttribute("opacity")).toBe("0.00");
    expect(big.container.querySelector("[data-af-part='glint']")!.getAttribute("opacity")).toBe("1.00");
  });

  it("goes still under reduced motion with no frames requested", () => {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: matchMediaStub(true) });
    const { container } = render(<AgentFace seed="rm" state="celebrate" name="Ada" />);
    expect(container.querySelector("[data-af-variant='still']")).toBeTruthy();
    expect(container.querySelector("[data-af-confetti]")).toBeNull();
    expect(webTicker.size).toBe(0);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(screen.getByRole("img", { name: "Ada, Celebrating" })).toBeTruthy();
  });

  it("honours an explicit reducedMotion prop either way", () => {
    Object.defineProperty(window, "matchMedia", { writable: true, configurable: true, value: matchMediaStub(true) });
    const { container, unmount } = render(<AgentFace seed="x" state="idle" reducedMotion={false} />);
    expect(webTicker.size).toBe(1);
    expect(container.querySelector("[data-af-variant='live']")).toBeTruthy();
    unmount();
    render(<AgentFace seed="x" state="idle" reducedMotion />);
    expect(webTicker.size).toBe(0);
  });

  it("renders ornaments for the ornament states and hides the mouth behind typing dots", () => {
    const { container, rerender } = render(<AgentFace seed="m" state="background" />);
    expect(container.querySelector("[data-af-ornament='tracker']")).toBeTruthy();
    rerender(<AgentFace seed="m" state="running" />);
    expect(container.querySelector("[data-af-ornament='spinner']")).toBeTruthy();
    rerender(<AgentFace seed="m" state="monitoring" />);
    expect(container.querySelector("[data-af-ornament='ripple']")).toBeTruthy();
    rerender(<AgentFace seed="m" state="typing" />);
    expect(container.querySelector("[data-af-ornament='typing']")).toBeTruthy();
    expect(container.querySelector("[data-af-part='mouth']")).toBeNull();
  });

  it("keeps the mouth on a typing face when the dots are not rendered", () => {
    const { container } = render(
      <>
        <AgentFace seed="m" state="typing" variant="still" />
        <AgentFace seed="m" state="typing" reducedMotion />
      </>,
    );
    expect(container.querySelectorAll("[data-af-part='mouth']")).toHaveLength(2);
    expect(container.querySelector("[data-af-ornament]")).toBeNull();
  });

  it("shares one IntersectionObserver across faces and resumes without a burst", () => {
    const observed: Element[] = [];
    let callback: IntersectionObserverCallback = () => {};
    const Observer = vi.fn().mockImplementation((cb: IntersectionObserverCallback) => {
      callback = cb;
      return { observe: (el: Element) => observed.push(el), unobserve: vi.fn(), disconnect: vi.fn() };
    });
    vi.stubGlobal("IntersectionObserver", Observer);
    const { container, unmount } = render(
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <AgentFace key={i} seed={`o-${i}`} state="idle" />
        ))}
      </>,
    );
    expect(Observer).toHaveBeenCalledTimes(1);
    expect(observed).toHaveLength(6);
    expect(webTicker.size).toBe(6);
    act(() => callback(observed.map((target) => ({ target, isIntersecting: false }) as IntersectionObserverEntry), {} as IntersectionObserver));
    expect(webTicker.size).toBe(0);
    act(() => callback(observed.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry), {} as IntersectionObserver));
    expect(webTicker.size).toBe(6);
    flush(90000);
    expect(container.querySelectorAll("[data-af-part='eye']")).toHaveLength(12);
    unmount();
  });

  it("does not snap the painted face back to rest when the state changes", () => {
    const { container, rerender } = render(<AgentFace seed="snap" state="idle" />);
    const mouth = container.querySelector("[data-af-part='mouth']")!;
    flush(0);
    for (let t = 16; t < 3000; t += 16) flush(t);
    const painted = mouth.getAttribute("d");
    rerender(<AgentFace seed="snap" state="sleeping" />);
    expect(mouth.getAttribute("d")).toBe(painted);
  });

  it("accepts an expression override and a mouth switch", () => {
    for (const expression of EXPRESSION_NAMES) {
      const { container, unmount } = render(<AgentFace seed="e" expression={expression} variant="still" />);
      expect(container.querySelector("[data-af-expression]")?.getAttribute("data-af-expression")).toBe(expression);
      unmount();
    }
    const { container } = render(<AgentFace seed="e" mouth={false} variant="still" />);
    expect(container.querySelector("[data-af-part='mouth']")).toBeNull();
    expect(container.querySelectorAll("[data-af-part='eye']")).toHaveLength(2);
  });

  it("renders a flat matte body with no gradient, highlight, shadow or specular at any size", () => {
    const { container } = render(
      <>
        <AgentFace seed="f" size={24} variant="still" color="#2B90FF" />
        <AgentFace seed="f" size={64} variant="still" color="#2B90FF" />
        <AgentFace seed="f" size={96} variant="still" color="#2B90FF" />
        <AgentFace seed="f" size={128} variant="still" color="#2B90FF" />
      </>,
    );
    const chars = container.querySelectorAll("[data-agentface]");
    expect(chars).toHaveLength(4);
    for (const char of Array.from(chars)) {
      expect(char.querySelector("linearGradient, radialGradient, filter")).toBeNull();
      expect(char.querySelector("[data-af-part='shadow'], [data-af-part='specular']")).toBeNull();
      const body = char.querySelector("[data-af-part='body'] > path");
      expect(body?.getAttribute("fill")).toBe("#2B90FF");
      expect(char.querySelectorAll("[data-af-part='pupil']")).toHaveLength(2);
      expect(char.querySelectorAll("[data-af-part='glint']")).toHaveLength(2);
      expect(char.querySelector("[data-af-part='mouth']")?.getAttribute("stroke-linecap")).toBe("round");
    }
  });

  it("drives the body from springs every frame and leaves still bodies untouched", () => {
    const { container } = render(
      <>
        <AgentFace seed="body" state="celebrate" shape="circle" />
        <AgentFace seed="body" state="celebrate" shape="circle" variant="still" />
      </>,
    );
    const [liveBody, stillBody] = Array.from(container.querySelectorAll("[data-af-part='body']"));
    const transforms = new Set<string>();
    flush(0);
    for (let t = 16; t < 1600; t += 16) {
      flush(t);
      transforms.add(liveBody.getAttribute("transform") ?? "");
    }
    expect(transforms.size).toBeGreaterThan(30);
    expect(stillBody.getAttribute("transform")).toBeNull();
  });

  it("keeps the same seed looking the same across renders", () => {
    const normalise = (html: string) => html.replace(/(#|id=")af[a-zA-Z0-9]+/g, "$1afX");
    const a = normalise(render(<AgentFace seed="stable" variant="still" />).container.innerHTML);
    cleanup();
    const b = normalise(render(<AgentFace seed="stable" variant="still" />).container.innerHTML);
    expect(a).toBe(b);
  });

  it("picks shape and color from the seed and the provider's shapes and palette", () => {
    const { container } = render(
      <AgentFacesProvider shapes={["square"]} palette={["#123456"]}>
        <AgentFace seed="anything" variant="still" />
      </AgentFacesProvider>,
    );
    expect(container.querySelector("[data-af-part='shape']")?.getAttribute("fill")).toBe("#123456");
    expect(container.querySelector("[data-af-part='shape']")?.getAttribute("d")?.startsWith("M17 4.5")).toBe(true);
  });

  it("uses a custom label, provider labels and provider defaults", () => {
    render(
      <AgentFacesProvider labels={{ working: "Au travail" }} variant="still">
        <AgentFace seed="l" state="working" name="Ada" />
        <AgentFace seed="l" state="done" label="Report ready" />
      </AgentFacesProvider>,
    );
    expect(screen.getByRole("img", { name: "Ada, Au travail" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Report ready" })).toBeTruthy();
    expect(webTicker.size).toBe(0);
  });

  it("defaults the accessible name to the state name", () => {
    render(<AgentFace seed="d" state="needs-you" variant="still" />);
    expect(screen.getByRole("img", { name: "Needs you" })).toBeTruthy();
  });

  it("injects its keyframes only when an ornament or confetti is on screen", () => {
    const { container, rerender } = render(<AgentFace seed="c" state="working" />);
    expect(container.querySelector("style")).toBeNull();
    rerender(<AgentFace seed="c" state="celebrate" />);
    expect(container.querySelector("style")?.textContent).toContain("@keyframes af-confetti");
  });
});
