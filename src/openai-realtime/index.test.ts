import { describe, expect, it, vi } from "vitest";
import type { AgentState } from "agentfaces";
import { bindRealtimeSession, createPcmLevelFeed, createRealtimeFaceState, nextRealtimeState, type RealtimeServerEventLike, type RealtimeSessionLike } from "./index";
import { createAudioLevel } from "agentfaces";

const replay = (events: RealtimeServerEventLike[]) => {
  const seen: AgentState[] = [];
  const face = createRealtimeFaceState((state) => seen.push(state));
  for (const event of events) face.handle(event);
  return seen;
};

describe("agentfaces/openai-realtime", () => {
  it("follows a WebRTC turn and waits for playback to stop before listening", () => {
    expect(
      replay([
        { type: "session.created" },
        { type: "input_audio_buffer.speech_started" },
        { type: "input_audio_buffer.speech_stopped" },
        { type: "input_audio_buffer.committed" },
        { type: "response.created" },
        { type: "output_audio_buffer.started" },
        { type: "response.output_audio_transcript.delta" },
        { type: "response.done", response: { status: "completed", output: [{ type: "message" }] } },
        { type: "output_audio_buffer.stopped" },
      ]),
    ).toEqual(["listening", "thinking", "speaking", "listening"]);
  });

  it("follows a WebSocket turn from audio deltas to response.done", () => {
    expect(replay([{ type: "session.created" }, { type: "response.created" }, { type: "response.output_audio.delta" }, { type: "response.audio.delta" }, { type: "response.done", response: { status: "completed" } }])).toEqual(["listening", "thinking", "speaking", "listening"]);
  });

  it("shows tool calls, approvals, barge-in and errors", () => {
    expect(replay([{ type: "response.created" }, { type: "response.function_call_arguments.delta" }, { type: "response.done", response: { output: [{ type: "function_call" }] } }, { type: "response.created" }])).toEqual(["thinking", "working", "thinking"]);
    expect(replay([{ type: "response.created" }, { type: "response.output_item.added", item: { type: "mcp_approval_request" } }, { type: "response.done" }])).toEqual(["thinking", "needs-you"]);
    expect(replay([{ type: "output_audio_buffer.started" }, { type: "input_audio_buffer.speech_started" }, { type: "output_audio_buffer.cleared" }])).toEqual(["speaking", "listening"]);
    expect(replay([{ type: "error" }])).toEqual(["alert"]);
    expect(replay([{ type: "response.done", response: { status: "failed" } }])).toEqual(["alert"]);
    expect(nextRealtimeState("thinking", { type: "rate_limits.updated" })).toBe("thinking");
  });

  it("binds to a session-like emitter and unbinds every listener", () => {
    const listeners = new Map<string, Set<(...args: never[]) => void>>();
    const session = {
      on: vi.fn((type: string, listener: (...args: never[]) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(listener);
      }),
      off: vi.fn((type: string, listener: (...args: never[]) => void) => listeners.get(type)?.delete(listener)),
    };
    const emit = (type: string, ...args: unknown[]) => listeners.get(type)?.forEach((listener) => (listener as (...a: unknown[]) => void)(...args));
    const seen: AgentState[] = [];
    const unbind = bindRealtimeSession(session as unknown as RealtimeSessionLike, (state) => seen.push(state));
    emit("transport_event", { type: "session.created" });
    emit("agent_tool_start");
    emit("agent_tool_end");
    emit("transport_event", { type: "output_audio_buffer.started" });
    emit("audio_interrupted");
    emit("tool_approval_requested");
    emit("error");
    expect(seen).toEqual(["starting", "listening", "working", "thinking", "speaking", "listening", "needs-you", "alert"]);
    unbind();
    expect(session.off).toHaveBeenCalledTimes(session.on.mock.calls.length);
    expect([...listeners.values()].every((set) => set.size === 0)).toBe(true);
  });

  it("turns pushed PCM chunks into a level", () => {
    const feed = createPcmLevelFeed();
    const level = createAudioLevel(feed, { attack: 0, release: 0 });
    feed.pushPcm(new Int16Array(240).map((_, i) => Math.round(Math.sin(i / 3) * 12000)));
    expect(level.update(0)).toBeGreaterThan(0.7);
  });
});
