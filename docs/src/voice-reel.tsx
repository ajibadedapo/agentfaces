import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { createSyntheticVoice, STATE_LABEL, type AgentState, type LevelCallback, type ShapeName } from "agentfaces";
import { AgentFace } from "agentfaces/react";

const REEL_LENGTH = 12000;
const before = new URLSearchParams(location.search).get("mode") === "before";

interface Track {
  name: string;
  shape: ShapeName;
  color: string;
  offset: number;
}

const TRACKS: Track[] = [
  { name: "Concierge", shape: "circle", color: "#2B90FF", offset: 0 },
  { name: "Tutor", shape: "triangle", color: "#F97216", offset: 4000 },
  { name: "Support", shape: "square", color: "#13B8A7", offset: 8000 },
];

const TURN: Array<[number, AgentState, AgentState]> = [
  [0, "listening", "attentive"],
  [3600, "thinking", "thinking"],
  [5000, "speaking", "typing"],
  [10600, "listening", "attentive"],
];

function stateAt(t: number): AgentState {
  let current = TURN[0];
  for (const step of TURN) if (t >= step[0]) current = step;
  return before ? current[2] : current[1];
}

function useReelTime(): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => setT((performance.now() - start) % REEL_LENGTH), 50);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Face({ track, t }: { track: Track; t: number }) {
  const state = stateAt((t + track.offset) % REEL_LENGTH);
  const user = useMemo(() => createSyntheticVoice(`${track.name}-user`, { rate: 4, loudness: 0.85 }), [track.name]);
  const agent = useMemo(() => createSyntheticVoice(`${track.name}-agent`), [track.name]);
  const audio: LevelCallback | null = state === "speaking" ? agent : state === "listening" ? user : null;
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: 150 }}>
      <AgentFace state={state} shape={track.shape} color={track.color} seed={track.name} size={124} name={track.name} audio={audio} />
      <figcaption style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 650, color: "#1C1B22" }}>{track.name}</span>
        <span style={{ fontSize: 13, color: "#6B6A75" }}>{STATE_LABEL[state]}</span>
      </figcaption>
    </figure>
  );
}

function Reel() {
  const t = useReelTime();
  return (
    <main style={{ display: "flex", gap: 56, padding: "28px 48px 22px", background: "#fff", width: "fit-content", fontFamily: "ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif" }} id="reel">
      {TRACKS.map((track) => (
        <Face key={track.name} track={track} t={t} />
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Reel />
  </StrictMode>,
);
