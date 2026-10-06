import type { ExpressionName } from "./expressions";
import { tempo } from "./tempo";

export const CORE_STATES = ["idle", "thinking", "working", "needs-you", "done", "alert", "celebrate", "sleeping"] as const;
export const EXTENDED_STATES = ["starting", "attentive", "exploring", "waiting", "handing-off", "heads-up"] as const;
export const ORNAMENT_STATES = ["typing", "running", "monitoring", "background"] as const;
export const AGENT_STATES = [...CORE_STATES, ...EXTENDED_STATES, ...ORNAMENT_STATES] as const;

export type CoreAgentState = (typeof CORE_STATES)[number];
export type AgentState = (typeof AGENT_STATES)[number];
export type OrnamentKind = "typing" | "spinner" | "ripple" | "tracker";

export const STATE_LABEL: Record<AgentState, string> = {
  idle: "Idle",
  thinking: "Thinking",
  working: "Working",
  "needs-you": "Needs you",
  done: "Done",
  alert: "Alert",
  celebrate: "Celebrating",
  sleeping: "Sleeping",
  starting: "Starting up",
  attentive: "Paying attention",
  exploring: "Exploring",
  waiting: "Waiting",
  "handing-off": "Handing off",
  "heads-up": "Heads up",
  typing: "Typing",
  running: "Running",
  monitoring: "Monitoring",
  background: "Working in the background",
};

export type MotionKind = "breathe" | "bob" | "tilt" | "pulse" | "hop" | "squash" | "turn";

export interface StateMotion {
  kind: MotionKind;
  duration: number;
  loop: boolean;
}

const motion = (kind: MotionKind, step: number, loop = true): StateMotion => ({ kind, duration: tempo(step), loop });

export const STATE_MOTION: Record<AgentState, StateMotion> = {
  idle: motion("breathe", 9),
  thinking: motion("tilt", 5),
  working: motion("bob", 3),
  "needs-you": motion("pulse", 4),
  done: motion("hop", 0, false),
  alert: motion("squash", 1),
  celebrate: motion("hop", 1),
  sleeping: motion("breathe", 10),
  starting: motion("squash", 3, false),
  attentive: motion("tilt", 8),
  exploring: motion("turn", 8),
  waiting: motion("bob", 5),
  "handing-off": motion("hop", 2, false),
  "heads-up": motion("pulse", 3),
  typing: motion("breathe", 9),
  running: motion("breathe", 9),
  monitoring: motion("breathe", 9),
  background: motion("breathe", 9),
};

export interface StateExpressions {
  pool: readonly ExpressionName[];
  cadence: number;
}

const pool = (names: readonly ExpressionName[], step: number): StateExpressions => ({ pool: names, cadence: tempo(step) });

export const STATE_EXPRESSIONS: Record<AgentState, StateExpressions> = {
  idle: pool(["calm", "glad", "intrigued"], 10),
  thinking: pool(["pondering", "intrigued", "puzzled", "doubtful"], 9),
  working: pool(["intent", "resolute", "calm"], 9),
  "needs-you": pool(["watchful", "uneasy", "intrigued"], 8),
  done: pool(["pleased", "glad", "cheering", "sly"], 10),
  alert: pool(["uneasy", "watchful", "startled"], 6),
  celebrate: pool(["cheering", "giggling", "overjoyed", "eager", "smitten"], 7),
  sleeping: pool(["drowsy"], 12),
  starting: pool(["drowsy", "wistful", "startled", "calm"], 5),
  attentive: pool(["intrigued", "watchful", "calm"], 9),
  exploring: pool(["intrigued", "intent", "pondering"], 8),
  waiting: pool(["calm", "weary", "pondering", "serene"], 10),
  "handing-off": pool(["resolute", "eager", "glad"], 7),
  "heads-up": pool(["watchful", "eager", "startled"], 7),
  typing: pool(["pondering", "calm"], 10),
  running: pool(["intent", "resolute", "calm"], 10),
  monitoring: pool(["watchful", "intrigued", "intent"], 9),
  background: pool(["intent", "pondering", "calm"], 10),
};

export const STATE_ORNAMENT: Partial<Record<AgentState, OrnamentKind>> = {
  typing: "typing",
  running: "spinner",
  monitoring: "ripple",
  background: "tracker",
};

export const STATE_CONFETTI: Partial<Record<AgentState, true>> = { celebrate: true };

export function restExpression(state: AgentState): ExpressionName {
  return STATE_EXPRESSIONS[state].pool[0];
}

export type Placement = "list" | "feature";

export const RESTING_STATES: readonly AgentState[] = ["idle", "sleeping"];

export function placementVariant(state: AgentState, placement: Placement): "live" | "still" {
  if (placement === "list") return "still";
  return RESTING_STATES.includes(state) ? "still" : "live";
}

export function isAgentState(value: unknown): value is AgentState {
  return typeof value === "string" && (AGENT_STATES as readonly string[]).includes(value);
}
