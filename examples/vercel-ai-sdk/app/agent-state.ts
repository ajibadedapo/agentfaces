import { isToolUIPart, type ChatStatus, type UIMessage } from "ai";
import type { AgentState } from "agentfaces";

export function agentStateFor(status: ChatStatus, messages: UIMessage[]): AgentState {
  if (status === "error") return "alert";
  if (status === "submitted") return "thinking";
  const last = messages.at(-1);
  const tools = last?.role === "assistant" ? last.parts.filter(isToolUIPart) : [];
  if (tools.some((part) => part.state === "approval-requested")) return "needs-you";
  if (status === "streaming") {
    const toolRunning = tools.some((part) => part.state === "input-streaming" || part.state === "input-available");
    return toolRunning ? "working" : "typing";
  }
  return last?.role === "assistant" ? "done" : "idle";
}
