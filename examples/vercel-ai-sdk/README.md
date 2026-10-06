# Agentfaces with the Vercel AI SDK

A minimal Next.js chat where an `AgentFace` follows the AI SDK chat status.

| AI SDK | Agentfaces state |
| --- | --- |
| `submitted` | `thinking` |
| `streaming` text | `typing` |
| `streaming` with a tool call running | `working` |
| tool call waiting for approval | `needs-you` |
| `ready` after a reply | `done` |
| `error` | `alert` |
| `ready` before the first message | `idle` |

The mapping is one function in [`app/agent-state.ts`](./app/agent-state.ts).

```sh
npm install
AI_GATEWAY_API_KEY=your-key npm run dev
```

Set `AI_MODEL` to use a different model (default `openai/gpt-5-mini`). Without a key the face shows `alert` when the request fails, which is a quick way to see the error state.
