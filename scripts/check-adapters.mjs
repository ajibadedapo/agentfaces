import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SDKS = ["@livekit/components-react@2", "livekit-client@2", "@openai/agents-realtime@0.19", "openai@7", "@elevenlabs/client@1", "@elevenlabs/react@1", "react@19", "react-dom@19", "typescript@5"];
const dir = mkdtempSync(join(tmpdir(), "agentfaces-adapters-"));

const compat = `import type { VoiceAssistant, AgentState as LiveKitState, TrackReference } from "@livekit/components-react";
import type { RealtimeSession, TransportEvent } from "@openai/agents-realtime";
import type { RealtimeServerEvent } from "openai/resources/realtime/realtime";
import type { VoiceConversation, Mode, Status, Callbacks } from "@elevenlabs/client";
import type { useConversation } from "@elevenlabs/react";
import { liveKitFace, streamFromTrackRef, type LiveKitAgentState, type LiveKitVoiceAssistantLike } from "agentfaces/livekit";
import { bindRealtimeSession, nextRealtimeState, type RealtimeServerEventLike } from "agentfaces/openai-realtime";
import { elevenLabsFace, elevenLabsLevel, elevenLabsCallbacks, type ElevenLabsMode, type ElevenLabsStatus } from "agentfaces/elevenlabs";

declare const assistant: VoiceAssistant;
declare const ref: TrackReference;
export const fits: LiveKitVoiceAssistantLike = assistant;
liveKitFace(assistant, { microphone: ref });
streamFromTrackRef(ref);
export const sameStates: [Record<LiveKitState, true>, Record<LiveKitAgentState, true>] = [{} as Record<LiveKitAgentState, true>, {} as Record<LiveKitState, true>];
declare const session: RealtimeSession;
bindRealtimeSession(session, () => {});
declare const raw: RealtimeServerEvent;
declare const transport: TransportEvent;
export const events: RealtimeServerEventLike[] = [raw, transport];
nextRealtimeState("idle", raw);
declare const conversation: VoiceConversation;
elevenLabsLevel(conversation, "output");
declare const hook: ReturnType<typeof useConversation>;
elevenLabsFace(hook);
export const modes: [ElevenLabsMode, ElevenLabsStatus, ElevenLabsStatus] = [{} as Mode, {} as Status, {} as ReturnType<typeof useConversation>["status"]];
export const callbacks: Partial<Callbacks> = elevenLabsCallbacks(() => {});
`;

const paths = Object.fromEntries(["", "/livekit", "/openai-realtime", "/elevenlabs"].map((sub) => [`agentfaces${sub}`, [join(root, "dist", sub, "index.d.ts")]]));

try {
  writeFileSync(join(dir, "package.json"), "{}");
  writeFileSync(join(dir, "compat.ts"), compat);
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "Bundler", strict: true, noEmit: true, skipLibCheck: true, lib: ["ES2022", "DOM"], types: [], paths }, files: ["compat.ts"] }));
  execFileSync("npm", ["install", "--no-audit", "--no-fund", "--silent", ...SDKS], { cwd: dir, stdio: "inherit" });
  execFileSync(join(dir, "node_modules", ".bin", "tsc"), ["-p", "tsconfig.json"], { cwd: dir, stdio: "inherit" });
  console.log("adapters match the published SDK types");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
