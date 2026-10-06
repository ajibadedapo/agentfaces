"use client";

import { AgentFace as Face, STATE_LABEL, type AgentFaceProps as FaceProps, type AgentState } from "agentfaces/react";

export type { AgentState };

export type AgentFaceProps = FaceProps;

/** An agent face that shows what an AI agent is doing. Change `state` as the agent works. */
export function AgentFace({ size = 40, ...props }: AgentFaceProps) {
  return <Face size={size} {...props} />;
}

export interface AgentStatusProps extends Omit<AgentFaceProps, "decorative" | "label"> {
  /** Text shown next to the face. Defaults to the state name, for example "Thinking". */
  text?: string;
}

/** A face with a text label beside it, for headers, chat bubbles and agent lists. */
export function AgentStatus({ state = "idle", name, text, className, style, size = 28, ...props }: AgentStatusProps) {
  const label = text ?? STATE_LABEL[state] ?? STATE_LABEL.idle;
  return (
    <span className={["inline-flex items-center gap-2", className].filter(Boolean).join(" ")} style={style} role="status" aria-live="polite">
      <Face state={state} name={name} size={size} decorative {...props} />
      <span className="text-sm text-muted-foreground">{name ? `${name}: ${label}` : label}</span>
    </span>
  );
}
