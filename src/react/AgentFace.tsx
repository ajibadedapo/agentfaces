import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  anchorForSize,
  animationFrameDriver,
  BodyPerformer,
  CONFETTI_BURST_SHARE,
  CONFETTI_FADE_SHARE,
  CONFETTI_FALL,
  CONFETTI_MID_SHARE,
  CONFETTI_MID_SWAY,
  CONFETTI_MID_Y,
  CONFETTI_ORIGIN,
  CONFETTI_PIECES,
  CONFETTI_SIZES,
  confettiColor,
  createTicker,
  EXPRESSION_GLYPH,
  EXPRESSIONS,
  FACE_COLORS,
  faceGeometry,
  glyphAnchor,
  isVoiceState,
  MouthModel,
  glyphKindsFor,
  GlyphPerformer,
  MOUTH_OFFSET_Y,
  Performer,
  REST_BODY,
  restExpression,
  SHAPE_BOUNDS,
  SHAPE_PATHS,
  STATE_CONFETTI,
  STATE_EXPRESSIONS,
  STATE_GLYPH,
  STATE_MOTION,
  STATE_ORNAMENT,
  type AgentState,
  type AudioLevelSource,
  type BodyPose,
  type ConfettiPiece,
  type EyeGeometry,
  type ExpressionName,
  type FaceGeometry,
  type GlyphFrame,
  type OrnamentKind,
  type ShapeName,
  warmMorphs,
} from "agentfaces";
import { resolveFace, useAgentFacesTheme } from "../shared/theme";
import { useFaceLevel } from "../shared/audio";

export interface AgentFaceProps {
  /** What the agent is doing. Drives motion, expressions, glyph morphs and the accessible name. */
  state?: AgentState;
  /** Body shape. Picked from the seed when omitted. */
  shape?: ShapeName;
  /** Body color as a hex string. Picked from the seed when omitted. */
  color?: string;
  /** Stable id (for example a user or agent id) that picks shape and color and seeds the motion. */
  seed?: string;
  /** Rendered size in pixels. Defaults to 48. */
  size?: number;
  /** Holds one expression instead of cycling through the state's expressions. */
  expression?: ExpressionName;
  /** "live" animates, "still" renders a single frame with no timers. */
  variant?: "live" | "still";
  /** Draws the mouth. Defaults to true. */
  mouth?: boolean;
  /** Full accessible name. Defaults to the state name, or "name, state" when name is set. */
  label?: string;
  /** Agent name used to build the accessible name, for example "Ada, Working". */
  name?: string;
  /** Hides the face from assistive technology. */
  decorative?: boolean;
  /** Forces reduced motion on or off. Follows the OS setting when unset. */
  reducedMotion?: boolean;
  /**
   * Audio for the voice states: the user's input while listening, the agent's output while speaking.
   * A MediaStream, AudioNode, HTMLMediaElement, level callback, level stream or AudioLevel.
   * Until audio is connected, speaking is simulated: the mouth follows a synthetic voice. Pass null to hold the mouth still.
   */
  audio?: AudioLevelSource | null;
  className?: string;
  style?: CSSProperties;
}

const pct = (share: number) => `${(share * 100).toFixed(2)}%`;

export const webTicker = createTicker(animationFrameDriver());

export const AGENTFACES_CSS = `@keyframes af-spin{to{transform:rotate(360deg)}}@keyframes af-ring{0%{transform:scale(.72);opacity:.6}100%{transform:scale(1.04);opacity:0}}@keyframes af-dot{0%,100%{transform:translateY(0)}40%{transform:translateY(-4px)}}@keyframes af-confetti{0%{transform:translate(0,0) rotate(0) scale(.2);opacity:0;animation-timing-function:cubic-bezier(.2,.7,.3,1)}${pct(CONFETTI_BURST_SHARE)}{transform:translate(var(--af-cx),var(--af-cy)) rotate(calc(var(--af-spin) * .25)) scale(1);opacity:1;animation-timing-function:cubic-bezier(.4,0,.9,.5)}${pct(CONFETTI_MID_SHARE)}{transform:translate(calc(var(--af-cx) + var(--af-sway) * ${CONFETTI_MID_SWAY}),${CONFETTI_MID_Y - CONFETTI_ORIGIN.y}px) rotate(calc(var(--af-spin) * .6)) scale(1);opacity:1;animation-timing-function:cubic-bezier(.3,0,.8,.7)}${pct(CONFETTI_FADE_SHARE)}{opacity:1}100%{transform:translate(calc(var(--af-cx) + var(--af-sway)),${CONFETTI_FALL - CONFETTI_ORIGIN.y}px) rotate(var(--af-spin)) scale(.9);opacity:0}}.af-spin{transform-box:view-box;transform-origin:50px 50px;animation:af-spin 1.6s linear infinite}.af-ring{transform-box:view-box;transform-origin:50px 50px;animation:af-ring 1.8s ease-out infinite}.af-ring--late{animation-delay:.9s}.af-dot{animation:af-dot .9s ease-in-out infinite}.af-dot--mid{animation-delay:.15s}.af-dot--late{animation-delay:.3s}.af-confetti{transform-box:fill-box;transform-origin:center;animation:af-confetti var(--af-dur,2s) linear infinite;animation-delay:var(--af-delay,0s)}@media (prefers-reduced-motion: reduce){.af-spin,.af-ring,.af-dot,.af-confetti{animation:none}}`;

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
const ORNAMENT_SCALE = 0.8;

const visibilityHandlers = new Map<Element, (visible: boolean) => void>();
let visibilityObserver: IntersectionObserver | null = null;

function watchVisibility(element: Element, onChange: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === "undefined") return () => {};
  if (!visibilityObserver) {
    visibilityObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) visibilityHandlers.get(entry.target)?.(entry.isIntersecting);
    });
  }
  visibilityHandlers.set(element, onChange);
  visibilityObserver.observe(element);
  return () => {
    visibilityHandlers.delete(element);
    visibilityObserver?.unobserve(element);
  };
}

const n = (v: number) => {
  const s = v.toFixed(2);
  return s === "-0.00" ? "0.00" : s;
};

const eyeTransform = (eye: EyeGeometry) => `translate(${n(eye.cx)} ${n(eye.cy)}) rotate(${n(eye.rotate)}) scale(1 ${n(eye.scaleY)})`;

function bodyTransform(pose: BodyPose, bottom: number, scale: number): string {
  const parts = [`translate(${n(pose.x)} ${n(pose.y)})`, `rotate(${n(pose.rotate)} 50 50)`, `translate(50 ${n(bottom)})`, `scale(${n(pose.scaleX * scale)} ${n(pose.scaleY * scale)})`, `translate(-50 ${n(-bottom)})`];
  return parts.join(" ");
}

function Eye({ eye, clipId }: { eye: EyeGeometry; clipId: string }) {
  return (
    <g data-af-part="eye" transform={eyeTransform(eye)}>
      <clipPath id={clipId}>
        <path data-af-part="aperture" d={eye.aperture} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <path data-af-part="sclera" d={eye.sclera} fill={eye.scleraFill} />
        <circle data-af-part="pupil" cx={n(eye.pupil.cx)} cy={n(eye.pupil.cy)} r={n(eye.pupil.r)} fill={FACE_COLORS.pupil} opacity={n(eye.pupil.opacity)} />
        <circle data-af-part="glint" cx={n(eye.glint.cx)} cy={n(eye.glint.cy)} r={n(eye.glint.r)} fill={FACE_COLORS.glint} opacity={n(eye.glint.opacity)} />
      </g>
    </g>
  );
}

function Face({ geometry, clipIds, mouth }: { geometry: FaceGeometry; clipIds: [string, string]; mouth: boolean }) {
  const blush = geometry.blush;
  return (
    <>
      <g data-af-part="blush" opacity={n(blush.opacity)}>
        <ellipse data-af-part="blush-left" cx={n(blush.left.cx)} cy={n(blush.left.cy)} rx={n(blush.left.rx)} ry={n(blush.left.ry)} fill={FACE_COLORS.blush} />
        <ellipse data-af-part="blush-right" cx={n(blush.right.cx)} cy={n(blush.right.cy)} rx={n(blush.right.rx)} ry={n(blush.right.ry)} fill={FACE_COLORS.blush} />
      </g>
      <Eye eye={geometry.left} clipId={clipIds[0]} />
      <Eye eye={geometry.right} clipId={clipIds[1]} />
      {mouth ? (
        <path data-af-part="mouth" d={geometry.mouth.d} fill={FACE_COLORS.mouth} stroke={FACE_COLORS.mouth} strokeWidth={n(geometry.mouth.stroke)} strokeLinejoin="round" strokeLinecap="round" opacity={n(geometry.mouth.opacity)} />
      ) : null}
    </>
  );
}

function Ornament({ kind, color, anchorY }: { kind: OrnamentKind; color: string; anchorY: number }) {
  switch (kind) {
    case "tracker":
      return (
        <g data-af-ornament="tracker">
          <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="1.2" opacity="0.28" />
          <g className="af-spin">
            <circle cx="50" cy="4" r="3.6" fill={color} />
          </g>
        </g>
      );
    case "ripple":
      return (
        <g data-af-ornament="ripple">
          <circle className="af-ring" cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="1.6" />
          <circle className="af-ring af-ring--late" cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="1.6" />
        </g>
      );
    case "spinner":
      return (
        <g data-af-ornament="spinner">
          <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="3" opacity="0.18" />
          <circle className="af-spin" cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="72 217" />
        </g>
      );
    case "typing":
      return (
        <g data-af-ornament="typing" fill={FACE_COLORS.sclera}>
          <circle className="af-dot" cx="39" cy={n(anchorY)} r="3.6" />
          <circle className="af-dot af-dot--mid" cx="50" cy={n(anchorY)} r="3.6" />
          <circle className="af-dot af-dot--late" cx="61" cy={n(anchorY)} r="3.6" />
        </g>
      );
  }
}

function ConfettiShape({ piece, color }: { piece: ConfettiPiece; color: string }) {
  const { x, y } = CONFETTI_ORIGIN;
  switch (piece.kind) {
    case "strip":
      return <rect x={n(x - CONFETTI_SIZES.strip.w / 2)} y={n(y - CONFETTI_SIZES.strip.h / 2)} width={CONFETTI_SIZES.strip.w} height={CONFETTI_SIZES.strip.h} rx={n(CONFETTI_SIZES.strip.w / 2)} fill={color} />;
    case "square":
      return <rect x={n(x - CONFETTI_SIZES.square / 2)} y={n(y - CONFETTI_SIZES.square / 2)} width={CONFETTI_SIZES.square} height={CONFETTI_SIZES.square} rx="0.8" fill={color} />;
    case "dot":
      return <circle cx={x} cy={y} r={CONFETTI_SIZES.dot} fill={color} />;
    case "ring":
      return <circle cx={x} cy={y} r={CONFETTI_SIZES.ring.r} fill="none" stroke={color} strokeWidth={CONFETTI_SIZES.ring.stroke} />;
    case "tri":
      return <path d={`M ${n(x)} ${n(y - CONFETTI_SIZES.tri.h * 0.6)} L ${n(x + CONFETTI_SIZES.tri.w / 2)} ${n(y + CONFETTI_SIZES.tri.h * 0.4)} L ${n(x - CONFETTI_SIZES.tri.w / 2)} ${n(y + CONFETTI_SIZES.tri.h * 0.4)} Z`} fill={color} />;
  }
}

function Confetti({ bodyColor, palette }: { bodyColor: string; palette: readonly string[] }) {
  return (
    <g data-af-confetti="">
      {CONFETTI_PIECES.map((piece, i) => (
        <g key={i} className="af-confetti" data-af-confetti-kind={piece.kind} style={{ "--af-cx": `${piece.x}px`, "--af-cy": `${piece.y}px`, "--af-sway": `${piece.sway}px`, "--af-spin": `${piece.spin}deg`, "--af-dur": `${piece.duration}ms`, "--af-delay": `${piece.delay}ms` } as CSSProperties}>
          <ConfettiShape piece={piece} color={confettiColor(piece, bodyColor, palette)} />
        </g>
      ))}
    </g>
  );
}

interface Parts {
  eyes: Array<{ group: Element; aperture: Element; sclera: Element; pupil: Element; glint: Element }>;
  mouth: Element | null;
  blush: Element | null;
  blushLeft: Element | null;
  blushRight: Element | null;
  body: Element | null;
  shape: Element | null;
  face: Element | null;
  glyphDot: Element | null;
}

function collectParts(root: Element): Parts {
  const q = (sel: string) => root.querySelector(`[data-af-part='${sel}']`);
  const eyes = Array.from(root.querySelectorAll("[data-af-part='eye']")).map((group) => ({
    group,
    aperture: group.querySelector("[data-af-part='aperture']")!,
    sclera: group.querySelector("[data-af-part='sclera']")!,
    pupil: group.querySelector("[data-af-part='pupil']")!,
    glint: group.querySelector("[data-af-part='glint']")!,
  }));
  return { eyes, mouth: q("mouth"), blush: q("blush"), blushLeft: q("blush-left"), blushRight: q("blush-right"), body: q("body"), shape: q("shape"), face: root.querySelector("[data-af-face]"), glyphDot: q("glyph-dot") };
}

function paintGlyph(parts: Parts, frame: GlyphFrame, bodyPath: string) {
  parts.shape?.setAttribute("d", frame.path ?? bodyPath);
  parts.face?.setAttribute("opacity", n(frame.faceOpacity));
  if (parts.glyphDot) {
    parts.glyphDot.setAttribute("r", n(frame.dot?.r ?? 0));
    if (frame.dot) {
      parts.glyphDot.setAttribute("cx", n(frame.dot.cx));
      parts.glyphDot.setAttribute("cy", n(frame.dot.cy));
    }
  }
  if (parts.body) {
    if (frame.t > 0.001) parts.body.setAttribute("data-af-glyph", frame.kind);
    else parts.body.removeAttribute("data-af-glyph");
  }
}

function paintFace(parts: Parts, g: FaceGeometry) {
  const sides = [g.left, g.right];
  parts.eyes.forEach((part, i) => {
    const eye = sides[i];
    part.group.setAttribute("transform", eyeTransform(eye));
    part.sclera.setAttribute("d", eye.sclera);
    part.sclera.setAttribute("fill", eye.scleraFill);
    part.pupil.setAttribute("cx", n(eye.pupil.cx));
    part.pupil.setAttribute("cy", n(eye.pupil.cy));
    part.pupil.setAttribute("r", n(eye.pupil.r));
    part.pupil.setAttribute("opacity", n(eye.pupil.opacity));
    part.glint.setAttribute("cx", n(eye.glint.cx));
    part.glint.setAttribute("cy", n(eye.glint.cy));
    part.glint.setAttribute("r", n(eye.glint.r));
    part.glint.setAttribute("opacity", n(eye.glint.opacity));
    part.aperture.setAttribute("d", eye.aperture);
  });
  if (parts.mouth) {
    parts.mouth.setAttribute("d", g.mouth.d);
    parts.mouth.setAttribute("opacity", n(g.mouth.opacity));
  }
  parts.blush?.setAttribute("opacity", n(g.blush.opacity));
  parts.blushLeft?.setAttribute("cx", n(g.blush.left.cx));
  parts.blushRight?.setAttribute("cx", n(g.blush.right.cx));
}

function paintBody(parts: Parts, pose: BodyPose, bottom: number, scale: number) {
  parts.body?.setAttribute("transform", bodyTransform(pose, bottom, scale));
}

function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(REDUCED_QUERY);
}

function usePrefersReducedMotion(enabled: boolean): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = enabled ? reducedMotionQuery() : null;
    if (!query) return;
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, [enabled]);
  return reduced;
}

const ROOT_STYLE: CSSProperties = { display: "inline-block", transformOrigin: "50% 90%", lineHeight: 0 };
const SVG_STYLE: CSSProperties = { display: "block", overflow: "visible" };

export function AgentFace(props: AgentFaceProps) {
  const theme = useAgentFacesTheme();
  const face = resolveFace(props, theme);
  const { state, shape: finalShape, color: finalColor, seed, size, variant, mouth, accessibleName, reducedMotion, palette } = face;
  const { expression, decorative = false, className, style } = props;
  const prefersReduced = usePrefersReducedMotion(variant === "live" && reducedMotion === undefined);
  const live = variant === "live" && !(reducedMotion ?? prefersReduced);
  const ornament = STATE_ORNAMENT[state];
  const showOrnament = live && ornament !== undefined;
  const showMouth = mouth && !(showOrnament && ornament === "typing");
  const resting = expression ?? restExpression(state);
  const anchor = useMemo(() => anchorForSize(finalShape, size), [finalShape, size]);
  const glyphCapable = live && (STATE_GLYPH[state] !== undefined || (expression ? EXPRESSION_GLYPH[expression] !== undefined : STATE_EXPRESSIONS[state].pool.some((name) => EXPRESSION_GLYPH[name] !== undefined)));
  const seedKey = seed;
  const restingGeometry = faceGeometry(EXPRESSIONS[resting], anchor);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const clipIds: [string, string] = [`af${rawId}el`, `af${rawId}er`];
  const rootRef = useRef<SVGSVGElement>(null);
  const performerRef = useRef<{ key: string; performer: Performer; body: BodyPerformer; glyph: GlyphPerformer } | null>(null);
  const paintedRef = useRef<{ key: string; geometry: FaceGeometry } | null>(null);
  if (!live || paintedRef.current?.key !== seedKey) paintedRef.current = { key: seedKey, geometry: restingGeometry };
  const geometry = paintedRef.current.geometry;
  const bottom = SHAPE_BOUNDS[finalShape].maxY;
  const ornamentScale = showOrnament && ornament !== "typing" ? ORNAMENT_SCALE : 1;
  const spec = STATE_MOTION[state];
  const confetti = live && STATE_CONFETTI[state] === true;
  const voice = isVoiceState(state);
  const levelRef = useFaceLevel(live && voice && !(reducedMotion === undefined && reducedMotionQuery()?.matches === true), state === "speaking", props.audio, seedKey);

  useEffect(() => {
    if (!live) return;
    if (reducedMotion === undefined && reducedMotionQuery()?.matches) return;
    const root = rootRef.current;
    if (!root) return;
    if (performerRef.current?.key !== seedKey) {
      performerRef.current = { key: seedKey, performer: new Performer(seedKey, anchor, { state, expression: expression ?? null }), body: new BodyPerformer(seedKey, spec.kind, spec.duration, spec.loop), glyph: new GlyphPerformer(finalShape, state) };
    }
    const { performer, body, glyph } = performerRef.current;
    performer.setAnchor(anchor);
    performer.set({ state, expression: expression ?? null });
    body.set(spec.kind, spec.duration, spec.loop);
    body.setShape(finalShape);
    glyph.set(finalShape, state);
    const bodyPath = SHAPE_PATHS[finalShape];
    const parts = collectParts(root);
    let riding = false;
    const mouthModel = new MouthModel();
    let off: (() => void) | null = null;
    let paused = false;
    const start = () => {
      if (off) return;
      const resume = paused;
      off = webTicker.subscribe((now, dt) => {
        if (resume && paused) {
          paused = false;
          performer.resume(now);
        }
        const frame = glyphCapable ? glyph.update(now, dt, performer.director.expression) : null;
        if (frame && frame.t > 0) {
          performer.setAnchor(glyphAnchor(anchor, frame.kind, frame.t));
          riding = true;
        } else if (riding) {
          performer.setAnchor(anchor);
          riding = false;
        }
        const level = voice ? levelRef.current : null;
        const amount = level ? level.update(now) : 0;
        performer.setVoice(voice ? { state, level: amount, mouth: level && state === "speaking" ? mouthModel.update(amount, level.bands, dt) : null } : null);
        const painted = performer.update(now, dt);
        const pose = body.update(now, dt, amount);
        return () => {
          if (painted) paintFace(parts, painted);
          paintBody(parts, pose, bottom, ornamentScale);
          if (frame) paintGlyph(parts, frame, bodyPath);
        };
      });
    };
    const stop = () => {
      if (!off) return;
      off();
      off = null;
      paused = true;
    };
    const unwatch = watchVisibility(root, (visible) => (visible ? start() : stop()));
    const unwarm = glyphCapable ? warmMorphs(finalShape, glyphKindsFor(state, STATE_EXPRESSIONS[state].pool, expression)) : null;
    start();
    return () => {
      unwatch();
      unwarm?.();
      stop();
    };
  }, [live, reducedMotion, seedKey, state, expression, anchor, showMouth, bottom, ornamentScale, spec, finalShape, glyphCapable, voice]);

  return (
    <span
      className={className}
      data-agentface=""
      data-af-variant={live ? "live" : "still"}
      data-af-state={state}
      data-af-motion={live ? spec.kind : undefined}
      data-af-expression={resting}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : accessibleName}
      aria-hidden={decorative ? true : undefined}
      style={{ ...ROOT_STYLE, width: size, height: size, ...style }}
    >
      <svg ref={rootRef} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false" style={SVG_STYLE}>
        {showOrnament || confetti ? <style>{AGENTFACES_CSS}</style> : null}
        {showOrnament && ornament !== "typing" ? <Ornament kind={ornament} color={finalColor} anchorY={anchor.cy} /> : null}
        <g data-af-part="body" transform={ornamentScale === 1 ? undefined : bodyTransform(REST_BODY, bottom, ornamentScale)}>
          <path data-af-part="shape" d={SHAPE_PATHS[finalShape]} fill={finalColor} />
          {glyphCapable ? <circle data-af-part="glyph-dot" cx="50" cy="50" r="0" fill={finalColor} /> : null}
          <g data-af-face="">
            <Face geometry={geometry} clipIds={clipIds} mouth={showMouth} />
          </g>
          {showOrnament && ornament === "typing" ? <Ornament kind="typing" color={finalColor} anchorY={anchor.cy + MOUTH_OFFSET_Y * anchor.scale} /> : null}
        </g>
        {confetti ? <Confetti bodyColor={finalColor} palette={palette} /> : null}
      </svg>
    </span>
  );
}
