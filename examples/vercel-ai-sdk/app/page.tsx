"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { STATE_LABEL } from "agentfaces";
import { AgentFace } from "agentfaces/react";
import { agentStateFor } from "./agent-state";

export default function Chat() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const state = agentStateFor(status, messages);

  return (
    <main className="chat">
      <header className="agent">
        <AgentFace state={state} shape="circle" color="#2F6BFF" size={72} name="Assistant" />
        <div>
          <strong>Assistant</strong>
          <span className="status">{STATE_LABEL[state]}</span>
        </div>
      </header>

      <ol className="messages">
        {messages.map((message) => (
          <li key={message.id} className={message.role}>
            {message.parts.map((part, i) => {
              if (part.type === "text") return <p key={i}>{part.text}</p>;
              if (part.type.startsWith("tool-")) return <p key={i} className="tool">Checking the weather...</p>;
              return null;
            })}
          </li>
        ))}
      </ol>

      {error && <p className="error">Something went wrong. Check AI_GATEWAY_API_KEY and try again.</p>}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!input.trim()) return;
          void sendMessage({ text: input });
          setInput("");
        }}
      >
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about the weather in Lagos" disabled={status !== "ready" && status !== "error"} />
        <button type="submit" disabled={status !== "ready" && status !== "error"}>
          Send
        </button>
      </form>
    </main>
  );
}
