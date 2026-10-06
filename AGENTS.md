# AGENTS.md

Guidance for AI coding agents. The first part is for agents adding agentfaces to an app; the second is for agents working on this repository. The complete API reference is in [llms-full.txt](./llms-full.txt) (also at https://ajibadedapo.github.io/agentfaces/llms-full.txt).

## Using agentfaces in an app

### Install

```sh
npm install agentfaces                    # web, Next.js, Node
npm install agentfaces react-native-svg   # React Native and Expo (no reanimated)
```

Or, in a shadcn/ui project: `npx shadcn@latest add https://ajibadedapo.github.io/agentfaces/r/agent-face.json` (adds `components/agent-face.tsx`).

### Imports per platform

| Platform | Import |
| --- | --- |
| React, Next.js, Vite | `import { AgentFace } from "agentfaces/react";` (already a client component) |
| React Native, Expo | `import { AgentFace } from "agentfaces/react-native";` |
| Server, email, Vue, Svelte, plain HTML | `import { renderFaceSvg } from "agentfaces/svg";` |
| Names, types, helpers without React | `import { AGENT_STATES, STATE_LABEL, faceFor, type AgentState } from "agentfaces";` |
| Voice SDKs | `agentfaces/livekit`, `agentfaces/openai-realtime`, `agentfaces/elevenlabs` |

### Vocabulary

- `state` (20): `idle`, `thinking`, `working`, `needs-you`, `done`, `alert`, `celebrate`, `sleeping`, `starting`, `attentive`, `exploring`, `waiting`, `handing-off`, `heads-up`, `typing`, `running`, `monitoring`, `background`, `listening`, `speaking`.
- `shape`: `circle`, `triangle`, `square`. Omit it and pass `seed` to pick shape and color from an id.
- `expression` (optional, holds one face): `calm`, `glad`, `pleased`, `sly`, `playful`, `eager`, `giggling`, `cheering`, `overjoyed`, `smitten`, `bashful`, `flustered`, `wistful`, `serene`, `intrigued`, `pondering`, `intent`, `resolute`, `doubtful`, `puzzled`, `watchful`, `startled`, `uneasy`, `downcast`, `weary`, `drowsy`, `heedful`, `chatty`.
- Other props: `seed`, `color`, `size` (48), `variant` (`"live"` or `"still"`), `mouth`, `name`, `label`, `decorative`, `reducedMotion`, `audio`.

### Common recipes

```tsx
<AgentFace state="thinking" seed={agent.id} name={agent.name} />
```

```tsx
const state: AgentState = status === "submitted" ? "thinking" : status === "streaming" ? "typing" : status === "error" ? "alert" : "done";
<AgentFace state={state} />
```

```tsx
{agents.map((a) => <AgentFace key={a.id} seed={a.id} state={a.state} variant={placementVariant(a.state, "list")} size={32} />)}
```

```tsx
import { liveKitFace } from "agentfaces/livekit";
import { elevenLabsFace } from "agentfaces/elevenlabs";
import { AgentFace, useAudioLevel } from "agentfaces/react";

<AgentFace {...liveKitFace(useVoiceAssistant())} />
<AgentFace {...elevenLabsFace(useConversation())} />
<AgentFace state={talking ? "speaking" : "listening"} audio={useAudioLevel(stream)} />
```

```ts
const svg = renderFaceSvg({ shape: "circle", color: "#2F6BFF", state: "done", size: 64 });
```

More, including the Vercel AI SDK mapping and OpenAI Realtime: [llms-full.txt](./llms-full.txt).

### Pitfalls

- The root `agentfaces` import has no component. Use `agentfaces/react` or `agentfaces/react-native`, never the web entry in React Native.
- State names are kebab-case (`needs-you`, not `needs_you` or `needsYou`). Unknown state, shape or expression names do not throw: they fall back (`idle`, the seeded shape, the state's expressions) and warn once in development with a "did you mean" suggestion. Read that warning and fix the name.
- Change the `state` prop to animate; do not remount with `key={state}`.
- Keep `seed` stable (an id). Do not add timers or animation loops; one shared ticker drives every face.
- Use `variant="still"` (or `placementVariant(state, "list")`) for long lists.
- Without `audio`, `speaking` is simulated. Pass real audio for lip sync, or `audio={null}` to keep the mouth still. React Native `audio` takes level callbacks, level streams (`createLevelFeed()`) or an `AudioLevel`, not a `MediaStream`.
- Do not add reanimated, Lottie or extra SVG libraries for this.

## Working on this repository

### Layout

- `src/core`: framework-free core exported as `agentfaces`. No runtime dependencies and no framework imports.
- `src/react`, `src/react-native`, `src/svg`, `src/shared`: renderers and shared React code. They import the core as `agentfaces` (kept external in the build).
- `src/livekit`, `src/openai-realtime`, `src/elevenlabs`: voice adapters with structural types only.
- `docs/`: the docs site (Vite). `llms.txt` and `llms-full.txt` at the repo root are also served from the site root.
- `registry/` and `registry.json`: the shadcn registry item. `docs/public/r/` is its built output.
- `examples/`: standalone apps that install from npm. Not linted or published.

### Commands

```sh
npm ci
npm run lint        # eslint plus scripts/check-text.mjs (bans em dashes everywhere)
npm run typecheck   # library, registry and docs
npm test            # vitest
npm run build       # tsup to dist/
npm run size        # size-limit budgets in .size-limit.json
npm run docs:build  # docs site to docs/dist
npm run registry:build  # rebuild docs/public/r from registry.json after editing registry/
```

CI runs lint, typecheck, test, build, size, docs:build and `npm pack --dry-run`. Run them before opening a pull request.

### Conventions

- No code comments. Exported public API may carry short JSDoc.
- No em dashes in any file.
- New state, shape or expression names go in `src/core/states.ts`, `src/core/shapes.ts` or `src/core/expressions.ts`; new expressions must pass `validateFace` and the face-fit tests.
- Stay within the size budgets; explain any increase in the pull request.
- Add a changeset (`npx changeset`) when the published package changes. Releases are automatic from `main`.
- After changing `llms-full.txt`, keep it accurate to the code: read the source and types, do not guess.
