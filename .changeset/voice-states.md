---
"agentfaces": minor
---

Voice states for voice agents. New `listening` and `speaking` states: listening leans in, looks straight at the user and pulses with their voice, and speaking moves the mouth with the agent's audio. `AgentFace` takes an `audio` prop (MediaStream, AudioNode, media element, level callback, level stream or AudioLevel; React Native takes callbacks, streams and levels) and both renderers export `useAudioLevel`. Until audio is connected, speaking is simulated with a synthetic voice; pass `audio={null}` to hold the mouth still. The core adds `createAudioLevel`, `mouthForLevel`, `MouthModel`, `createLevelFeed` and `createSyntheticVoice`. New optional adapter entries with no runtime dependencies: `agentfaces/livekit`, `agentfaces/openai-realtime` and `agentfaces/elevenlabs`.
