import { useMemo, useState } from "react";
import { AGENT_STATES, CORE_STATES, DEFAULT_PALETTE, EXPRESSION_NAMES, EXTENDED_STATES, ORNAMENT_STATES, SHAPE_NAMES, STATE_LABEL, VOICE_STATES, type AgentState, type ExpressionName, type ShapeName } from "agentfaces";
import { AgentFace } from "agentfaces/react";
import { renderFaceSvg } from "agentfaces/svg";
import { FACE_FOR, INSTALL, NATIVE_QUICK, PROVIDER, REACT_QUICK, SVG_QUICK, VOICE_ELEVENLABS, VOICE_LIVEKIT, VOICE_NATIVE, VOICE_OPENAI, VOICE_REACT } from "./snippets";
import { VoiceDemos } from "./voice";

const GITHUB = "https://github.com/ajibadedapo/agentfaces";

function Code({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="code">
      <pre>
        <code>{children}</code>
      </pre>
      <button
        type="button"
        className="copy"
        onClick={() => {
          void navigator.clipboard?.writeText(children);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Hero() {
  const cast: Array<{ state: AgentState; shape: ShapeName; color: string }> = [
    { state: "thinking", shape: "circle", color: "#2B90FF" },
    { state: "working", shape: "square", color: "#8B5CF6" },
    { state: "needs-you", shape: "triangle", color: "#F97216" },
    { state: "done", shape: "circle", color: "#20C75E" },
    { state: "celebrate", shape: "square", color: "#EA489B" },
  ];
  return (
    <header className="hero">
      <div className="cast">
        {cast.map((face) => (
          <figure key={face.state}>
            <AgentFace {...face} seed={face.state} size={88} />
            <figcaption>{STATE_LABEL[face.state]}</figcaption>
          </figure>
        ))}
      </div>
      <h1>Agentfaces</h1>
      <p className="lede">Expressive faces for AI agents. Show what an agent is doing, thinking, working, waiting on you or done, with a face people read at a glance. React, React Native and plain SVG. MIT.</p>
      <div className="actions">
        <a className="button" href="#quick-start">Get started</a>
        <a className="button ghost" href="#playground">Open the playground</a>
        <a className="button ghost" href={GITHUB}>GitHub</a>
      </div>
    </header>
  );
}

type Tab = "react" | "native" | "svg";

function QuickStart() {
  const [tab, setTab] = useState<Tab>("react");
  const code = tab === "react" ? REACT_QUICK : tab === "native" ? NATIVE_QUICK : SVG_QUICK;
  return (
    <section id="quick-start">
      <h2>Install</h2>
      <Code>{INSTALL}</Code>
      <h2>Quick start</h2>
      <div className="tabs" role="tablist">
        {(["react", "native", "svg"] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t === "react" ? "React" : t === "native" ? "React Native" : "Plain SVG"}
          </button>
        ))}
      </div>
      <Code>{code}</Code>
      <p className="note">
        {tab === "react" && "agentfaces/react is a client component. It drives every face on the page from one shared requestAnimationFrame ticker and pauses faces that scroll out of view."}
        {tab === "native" && "agentfaces/react-native renders with react-native-svg and the built-in Animated API. No reanimated needed. The body runs on the native driver."}
        {tab === "svg" && "agentfaces/svg returns a static SVG string. Use it on the server, in emails, in Vue or Svelte, or anywhere you can place markup."}
      </p>
    </section>
  );
}

function Playground() {
  const [state, setState] = useState<AgentState>("working");
  const [shape, setShape] = useState<ShapeName>("circle");
  const [color, setColor] = useState("#2F6BFF");
  const [expression, setExpression] = useState<ExpressionName | "">("");
  const [size, setSize] = useState(160);
  const [variant, setVariant] = useState<"live" | "still">("live");
  const [mouth, setMouth] = useState(true);
  const [reduced, setReduced] = useState<"" | "on" | "off">("");
  const code = useMemo(() => {
    const props = [`state="${state}"`, `shape="${shape}"`, `color="${color}"`, `size={${size}}`];
    if (expression) props.push(`expression="${expression}"`);
    if (variant === "still") props.push(`variant="still"`);
    if (!mouth) props.push("mouth={false}");
    if (reduced) props.push(`reducedMotion={${reduced === "on"}}`);
    return `<AgentFace ${props.join(" ")} />`;
  }, [state, shape, color, expression, size, variant, mouth, reduced]);
  const svg = useMemo(() => renderFaceSvg({ shape, color, state, expression: expression || undefined, size, mouth }), [shape, color, state, expression, size, mouth]);
  return (
    <section id="playground">
      <h2>Playground</h2>
      <div className="playground">
        <div className="stage">
          <AgentFace key={`${variant}-${reduced}`} state={state} shape={shape} color={color} size={size} expression={expression || undefined} variant={variant} mouth={mouth} reducedMotion={reduced ? reduced === "on" : undefined} seed="playground" />
        </div>
        <div className="controls">
          <label>
            State
            <select value={state} onChange={(e) => setState(e.target.value as AgentState)}>
              {AGENT_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Expression
            <select value={expression} onChange={(e) => setExpression(e.target.value as ExpressionName | "")}>
              <option value="">cycle the state's expressions</option>
              {EXPRESSION_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Shape</legend>
            <div className="segmented">
              {SHAPE_NAMES.map((s) => (
                <button key={s} type="button" aria-pressed={shape === s} className={shape === s ? "active" : ""} onClick={() => setShape(s)}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Color</legend>
            <div className="swatches">
              {DEFAULT_PALETTE.map((c) => (
                <button key={c} type="button" aria-label={c} aria-pressed={color === c} className={color === c ? "swatch active" : "swatch"} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
              <input type="color" aria-label="Custom color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} />
            </div>
          </fieldset>
          <label>
            Size: {size}px
            <input type="range" min={20} max={240} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </label>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={variant === "still"} onChange={(e) => setVariant(e.target.checked ? "still" : "live")} /> Still
            </label>
            <label className="check">
              <input type="checkbox" checked={mouth} onChange={(e) => setMouth(e.target.checked)} /> Mouth
            </label>
            <label>
              Reduced motion
              <select value={reduced} onChange={(e) => setReduced(e.target.value as "" | "on" | "off")}>
                <option value="">follow OS</option>
                <option value="on">on</option>
                <option value="off">off</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <Code>{code}</Code>
      <details>
        <summary>Static SVG for this face</summary>
        <Code>{svg}</Code>
      </details>
    </section>
  );
}

function Gallery() {
  const groups = [
    { title: "Core work states", states: CORE_STATES },
    { title: "Extended states", states: EXTENDED_STATES },
    { title: "Ornament states", states: ORNAMENT_STATES },
    { title: "Voice states", states: VOICE_STATES },
  ];
  return (
    <section id="states">
      <h2>States</h2>
      <p>Each state sets the body motion, a pool of expressions the face moves through, and the accessible name. Alert, needs you and done morph the whole body into a mark and back. Celebrate throws confetti.</p>
      {groups.map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          <div className="grid">
            {group.states.map((state, i) => (
              <figure key={state}>
                <AgentFace state={state} shape={SHAPE_NAMES[i % 3]} color={DEFAULT_PALETTE[(i * 2 + 1) % DEFAULT_PALETTE.length]} size={80} seed={state} />
                <figcaption>
                  <code>{state}</code>
                  <span>{STATE_LABEL[state]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
      <h2 id="expressions">Expressions</h2>
      <p>Pass any of these as <code>expression</code> to hold it. Smitten morphs into a heart.</p>
      <div className="grid small">
        {EXPRESSION_NAMES.map((name, i) => (
          <figure key={name}>
            <AgentFace expression={name} shape={SHAPE_NAMES[i % 3]} color={DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]} size={64} variant="still" label={name} />
            <figcaption>
              <code>{name}</code>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

type VoiceTab = "react" | "livekit" | "openai" | "elevenlabs" | "native";

const VOICE_TABS: Array<[VoiceTab, string, string, string]> = [
  ["react", "React", VOICE_REACT, "useAudioLevel turns a MediaStream, AudioNode, media element, level callback or level stream into a smoothed level. Every face reads it from the shared ticker."],
  ["livekit", "LiveKit", VOICE_LIVEKIT, "liveKitFace maps the agent state from useVoiceAssistant to a face state and uses the agent's audio track while speaking. Pass { microphone } to pulse with the user while listening."],
  ["openai", "OpenAI Realtime", VOICE_OPENAI, "bindRealtimeSession follows Realtime events: speech started is listening, a response is thinking, tool calls are working, output audio is speaking. Over WebRTC, pass the audio element as audio."],
  ["elevenlabs", "ElevenLabs", VOICE_ELEVENLABS, "elevenLabsFace maps status and mode to a face state and reads the conversation's input or output volume and frequency data each frame."],
  ["native", "React Native", VOICE_NATIVE, "React Native has no Web Audio, so pass a level callback or push numbers into createLevelFeed from your recorder or player meter."],
];

function Voice() {
  const [tab, setTab] = useState<VoiceTab>("react");
  const current = VOICE_TABS.find(([id]) => id === tab)!;
  return (
    <section id="voice">
      <h2>Voice agents</h2>
      <p>
        Two states for voice: <code>listening</code> leans in, holds its gaze on you and pulses with your voice, and <code>speaking</code> moves its mouth with the agent's audio, opening with loudness and spreading or rounding with the sound. Pass audio as <code>audio</code>. Until you connect audio, speaking is simulated: the mouth follows a built-in synthetic voice that is not in sync with anything. Pass <code>audio={"{null}"}</code> to hold the mouth still. Under reduced motion and in the still variant the face rests and no audio is read.
      </p>
      <VoiceDemos />
      <div className="tabs" role="tablist">
        {VOICE_TABS.map(([id, title]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
            {title}
          </button>
        ))}
      </div>
      <Code>{current[2]}</Code>
      <p className="note">{current[3]}</p>
    </section>
  );
}

const PROPS: Array<[string, string, string, string]> = [
  ["state", "AgentState", '"idle"', "What the agent is doing. Drives motion, expressions, glyph morphs and the accessible name."],
  ["shape", '"circle" | "triangle" | "square"', "from seed", "Body shape."],
  ["color", "string", "from seed", "Body color as a hex string."],
  ["seed", "string", '""', "Stable id that picks shape and color and seeds blinks, gaze and expression timing."],
  ["size", "number", "48", "Rendered size in pixels (points on native)."],
  ["expression", "ExpressionName", "cycles", "Holds one expression instead of cycling through the state's pool."],
  ["variant", '"live" | "still"', '"live"', "Still renders a single frame with no timers or ticker subscription."],
  ["mouth", "boolean", "true", "Draws the mouth."],
  ["label", "string", "state name", "Full accessible name."],
  ["name", "string", "", 'Agent name. The accessible name becomes "name, state".'],
  ["decorative", "boolean", "false", "Hides the face from assistive technology."],
  ["reducedMotion", "boolean", "OS setting", "Force reduced motion on or off. Reduced motion renders a resting face with no blinks, morphs, confetti or audio-driven motion."],
  ["audio", "AudioLevelSource | null", "simulated when speaking", "Audio for listening and speaking: a MediaStream, AudioNode, HTMLMediaElement, level callback, level stream or AudioLevel. React Native takes callbacks, streams and levels. Without it, speaking is simulated with a synthetic voice. null holds the mouth still."],
  ["className, style", "", "", "Web only. Applied to the wrapping span."],
];

const EXAMPLES: Array<[string, string, string]> = [
  ["Vercel AI SDK chat", `${GITHUB}/tree/main/examples/vercel-ai-sdk`, "A Next.js chat that maps useChat status and tool calls to face states: submitted is thinking, streaming is typing, a running tool is working, an approval is needs you, a reply is done and an error is alert."],
  ["React Native with Expo", `${GITHUB}/tree/main/examples/react-native-expo`, "One screen that switches a face between the core states, plus a row of seeded faces. Only react-native-svg is needed."],
];

function Examples() {
  return (
    <section id="examples">
      <h2>Examples</h2>
      <ul>
        {EXAMPLES.map(([title, href, description]) => (
          <li key={title}>
            <a href={href}>{title}</a>: {description}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Api() {
  return (
    <section id="api">
      <h2>API reference</h2>
      <h3>
        <code>{"<AgentFace />"}</code>
      </h3>
      <p>
        Same props on <code>agentfaces/react</code> and <code>agentfaces/react-native</code>.
      </p>
      <div className="table">
        <table>
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {PROPS.map(([prop, type, def, desc]) => (
              <tr key={prop}>
                <td>
                  <code>{prop}</code>
                </td>
                <td>
                  <code>{type}</code>
                </td>
                <td>{def}</td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>
        <code>{"<AgentFacesProvider />"}</code>
      </h3>
      <p>
        Sets defaults for every face below it: <code>shapes</code>, <code>palette</code>, <code>size</code>, <code>variant</code>, <code>mouth</code>, <code>reducedMotion</code> and <code>labels</code> (to translate state names). Providers nest and merge.
      </p>
      <Code>{PROVIDER}</Code>
      <h3>
        <code>faceFor(seed, options)</code>
      </h3>
      <p>Deterministically picks a shape and color for a seed, so the same agent always looks the same.</p>
      <Code>{FACE_FOR}</Code>
      <h3>
        <code>agentfaces/svg</code>
      </h3>
      <ul>
        <li>
          <code>renderFaceSvg(options)</code> returns an SVG string. Options: <code>shape</code>, <code>color</code>, <code>state</code>, <code>expression</code>, <code>size</code>, <code>mouth</code>, <code>label</code>, <code>decorative</code>, <code>pose</code>, <code>idPrefix</code>.
        </li>
        <li>
          <code>buildFaceSet(shape, color)</code> returns every state and expression as files, a <code>sprite.svg</code> of symbols and a manifest. Bodies default to <code>currentColor</code>.
        </li>
      </ul>
      <h3>Voice</h3>
      <ul>
        <li>
          <code>createAudioLevel(source, options)</code> returns an <code>AudioLevel</code> with <code>value</code>, <code>bands</code>, <code>update(now)</code> and <code>close()</code>. Options: <code>attack</code>, <code>release</code>, <code>gain</code>, <code>floorDb</code>, <code>ceilingDb</code>, <code>bands</code>, <code>context</code>. It never schedules work of its own.
        </li>
        <li>
          <code>mouthForLevel(level, bands)</code> maps a level and optional low, mid and high bands to mouth openness and width. <code>MouthModel</code> adds attack and release smoothing.
        </li>
        <li>
          <code>createLevelFeed()</code> is a numeric stream you push into. <code>createSyntheticVoice(seed)</code> is a seeded speech-like level for demos and tests.
        </li>
        <li>
          Adapters: <code>agentfaces/livekit</code>, <code>agentfaces/openai-realtime</code> and <code>agentfaces/elevenlabs</code>. Each is a separate entry with no runtime dependencies.
        </li>
      </ul>
      <h3>
        Core: <code>agentfaces</code>
      </h3>
      <p>
        Framework-free building blocks with zero dependencies: <code>AGENT_STATES</code>, <code>EXPRESSION_NAMES</code>, <code>STATE_LABEL</code>, <code>STATE_MOTION</code>, <code>EXPRESSIONS</code>, <code>faceGeometry</code>, <code>anchorForSize</code>, <code>Director</code>, <code>Performer</code>, <code>BodyPerformer</code>, <code>GlyphPerformer</code>, <code>createTicker</code>, <code>morphPath</code>, <code>placementVariant</code> and more. Use them to build a renderer for another framework.
      </p>
    </section>
  );
}

export function App() {
  return (
    <>
      <nav className="nav">
        <a href="#top" className="brand">
          <AgentFace shape="circle" color="#2B90FF" expression="glad" size={28} variant="still" decorative />
          agentfaces
        </a>
        <div>
          <a href="#quick-start">Quick start</a>
          <a href="#playground">Playground</a>
          <a href="#voice">Voice</a>
          <a href="#states">States</a>
          <a href="#examples">Examples</a>
          <a href="#api">API</a>
          <a href={GITHUB}>GitHub</a>
        </div>
      </nav>
      <main id="top">
        <Hero />
        <QuickStart />
        <Playground />
        <Voice />
        <Gallery />
        <Examples />
        <Api />
      </main>
      <footer>
        MIT licensed. Created by Hammed Ajibade. Built at Specvista.
      </footer>
    </>
  );
}
