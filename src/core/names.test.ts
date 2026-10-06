import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_STATES, checkExpression, checkShape, checkState, EXPRESSION_NAMES, faceFor, renderFaceSvg, SHAPE_NAMES, suggestName, unknownNameMessage } from "agentfaces";
import { buildFaceSet } from "../svg";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("suggestName", () => {
  it.each([
    ["thinkng", "thinking"],
    ["needs_you", "needs-you"],
    ["Needs You", "needs-you"],
    ["needsyou", "needs-you"],
    ["Thinking", "thinking"],
    ["celebrating", "celebrate"],
    ["speak", "speaking"],
    ["handoff", "handing-off"],
  ])("suggests a state for %s", (input, expected) => {
    expect(suggestName(input, AGENT_STATES)).toBe(expected);
  });

  it("suggests shapes and expressions", () => {
    expect(suggestName("circel", SHAPE_NAMES)).toBe("circle");
    expect(suggestName("sqare", SHAPE_NAMES)).toBe("square");
    expect(suggestName("happpy", EXPRESSION_NAMES)).toBeUndefined();
    expect(suggestName("pondring", EXPRESSION_NAMES)).toBe("pondering");
  });

  it("suggests nothing when no name is close", () => {
    expect(suggestName("banana", AGENT_STATES)).toBeUndefined();
    expect(suggestName("", AGENT_STATES)).toBeUndefined();
    expect(suggestName("x", SHAPE_NAMES)).toBeUndefined();
  });
});

describe("unknownNameMessage", () => {
  it("names the value, the suggestion, the fallback and the valid names", () => {
    const message = unknownNameMessage("state", "thinkng", '"idle"');
    expect(message).toContain('unknown state "thinkng"');
    expect(message).toContain('Did you mean "thinking"?');
    expect(message).toContain('Using "idle" instead');
    expect(message).toContain("needs-you");
  });

  it("leaves out the suggestion when nothing is close", () => {
    expect(unknownNameMessage("shape", "hexagon", '"circle"')).not.toContain("Did you mean");
  });
});

describe("check helpers", () => {
  it("pass valid names through without warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(checkState("working")).toBe("working");
    expect(checkShape("triangle")).toBe("triangle");
    expect(checkExpression("sly")).toBe("sly");
    expect(checkState(undefined)).toBe("idle");
    expect(checkShape(undefined)).toBeUndefined();
    expect(checkExpression(null)).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("fall back and warn with a suggestion in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(checkState("wroking")).toBe("idle");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Did you mean "working"?'));
    expect(checkShape("trangle", "circle")).toBe("circle");
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('Did you mean "triangle"?'));
    expect(checkExpression("plesed")).toBeUndefined();
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('Did you mean "pleased"?'));
  });

  it("warn once per unknown name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    checkState("snoozing");
    checkState("snoozing");
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("handle non-string values", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(checkState(42)).toBe("idle");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("unknown state 42"));
  });

  it("stay silent and never throw in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(checkState("prod-typo")).toBe("idle");
    expect(checkShape("prod-typo", "square")).toBe("square");
    expect(checkExpression("prod-typo")).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});

describe("renderers recover from unknown names", () => {
  it("renderFaceSvg falls back instead of throwing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const svg = renderFaceSvg({ shape: "hexagon" as never, color: "#2F6BFF", state: "thinkin" as never, expression: "grumpy" as never });
    expect(svg).toContain('aria-label="Idle"');
    expect(svg).toBe(renderFaceSvg({ shape: "circle", color: "#2F6BFF" }));
    expect(warn).toHaveBeenCalledTimes(3);
  });

  it("faceFor ignores unknown shapes", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(faceFor("ada", { shapes: ["squre" as never, "triangle"] }).shape).toBe("triangle");
    expect(SHAPE_NAMES).toContain(faceFor("ada", { shapes: ["blob" as never] }).shape);
  });

  it("buildFaceSet falls back to circle", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(buildFaceSet("oval" as never).manifest.shape).toBe("circle");
  });
});
