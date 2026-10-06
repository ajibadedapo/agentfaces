import type { AgentState } from "agentfaces";

/** Agent states reported by useVoiceAssistant() in @livekit/components-react 2.x. */
export type LiveKitAgentState = "disconnected" | "connecting" | "pre-connect-buffering" | "failed" | "initializing" | "idle" | "listening" | "thinking" | "speaking";

/** The parts of a LiveKit TrackReference this adapter reads. A TrackReference from @livekit/components-react fits. */
export interface LiveKitTrackRefLike {
  publication?: { track?: { mediaStreamTrack?: MediaStreamTrack } | null } | null;
}

/** The parts of useVoiceAssistant() this adapter reads. */
export interface LiveKitVoiceAssistantLike {
  state: LiveKitAgentState | (string & {});
  audioTrack?: LiveKitTrackRefLike | null;
}

export const LIVEKIT_FACE_STATES: Record<LiveKitAgentState, AgentState> = {
  disconnected: "sleeping",
  connecting: "starting",
  "pre-connect-buffering": "listening",
  failed: "alert",
  initializing: "starting",
  idle: "idle",
  listening: "listening",
  thinking: "thinking",
  speaking: "speaking",
};

/** Maps a LiveKit agent state to a face state. Unknown states map to idle. */
export function faceStateFromLiveKit(state: string): AgentState {
  return (LIVEKIT_FACE_STATES as Record<string, AgentState>)[state] ?? "idle";
}

const streams = new WeakMap<MediaStreamTrack, MediaStream>();

/** A MediaStream for a track reference, cached per track so its identity stays stable across renders. */
export function streamFromTrackRef(ref: LiveKitTrackRefLike | MediaStream | null | undefined): MediaStream | undefined {
  if (!ref) return undefined;
  if (typeof MediaStream !== "undefined" && ref instanceof MediaStream) return ref;
  const track = (ref as LiveKitTrackRefLike).publication?.track?.mediaStreamTrack;
  if (!track || typeof MediaStream === "undefined") return undefined;
  let stream = streams.get(track);
  if (!stream) {
    stream = new MediaStream([track]);
    streams.set(track, stream);
  }
  return stream;
}

export interface LiveKitFaceOptions {
  /** The local microphone (a track reference or a MediaStream). Drives the listening pulse. */
  microphone?: LiveKitTrackRefLike | MediaStream | null;
}

export interface LiveKitFaceProps {
  state: AgentState;
  audio: MediaStream | null;
}

/**
 * Props for AgentFace from useVoiceAssistant(): the face state, plus the agent's audio while speaking
 * and the microphone (when given) while listening.
 */
export function liveKitFace(assistant: LiveKitVoiceAssistantLike, options: LiveKitFaceOptions = {}): LiveKitFaceProps {
  const state = faceStateFromLiveKit(assistant.state);
  const audio = state === "speaking" ? streamFromTrackRef(assistant.audioTrack) : state === "listening" ? streamFromTrackRef(options.microphone) : undefined;
  return { state, audio: audio ?? null };
}
