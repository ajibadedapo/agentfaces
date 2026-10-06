import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_STATES } from "agentfaces";
import { faceStateFromLiveKit, LIVEKIT_FACE_STATES, liveKitFace, streamFromTrackRef, type LiveKitAgentState } from "./index";

class FakeStream {
  constructor(readonly tracks: unknown[] = []) {}
}

afterEach(() => vi.unstubAllGlobals());

const trackRef = (track: object) => ({ publication: { track: { mediaStreamTrack: track as MediaStreamTrack } } });

describe("agentfaces/livekit", () => {
  it("maps every LiveKit agent state to a face state", () => {
    const expected: Record<LiveKitAgentState, string> = { disconnected: "sleeping", connecting: "starting", "pre-connect-buffering": "listening", failed: "alert", initializing: "starting", idle: "idle", listening: "listening", thinking: "thinking", speaking: "speaking" };
    expect(LIVEKIT_FACE_STATES).toEqual(expected);
    for (const state of Object.values(LIVEKIT_FACE_STATES)) expect(AGENT_STATES).toContain(state);
    expect(faceStateFromLiveKit("something-new")).toBe("idle");
  });

  it("wraps a track reference in one cached MediaStream per track", () => {
    vi.stubGlobal("MediaStream", FakeStream);
    const track = {};
    const a = streamFromTrackRef(trackRef(track));
    expect(a).toBeInstanceOf(FakeStream);
    expect(streamFromTrackRef(trackRef(track))).toBe(a);
    expect(streamFromTrackRef(trackRef({}))).not.toBe(a);
    expect(streamFromTrackRef({ publication: { track: undefined } })).toBeUndefined();
    expect(streamFromTrackRef(undefined)).toBeUndefined();
    const own = new FakeStream() as unknown as MediaStream;
    expect(streamFromTrackRef(own)).toBe(own);
  });

  it("uses the agent track while speaking and the microphone while listening", () => {
    vi.stubGlobal("MediaStream", FakeStream);
    const agent = trackRef({ id: "agent" });
    const mic = trackRef({ id: "mic" });
    const speaking = liveKitFace({ state: "speaking", audioTrack: agent }, { microphone: mic });
    expect(speaking.state).toBe("speaking");
    expect(speaking.audio).toBe(streamFromTrackRef(agent));
    const listening = liveKitFace({ state: "listening", audioTrack: agent }, { microphone: mic });
    expect(listening.audio).toBe(streamFromTrackRef(mic));
    expect(liveKitFace({ state: "listening", audioTrack: agent }).audio).toBeNull();
    expect(liveKitFace({ state: "thinking", audioTrack: agent }, { microphone: mic })).toEqual({ state: "thinking", audio: null });
  });
});
