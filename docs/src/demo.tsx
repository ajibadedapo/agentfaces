import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { STATE_LABEL, type AgentState, type ShapeName } from "agentfaces";
import { AgentFace } from "agentfaces/react";

const REEL_LENGTH = 12000;

interface Track {
  name: string;
  shape: ShapeName;
  color: string;
  steps: Array<[number, AgentState]>;
}

const TRACKS: Track[] = [
  { name: "Researcher", shape: "circle", color: "#2B90FF", steps: [[0, "idle"], [1500, "thinking"], [4000, "working"], [7000, "done"], [10500, "idle"]] },
  { name: "Reviewer", shape: "triangle", color: "#F97216", steps: [[0, "working"], [1500, "needs-you"], [6500, "working"], [8500, "celebrate"], [11000, "working"]] },
  { name: "Builder", shape: "square", color: "#8B5CF6", steps: [[0, "thinking"], [1200, "alert"], [5000, "working"], [8500, "done"], [11600, "thinking"]] },
];

function stateAt(track: Track, t: number): AgentState {
  let current = track.steps[0][1];
  for (const [at, state] of track.steps) if (t >= at) current = state;
  return current;
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

function Reel() {
  const t = useReelTime();
  return (
    <main style={{ display: "flex", gap: 56, padding: "28px 48px 22px", background: "#fff", width: "fit-content", fontFamily: "ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif" }} id="reel">
      {TRACKS.map((track) => {
        const state = stateAt(track, t);
        return (
          <figure key={track.name} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, width: 150 }}>
            <AgentFace state={state} shape={track.shape} color={track.color} seed={track.name} size={124} name={track.name} />
            <figcaption style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 15, fontWeight: 650, color: "#1C1B22" }}>{track.name}</span>
              <span style={{ fontSize: 13, color: "#6B6A75" }}>{STATE_LABEL[state]}</span>
            </figcaption>
          </figure>
        );
      })}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Reel />
  </StrictMode>,
);
