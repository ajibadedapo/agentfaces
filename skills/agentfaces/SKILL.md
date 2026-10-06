---
name: agentfaces
description: Use when adding a face, avatar, mascot or status indicator for an AI agent, chatbot, copilot or voice agent with the agentfaces npm package. Triggers include "show an AI agent's status", "agent avatar", "thinking indicator", "voice agent avatar", "lip sync avatar for LiveKit, OpenAI Realtime or ElevenLabs", "animated face for my assistant", "needs approval indicator", and any code importing agentfaces, agentfaces/react, agentfaces/react-native or agentfaces/svg.
---

# agentfaces

Expressive animated faces that show what an AI agent is doing. One component, `<AgentFace state="thinking" />`, on React, React Native and plain SVG.

## Steps

1. Install: `npm install agentfaces` (React Native: `npm install agentfaces react-native-svg`). In a shadcn/ui project you can instead run `npx shadcn@latest add https://ajibadedapo.github.io/agentfaces/r/agent-face.json`.
2. Import from the entry point for the platform:
   - Web, Next.js, Vite: `import { AgentFace } from "agentfaces/react";` (already a client component)
   - React Native, Expo: `import { AgentFace } from "agentfaces/react-native";`
   - Server, email, other frameworks: `import { renderFaceSvg } from "agentfaces/svg";`
   - Types and names without React: `import { type AgentState, STATE_LABEL } from "agentfaces";`
3. Map the app's agent status to one `state` and pass it as a prop. Give the face a stable `seed` (agent id) and a `name` for the accessible label.
4. For voice agents use `listening` and `speaking` with the `audio` prop, or the adapters `agentfaces/livekit` (`liveKitFace`), `agentfaces/openai-realtime` (`bindRealtimeSession`) and `agentfaces/elevenlabs` (`elevenLabsFace`).
5. Run the app in development and check the console: unknown names warn with a "did you mean" fix.

## Vocabulary

- States: `idle`, `thinking`, `working`, `needs-you`, `done`, `alert`, `celebrate`, `sleeping`, `starting`, `attentive`, `exploring`, `waiting`, `handing-off`, `heads-up`, `typing`, `running`, `monitoring`, `background`, `listening`, `speaking`.
- Shapes: `circle`, `triangle`, `square`.
- Typical mapping: request sent `thinking`, streaming text `typing`, tool running `working`, waiting for approval `needs-you`, finished `done`, error `alert`, disconnected `sleeping`.

## Recipes

Read the recipes in https://ajibadedapo.github.io/agentfaces/llms-full.txt (section "Recipes") before writing code. They cover: a status face in React or Next.js, mapping the Vercel AI SDK `useChat` status, lists of many agents, React Native and Expo, voice agents with LiveKit, OpenAI Realtime and ElevenLabs, static SVG, and the shadcn component.

## Do not

- Do not import a component from the root `agentfaces`, or `agentfaces/react` in React Native.
- Do not use snake_case or camelCase states (`needs_you`, `needsYou`); states are kebab-case.
- Do not remount the face to change state, add timers, or install reanimated or Lottie for it.
- Do not leave `speaking` without `audio` if the user expects lip sync; it is simulated until audio is connected.
