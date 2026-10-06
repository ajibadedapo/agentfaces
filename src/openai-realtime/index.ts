import { createLevelFeed, pcm16Level, type AgentState, type LevelFeed } from "agentfaces";

/** A Realtime API server event, as received over WebRTC data channels, WebSockets or the Agents SDK transport_event. */
export interface RealtimeServerEventLike {
  type: string;
  item?: { type?: string } | null;
  response?: { status?: string; output?: ReadonlyArray<{ type?: string }> | null } | null;
}

export interface RealtimeFaceContext {
  bufferedPlayback: boolean;
}

const SPEAKING_EVENTS = new Set(["response.output_audio.delta", "response.audio.delta", "output_audio_buffer.started"]);
const WORKING_EVENTS = new Set(["response.function_call_arguments.delta", "response.mcp_call_arguments.delta", "response.mcp_call.in_progress", "mcp_list_tools.in_progress"]);
const PLAYBACK_DONE_EVENTS = new Set(["output_audio_buffer.stopped", "output_audio_buffer.cleared"]);

/**
 * Reducer from the current face state and one Realtime server event to the next face state.
 * The context remembers whether the transport reports playback (WebRTC does, WebSockets do not).
 */
export function nextRealtimeState(current: AgentState, event: RealtimeServerEventLike, context: RealtimeFaceContext = { bufferedPlayback: false }): AgentState {
  const type = event.type;
  if (type === "output_audio_buffer.started") context.bufferedPlayback = true;
  if (SPEAKING_EVENTS.has(type)) return "speaking";
  if (WORKING_EVENTS.has(type)) return "working";
  if (PLAYBACK_DONE_EVENTS.has(type)) return current === "speaking" ? "listening" : current;
  switch (type) {
    case "error":
      return "alert";
    case "session.created":
      return current === "sleeping" || current === "starting" ? "listening" : current;
    case "input_audio_buffer.speech_started":
      return "listening";
    case "input_audio_buffer.speech_stopped":
    case "input_audio_buffer.committed":
    case "response.created":
      return current === "speaking" ? current : "thinking";
    case "response.output_item.added":
      return event.item?.type === "mcp_approval_request" ? "needs-you" : current;
    case "response.done": {
      if (event.response?.status === "failed") return "alert";
      if (event.response?.output?.some((item) => item.type === "function_call")) return "working";
      if (current === "speaking" && context.bufferedPlayback) return current;
      return current === "needs-you" ? current : "listening";
    }
    default:
      return current;
  }
}

export interface RealtimeFaceState {
  readonly state: AgentState;
  handle(event: RealtimeServerEventLike): AgentState;
  set(state: AgentState): AgentState;
  reset(state?: AgentState): void;
}

/** A small state holder around nextRealtimeState that calls onChange only when the face state changes. */
export function createRealtimeFaceState(onChange?: (state: AgentState) => void, initial: AgentState = "starting"): RealtimeFaceState {
  let state = initial;
  let context: RealtimeFaceContext = { bufferedPlayback: false };
  const set = (next: AgentState) => {
    if (next !== state) {
      state = next;
      onChange?.(state);
    }
    return state;
  };
  return {
    get state() {
      return state;
    },
    handle: (event) => set(nextRealtimeState(state, event, context)),
    set,
    reset(next = initial) {
      context = { bufferedPlayback: false };
      set(next);
    },
  };
}

/** The event methods of a RealtimeSession from @openai/agents-realtime that this adapter uses. */
export interface RealtimeSessionLike {
  on(type: "transport_event", listener: (event: RealtimeServerEventLike) => void): unknown;
  on(type: "audio_interrupted" | "agent_tool_start" | "agent_tool_end" | "tool_approval_requested" | "error", listener: () => void): unknown;
  off(type: "transport_event", listener: (event: RealtimeServerEventLike) => void): unknown;
  off(type: "audio_interrupted" | "agent_tool_start" | "agent_tool_end" | "tool_approval_requested" | "error", listener: () => void): unknown;
}

/** Follows a RealtimeSession and reports face states. Returns a function that stops listening. */
export function bindRealtimeSession(session: RealtimeSessionLike, onState: (state: AgentState) => void, initial: AgentState = "starting"): () => void {
  const face = createRealtimeFaceState(onState, initial);
  const onTransport = (event: RealtimeServerEventLike) => void face.handle(event);
  const fixed: Array<["audio_interrupted" | "agent_tool_start" | "agent_tool_end" | "tool_approval_requested" | "error", () => void]> = [
    ["audio_interrupted", () => void face.set("listening")],
    ["agent_tool_start", () => void face.set("working")],
    ["agent_tool_end", () => void face.set("thinking")],
    ["tool_approval_requested", () => void face.set("needs-you")],
    ["error", () => void face.set("alert")],
  ];
  session.on("transport_event", onTransport);
  for (const [type, listener] of fixed) session.on(type, listener);
  onState(face.state);
  return () => {
    session.off("transport_event", onTransport);
    for (const [type, listener] of fixed) session.off(type, listener);
  };
}

/** A level feed for raw 16-bit PCM output, for example Realtime audio deltas you play yourself. Push each chunk as it plays. */
export function createPcmLevelFeed(): LevelFeed & { pushPcm(chunk: ArrayBuffer | Int16Array): void } {
  const feed = createLevelFeed();
  return { ...feed, pushPcm: (chunk) => feed.push(pcm16Level(chunk)) };
}

export { pcm16Level };
