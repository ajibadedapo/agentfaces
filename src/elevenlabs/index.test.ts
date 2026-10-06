import { describe, expect, it } from "vitest";
import type { AgentState } from "agentfaces";
import { createAudioLevel } from "agentfaces";
import { ELEVENLABS_GAIN, elevenLabsCallbacks, elevenLabsFace, elevenLabsLevel, faceStateFromElevenLabs } from "./index";

const fakeConversation = (input: number, output: number, status = "connected", mode = "listening") => ({
  status,
  mode,
  getInputVolume: () => input,
  getOutputVolume: () => output,
  getOutputByteFrequencyData: () => new Uint8Array(1024).map((_, i) => (i > 700 ? 200 : 10)),
});

describe("agentfaces/elevenlabs", () => {
  it("maps status and mode to face states", () => {
    expect(faceStateFromElevenLabs({ status: "connected", mode: "speaking" })).toBe("speaking");
    expect(faceStateFromElevenLabs({ status: "connected", mode: "listening" })).toBe("listening");
    expect(faceStateFromElevenLabs({ status: "connecting" })).toBe("starting");
    expect(faceStateFromElevenLabs({ status: "disconnecting" })).toBe("sleeping");
    expect(faceStateFromElevenLabs({ status: "disconnected" })).toBe("sleeping");
    expect(faceStateFromElevenLabs({ status: "error" })).toBe("alert");
  });

  it("reads output volume with bands while speaking and input volume while listening", () => {
    const speaking = elevenLabsFace(fakeConversation(0.05, 0.2, "connected", "speaking"));
    expect(speaking.state).toBe("speaking");
    const frame = speaking.audio!(0) as { level: number; bands: { low: number; high: number } };
    expect(frame.level).toBeCloseTo(0.2 * ELEVENLABS_GAIN);
    expect(frame.bands.high).toBeGreaterThan(frame.bands.low);
    const listening = elevenLabsFace(fakeConversation(0.1, 0.9));
    expect((listening.audio!(0) as { level: number }).level).toBeCloseTo(0.1 * ELEVENLABS_GAIN);
    expect(elevenLabsFace(fakeConversation(0.1, 0.9, "connecting")).audio).toBeNull();
  });

  it("clamps volumes and survives missing frequency data", () => {
    const level = createAudioLevel(elevenLabsLevel({ getInputVolume: () => Number.NaN, getOutputVolume: () => 3 }, "output"), { attack: 0 });
    expect(level.update(0)).toBe(1);
    expect(level.bands).toBeNull();
    expect((elevenLabsLevel({ getInputVolume: () => Number.NaN, getOutputVolume: () => 0 }, "input")(0) as { level: number }).level).toBe(0);
  });

  it("reports face states from startSession callbacks", () => {
    const seen: AgentState[] = [];
    const callbacks = elevenLabsCallbacks((state) => seen.push(state));
    callbacks.onStatusChange({ status: "connecting" });
    callbacks.onStatusChange({ status: "connected" });
    callbacks.onModeChange({ mode: "speaking" });
    callbacks.onModeChange({ mode: "listening" });
    callbacks.onError("boom");
    callbacks.onStatusChange({ status: "disconnected" });
    expect(seen).toEqual(["starting", "listening", "speaking", "listening", "alert", "sleeping"]);
  });
});
