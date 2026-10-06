import { bandsFromSpectrum, type AgentState, type LevelCallback, type LevelFrame } from "agentfaces";

/** Conversation mode in @elevenlabs/client and @elevenlabs/react. */
export type ElevenLabsMode = "speaking" | "listening";
/** Connection status. @elevenlabs/client reports disconnecting, @elevenlabs/react reports error. */
export type ElevenLabsStatus = "disconnected" | "connecting" | "connected" | "disconnecting" | "error";

/** The volume getters this adapter reads. A Conversation from @elevenlabs/client or useConversation() fits. */
export interface ElevenLabsVolumeLike {
  getInputVolume(): number;
  getOutputVolume(): number;
  getInputByteFrequencyData?(): Uint8Array;
  getOutputByteFrequencyData?(): Uint8Array;
}

export interface ElevenLabsConversationLike extends ElevenLabsVolumeLike {
  status: ElevenLabsStatus | (string & {});
  mode: ElevenLabsMode | (string & {});
}

/** ElevenLabs resamples its frequency data to this voice range before returning it. */
export const ELEVENLABS_SPECTRUM_HZ = { from: 100, to: 8000 } as const;
/** ElevenLabs volume is a mean of frequency bins, so speech sits low. This gain lifts it into 0..1. */
export const ELEVENLABS_GAIN = 2.6;

/** Maps conversation status and mode to a face state. */
export function faceStateFromElevenLabs({ status, mode }: { status: string; mode?: string }): AgentState {
  switch (status) {
    case "connected":
      return mode === "speaking" ? "speaking" : "listening";
    case "connecting":
      return "starting";
    case "error":
      return "alert";
    default:
      return "sleeping";
  }
}

export interface ElevenLabsLevelOptions {
  /** Multiplies the volume before clamping. Defaults to ELEVENLABS_GAIN. */
  gain?: number;
  /** Read coarse bands from the frequency data when available. Defaults to true. */
  bands?: boolean;
}

/** A level callback that reads the conversation's input (the user) or output (the agent) volume each frame. */
export function elevenLabsLevel(conversation: ElevenLabsVolumeLike, side: "input" | "output", options: ElevenLabsLevelOptions = {}): LevelCallback {
  const gain = options.gain ?? ELEVENLABS_GAIN;
  const wantBands = options.bands ?? true;
  return (): LevelFrame => {
    const raw = side === "output" ? conversation.getOutputVolume() : conversation.getInputVolume();
    const level = Math.min(1, Math.max(0, (Number.isFinite(raw) ? raw : 0) * gain));
    const read = side === "output" ? conversation.getOutputByteFrequencyData : conversation.getInputByteFrequencyData;
    if (!wantBands || !read) return { level };
    const spectrum = read.call(conversation);
    if (!spectrum || spectrum.length === 0) return { level };
    const bands = bandsFromSpectrum(spectrum, 255, ELEVENLABS_SPECTRUM_HZ.from, ELEVENLABS_SPECTRUM_HZ.to);
    return { level, bands: { low: bands.low * gain, mid: bands.mid * gain, high: bands.high * gain } };
  };
}

export interface ElevenLabsFaceProps {
  state: AgentState;
  audio: LevelCallback | null;
}

/** Props for AgentFace from useConversation(): the face state and the matching volume as a level callback. */
export function elevenLabsFace(conversation: ElevenLabsConversationLike, options?: ElevenLabsLevelOptions): ElevenLabsFaceProps {
  const state = faceStateFromElevenLabs(conversation);
  const audio = state === "speaking" ? elevenLabsLevel(conversation, "output", options) : state === "listening" ? elevenLabsLevel(conversation, "input", options) : null;
  return { state, audio };
}

export interface ElevenLabsCallbacks {
  onStatusChange(prop: { status: ElevenLabsStatus }): void;
  onModeChange(prop: { mode: ElevenLabsMode }): void;
  onError(message: string, context?: unknown): void;
}

/** Callbacks to spread into Conversation.startSession() that report the face state as the conversation changes. */
export function elevenLabsCallbacks(onState: (state: AgentState) => void): ElevenLabsCallbacks {
  let status: string = "connecting";
  let mode: string = "listening";
  const report = () => onState(faceStateFromElevenLabs({ status, mode }));
  return {
    onStatusChange(prop) {
      status = prop.status;
      report();
    },
    onModeChange(prop) {
      mode = prop.mode;
      report();
    },
    onError() {
      status = "error";
      report();
    },
  };
}
