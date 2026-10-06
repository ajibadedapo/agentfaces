import { useEffect, useRef, useState } from "react";
import { createSyntheticVoice, type AgentState, type AudioLevel } from "agentfaces";
import { AgentFace, useAudioLevel, webTicker } from "agentfaces/react";
import { startSynthVoice, type SynthVoice } from "./synth";

function Meter({ level }: { level: AudioLevel | null }) {
  const bar = useRef<HTMLSpanElement>(null);
  const bands = useRef<Array<HTMLSpanElement | null>>([]);
  useEffect(() => {
    if (!level) return;
    return webTicker.subscribe((now) => {
      level.update(now);
      return () => {
        if (bar.current) bar.current.style.transform = `scaleX(${level.value.toFixed(3)})`;
        const values = level.bands ? [level.bands.low, level.bands.mid, level.bands.high] : [0, 0, 0];
        values.forEach((value, i) => {
          const el = bands.current[i];
          if (el) el.style.transform = `scaleY(${Math.max(0.04, value).toFixed(3)})`;
        });
      };
    });
  }, [level]);
  return (
    <div className="meter" aria-hidden="true">
      <span className="meter-track">
        <span ref={bar} className="meter-fill" />
      </span>
      <span className="meter-bands">
        {["low", "mid", "high"].map((name, i) => (
          <span key={name} title={name}>
            <span
              ref={(el) => {
                bands.current[i] = el;
              }}
            />
          </span>
        ))}
      </span>
    </div>
  );
}

function sharedContext(): AudioContext {
  const scope = window as unknown as { __afContext?: AudioContext };
  scope.__afContext ??= new AudioContext();
  return scope.__afContext;
}

function SynthDemo() {
  const [voice, setVoice] = useState<SynthVoice | null>(null);
  const [audible, setAudible] = useState(false);
  const level = useAudioLevel(voice?.output ?? null);
  useEffect(() => () => voice?.stop(), [voice]);
  const toggle = async () => {
    if (voice) {
      setVoice(null);
      return;
    }
    const context = sharedContext();
    await context.resume();
    setVoice(startSynthVoice(context, audible));
  };
  return (
    <figure className="voice-card">
      <div className="voice-stage">
        <AgentFace state={voice ? "speaking" : "idle"} audio={level} shape="circle" color="#2B90FF" seed="synth" size={140} name="Synthetic voice" />
      </div>
      <Meter level={level} />
      <figcaption>
        <strong>Synthetic voice, no microphone</strong>
        <span>A Web Audio formant synth feeds an AudioNode to the face. Sound is off unless you turn it on.</span>
      </figcaption>
      <div className="voice-actions">
        <button type="button" className="button" onClick={() => void toggle()}>
          {voice ? "Stop" : "Play synthetic voice"}
        </button>
        <label className="check">
          <input
            type="checkbox"
            checked={audible}
            onChange={(e) => {
              setAudible(e.target.checked);
              voice?.setAudible(e.target.checked);
            }}
          />{" "}
          Sound
        </label>
      </div>
    </figure>
  );
}

function MicDemo() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<"listening" | "speaking">("listening");
  const [error, setError] = useState<string | null>(null);
  const level = useAudioLevel(stream);
  useEffect(() => () => stream?.getTracks().forEach((track) => track.stop()), [stream]);
  const toggle = async () => {
    if (stream) {
      setStream(null);
      return;
    }
    setError(null);
    try {
      await sharedContext().resume();
      setStream(await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }));
    } catch {
      setError("Microphone permission was not granted.");
    }
  };
  return (
    <figure className="voice-card">
      <div className="voice-stage">
        <AgentFace state={stream ? mode : "sleeping"} audio={level} shape="square" color="#13B8A7" seed="mic" size={140} name="Microphone" />
      </div>
      <Meter level={level} />
      <figcaption>
        <strong>Your microphone</strong>
        <span>Opt in to see the face listen to you, or mouth your words. Audio never leaves this page.</span>
        {error ? <span role="alert">{error}</span> : null}
      </figcaption>
      <div className="voice-actions">
        <button type="button" className="button" onClick={() => void toggle()}>
          {stream ? "Stop microphone" : "Use my microphone"}
        </button>
        <div className="segmented" role="group" aria-label="Voice state">
          {(["listening", "speaking"] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} className={mode === m ? "active" : ""} onClick={() => setMode(m)}>
              {m}
            </button>
          ))}
        </div>
      </div>
    </figure>
  );
}

const TURN: Array<[number, AgentState]> = [
  [0, "listening"],
  [3200, "thinking"],
  [4600, "speaking"],
  [9800, "listening"],
];
const TURN_LENGTH = 12000;

function TurnDemo() {
  const [state, setState] = useState<AgentState>("listening");
  const user = useRef(createSyntheticVoice("user", { rate: 4, loudness: 0.8 }));
  const agent = useRef(createSyntheticVoice("agent"));
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const t = (performance.now() - start) % TURN_LENGTH;
      let next: AgentState = TURN[0][1];
      for (const [at, s] of TURN) if (t >= at) next = s;
      setState(next);
    }, 100);
    return () => clearInterval(id);
  }, []);
  const audio = state === "speaking" ? agent.current : state === "listening" ? user.current : null;
  return (
    <figure className="voice-card">
      <div className="voice-stage">
        <AgentFace state={state} audio={audio} shape="triangle" color="#F97216" seed="turn" size={140} name="Turn taking" />
      </div>
      <figcaption>
        <strong>A full turn, no audio hardware</strong>
        <span>
          Listening while you talk, thinking, then speaking. Both sides use <code>createSyntheticVoice</code> level callbacks.
        </span>
      </figcaption>
    </figure>
  );
}

export function VoiceDemos() {
  return (
    <div className="voice-grid">
      <SynthDemo />
      <MicDemo />
      <TurnDemo />
    </div>
  );
}
