# agentfaces

## 0.2.1

### Patch Changes

- [#10](https://github.com/ajibadedapo/agentfaces/pull/10) [`d78c497`](https://github.com/ajibadedapo/agentfaces/commit/d78c497151f1dbe75befba668b8c295645d01bf0) Thanks [@ajibadedapo](https://github.com/ajibadedapo)! - Unknown `state`, `shape` and `expression` names no longer crash a face. They fall back (`idle`, the seeded shape, the state's own expressions; `circle` in `renderFaceSvg` and `buildFaceSet`) and, in development only, warn once with a "did you mean" suggestion, for example `unknown state "needs_you". Did you mean "needs-you"?`. The core exports `checkState`, `checkShape`, `checkExpression`, `suggestName` and `unknownNameMessage`. Also: `llms.txt`, `llms-full.txt`, `AGENTS.md`, a Claude Code skill, a shadcn registry item and more npm keywords so AI coding agents find and use the library correctly.

## 0.2.0

### Minor Changes

- [#8](https://github.com/ajibadedapo/agentfaces/pull/8) [`742997a`](https://github.com/ajibadedapo/agentfaces/commit/742997acad6686575f2c88b812d538288344028c) Thanks [@ajibadedapo](https://github.com/ajibadedapo)! - Voice states for voice agents. New `listening` and `speaking` states: listening leans in, looks straight at the user and pulses with their voice, and speaking moves the mouth with the agent's audio. `AgentFace` takes an `audio` prop (MediaStream, AudioNode, media element, level callback, level stream or AudioLevel; React Native takes callbacks, streams and levels) and both renderers export `useAudioLevel`. Until audio is connected, speaking is simulated with a synthetic voice; pass `audio={null}` to hold the mouth still. The core adds `createAudioLevel`, `mouthForLevel`, `MouthModel`, `createLevelFeed` and `createSyntheticVoice`. New optional adapter entries with no runtime dependencies: `agentfaces/livekit`, `agentfaces/openai-realtime` and `agentfaces/elevenlabs`.

## 0.1.2

### Patch Changes

- [#6](https://github.com/ajibadedapo/agentfaces/pull/6) [`d2aed31`](https://github.com/ajibadedapo/agentfaces/commit/d2aed318cf1f29d11a7b80553fa713259e4029a7) Thanks [@ajibadedapo](https://github.com/ajibadedapo)! - README: an animated demo of faces moving through agent states and glyph morphs, a 10-second quick start, and image links that render on npm. New examples for the Vercel AI SDK (chat status and tool calls mapped to face states) and React Native with Expo, linked from the README and docs.

## 0.1.1

### Patch Changes

- [`c33a284`](https://github.com/ajibadedapo/agentfaces/commit/c33a28484393db972cb52f8727a5a58ea5740c9d) Thanks [@ajibadedapo](https://github.com/ajibadedapo)! - README: explain how to verify that an installed version was built and published by the release workflow, with `npm audit signatures` or the Provenance section on npm.

## 0.1.0

### Minor Changes

- [`9ae287e`](https://github.com/ajibadedapo/agentfaces/commit/9ae287e25b38a14e21c7356edb321de73e25c543) Thanks [@ajibadedapo](https://github.com/ajibadedapo)! - First release: expressive faces for AI agents with React, React Native and static SVG renderers, eighteen agent states, twenty six expressions and three body shapes.
