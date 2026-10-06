export { AgentFace, type AgentFaceProps, type NativeAudioSource } from "./AgentFace";
export { useAudioLevel } from "../shared/audio";
export { nativeTicker, NATIVE_TICK_MS } from "./ticker";
export { useReducedMotion } from "./useReducedMotion";
export { AgentFacesProvider, useAgentFacesTheme, type AgentFacesProviderProps, type AgentFacesTheme } from "../shared/theme";
export { faceFor, placementVariant, AGENT_STATES, EXPRESSION_NAMES, SHAPE_NAMES, STATE_LABEL, DEFAULT_PALETTE, VOICE_STATES, createAudioLevel, createLevelFeed, createSyntheticVoice } from "agentfaces";
export type { AgentState, ExpressionName, ShapeName, FacePick, FaceForOptions, Placement, VoiceState, AudioLevel, AudioLevelOptions, LevelCallback, LevelStream, LevelFeed, LevelFrame, LevelBands } from "agentfaces";
