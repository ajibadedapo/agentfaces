import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path } from "react-native-svg";
import {
  anchorForSize,
  BLINK_CLOSE_SHARE,
  BLINK_SQUASH,
  BODY_SPRINGS,
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
  Director,
  EXPRESSION_GLYPH,
  EXPRESSIONS,
  FACE_COLORS,
  FACE_SPRING,
  faceGeometry,
  GAZE_DRIFT,
  GAZE_SPRING,
  GLINT,
  GLYPH_FACE_FADE,
  GLYPH_SCHEDULE,
  GLYPH_SPRING,
  glyphDotStops,
  glyphKindsFor,
  GLYPHS,
  HEAD_FOLLOW,
  applyVoice,
  isVoiceState,
  LEAN,
  LEAN_TILT,
  MouthModel,
  TALK,
  VOICE_MOUTH,
  morphKeyframes,
  MOUTH_OFFSET_Y,
  restExpression,
  SACCADE_SPRING,
  SHAPE_BOUNDS,
  SHAPE_PATHS,
  STATE_CONFETTI,
  STATE_GLYPH,
  STATE_ORNAMENT,
  STATE_MOTION,
  TURN_EYE_SCALE,
  TURN_SHIFT,
  TURN_SPRING,
  type AgentState,
  type AudioLevel,
  type LevelCallback,
  type LevelStream,
  type MotionKind,
  type ConfettiPiece,
  type Cue,
  type EyeGeometry,
  type ExpressionName,
  type FaceAnchor,
  type FaceGeometry,
  type FaceParams,
  type GlyphKind,
  type OrnamentKind,
  type ShapeName,
  type SpringConfig,
  STATE_EXPRESSIONS,
  warmMorphs,
} from "agentfaces";
import { resolveFace, useAgentFacesTheme } from "../shared/theme";
import { useFaceLevel } from "../shared/audio";
import { NATIVE_TICK_MS, nativeTicker } from "./ticker";
import { useReducedMotion } from "./useReducedMotion";

export interface AgentFaceProps {
  /** What the agent is doing. Drives motion, expressions, glyph morphs and the accessible name. */
  state?: AgentState;
  /** Body shape. Picked from the seed when omitted. */
  shape?: ShapeName;
  /** Body color as a hex string. Picked from the seed when omitted. */
  color?: string;
  /** Stable id (for example a user or agent id) that picks shape and color and seeds the motion. */
  seed?: string;
  /** Rendered size in points. Defaults to 48. */
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
   * Audio level for the voice states: a level callback, a level stream (see createLevelFeed) or an AudioLevel.
   * React Native has no Web Audio, so feed it from your audio library's meter. Until audio is connected,
   * speaking is simulated: the mouth follows a synthetic voice. Pass null to hold the mouth still.
   */
  audio?: NativeAudioSource | null;
  testID?: string;
}

export type NativeAudioSource = LevelCallback | LevelStream | AudioLevel;

const VOICE_OPEN_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const ORNAMENT_SCALE = 0.8;

const js = (config: SpringConfig) => ({ stiffness: config.stiffness, damping: config.damping, mass: 1, useNativeDriver: false }) as const;
const native = (config: SpringConfig) => ({ stiffness: config.stiffness, damping: config.damping, mass: 1, useNativeDriver: true }) as const;

interface BodyValues {
  lift: Animated.Value;
  sway: Animated.Value;
  rotate: Animated.Value;
  scale: Animated.Value;
  squash: Animated.Value;
  turn: Animated.Value;
}

function useBodyValues(): BodyValues {
  return useRef<BodyValues>({ lift: new Animated.Value(0), sway: new Animated.Value(0), rotate: new Animated.Value(0), scale: new Animated.Value(1), squash: new Animated.Value(0), turn: new Animated.Value(0) }).current;
}

function bodyMotion(kind: MotionKind, duration: number, loop: boolean, v: BodyValues, turnJs: Animated.Value, shape: ShapeName): Animated.CompositeAnimation {
  const spring = (value: Animated.Value, toValue: number, config: SpringConfig, driver = true) => Animated.spring(value, { toValue, ...(driver ? native(config) : js(config)) });
  const timing = (value: Animated.Value, toValue: number, ms: number, easing = Easing.inOut(Easing.sin)) => Animated.timing(value, { toValue, duration: ms, easing, useNativeDriver: true });
  const hop = (height: number) =>
    Animated.sequence([
      Animated.parallel([spring(v.lift, -height, BODY_SPRINGS.lift), timing(v.squash, 0.11, duration * 0.3)]),
      Animated.parallel([spring(v.lift, 0, BODY_SPRINGS.lift), Animated.sequence([timing(v.squash, -0.13, duration * 0.22, Easing.in(Easing.quad)), spring(v.squash, 0, BODY_SPRINGS.squash)])]),
    ]);
  let cycle: Animated.CompositeAnimation;
  switch (kind) {
    case "breathe":
      cycle = Animated.parallel([
        Animated.sequence([timing(v.scale, 1.018, duration / 2), timing(v.scale, 0.985, duration / 2)]),
        Animated.sequence([timing(v.lift, -0.55, duration / 2), timing(v.lift, 0.3, duration / 2)]),
      ]);
      break;
    case "bob":
      cycle = hop(7);
      break;
    case "hop":
      cycle = hop(12);
      break;
    case "tilt":
      cycle = Animated.sequence([spring(v.rotate, 8, BODY_SPRINGS.sway), spring(v.rotate, -8, BODY_SPRINGS.sway)]);
      break;
    case "pulse":
      cycle = Animated.sequence([spring(v.scale, 1.1, BODY_SPRINGS.size), spring(v.scale, 1, BODY_SPRINGS.size), Animated.delay(duration * 0.3)]);
      break;
    case "squash":
      cycle = Animated.sequence([spring(v.squash, -0.11, BODY_SPRINGS.squash), spring(v.squash, 0.07, BODY_SPRINGS.squash)]);
      break;
    case "lean":
      cycle = Animated.sequence([
        Animated.parallel([spring(v.scale, LEAN.size, BODY_SPRINGS.size), spring(v.lift, LEAN.sink, BODY_SPRINGS.lift), spring(v.rotate, LEAN_TILT[shape], BODY_SPRINGS.sway)]),
        timing(v.scale, LEAN.size + LEAN.breath, duration / 2),
        timing(v.scale, LEAN.size - LEAN.breath, duration / 2),
      ]);
      break;
    case "talk":
      cycle = Animated.parallel([
        Animated.sequence([timing(v.rotate, TALK.sway, duration / 2), timing(v.rotate, -TALK.sway, duration / 2)]),
        Animated.sequence([timing(v.scale, 1 + TALK.breath, duration / 2), timing(v.scale, 1 - TALK.breath, duration / 2)]),
      ]);
      break;
    case "turn":
      cycle = Animated.sequence([
        Animated.parallel([spring(v.turn, 1, BODY_SPRINGS.turn), spring(turnJs, 1, BODY_SPRINGS.turn, false)]),
        Animated.parallel([spring(v.turn, -1, BODY_SPRINGS.turn), spring(turnJs, -1, BODY_SPRINGS.turn, false)]),
      ]);
      break;
  }
  return loop ? Animated.loop(cycle) : Animated.sequence([cycle, Animated.parallel([spring(v.lift, 0, BODY_SPRINGS.lift), spring(v.squash, 0, BODY_SPRINGS.squash), spring(v.rotate, 0, BODY_SPRINGS.sway), spring(v.scale, 1, BODY_SPRINGS.size), spring(v.turn, 0, BODY_SPRINGS.turn), spring(turnJs, 0, BODY_SPRINGS.turn, false)])]);
}

function bodyTransform(v: BodyValues, size: number, bottom: number, voice: Animated.Value, state: AgentState) {
  const unit = size / 100;
  const pivot = (bottom / 100 - 0.5) * size;
  const vertical = v.squash;
  const nod = state === "speaking" ? -TALK.nod : 0;
  const swell = state === "speaking" ? TALK.swell : state === "listening" ? LEAN.pulse : 0;
  const scale = swell ? Animated.multiply(v.scale, Animated.add(1, Animated.multiply(voice, swell))) : v.scale;
  return [
    { translateX: Animated.multiply(v.turn, 3 * unit) },
    { translateY: nod ? Animated.add(Animated.multiply(v.lift, unit), Animated.multiply(voice, nod * unit)) : Animated.multiply(v.lift, unit) },
    { rotate: Animated.add(v.rotate, Animated.multiply(v.turn, 4)).interpolate({ inputRange: [-30, 30], outputRange: ["-30deg", "30deg"] }) },
    { translateY: pivot },
    { scaleX: Animated.multiply(scale, Animated.add(1, Animated.multiply(vertical, -0.6))) },
    { scaleY: Animated.multiply(scale, Animated.add(1, vertical)) },
    { translateY: -pivot },
  ];
}

function StaticEye({ eye, lid }: { eye: EyeGeometry; lid: string }) {
  return (
    <G x={eye.cx} y={eye.cy} rotation={eye.rotate} scaleY={eye.scaleY}>
      <Path d={eye.sclera} fill={eye.scleraFill} />
      <Circle cx={eye.pupil.cx} cy={eye.pupil.cy} r={eye.pupil.r} fill={FACE_COLORS.pupil} opacity={eye.pupil.opacity} />
      <Circle cx={eye.glint.cx} cy={eye.glint.cy} r={eye.glint.r} fill={FACE_COLORS.glint} opacity={eye.glint.opacity} />
      <Path d={eye.lidTop} fill={lid} />
      <Path d={eye.lidBottom} fill={lid} />
    </G>
  );
}

function StaticFace({ geometry, lid, mouth }: { geometry: FaceGeometry; lid: string; mouth: boolean }) {
  return (
    <>
      {geometry.blush.opacity > 0 ? (
        <G opacity={geometry.blush.opacity}>
          <Ellipse cx={geometry.blush.left.cx} cy={geometry.blush.left.cy} rx={geometry.blush.left.rx} ry={geometry.blush.left.ry} fill={FACE_COLORS.blush} />
          <Ellipse cx={geometry.blush.right.cx} cy={geometry.blush.right.cy} rx={geometry.blush.right.rx} ry={geometry.blush.right.ry} fill={FACE_COLORS.blush} />
        </G>
      ) : null}
      <StaticEye eye={geometry.left} lid={lid} />
      <StaticEye eye={geometry.right} lid={lid} />
      {mouth ? <Path d={geometry.mouth.d} fill={FACE_COLORS.mouth} stroke={FACE_COLORS.mouth} strokeWidth={geometry.mouth.stroke} strokeLinejoin="round" strokeLinecap="round" opacity={geometry.mouth.opacity} /> : null}
    </>
  );
}

interface LiveFaceProps {
  seedKey: string;
  anchor: FaceAnchor;
  color: string;
  state: AgentState;
  expression: ExpressionName | null;
  mouth: boolean;
  turn: Animated.Value;
  voiceOpen: Animated.Value | null;
  onExpression?: (name: ExpressionName) => void;
}

function LiveEye({ from, to, shutLid, side, progress, blink, gaze, head, gazeBiasFrom, gazeBiasTo, lid, clipId }: { from: EyeGeometry; to: EyeGeometry; shutLid: string; side: -1 | 1; progress: Animated.Value; blink: Animated.Value; gaze: [Animated.AnimatedNode, Animated.AnimatedNode]; head: Animated.AnimatedNode; gazeBiasFrom: [number, number]; gazeBiasTo: [number, number]; lid: string; clipId: string }) {
  const lerp = (a: number, b: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const lerpPath = (a: string, b: string) => progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const clampGaze = (node: Animated.AnimatedNode, biasFrom: number, biasTo: number) => Animated.add(node, lerp(biasFrom, biasTo)).interpolate({ inputRange: [-1, 1], outputRange: [-1, 1], extrapolate: "clamp" });
  const gx = clampGaze(gaze[0], gazeBiasFrom[0], gazeBiasTo[0]);
  const gy = clampGaze(gaze[1], gazeBiasFrom[1], gazeBiasTo[1]);
  const pupilX = Animated.multiply(gx, lerp(from.pupilTravel.x, to.pupilTravel.x));
  const pupilY = Animated.multiply(gy, lerp(from.pupilTravel.y, to.pupilTravel.y));
  const pupilR = lerp(from.pupil.r, to.pupil.r);
  return (
    <AnimatedG x={lerp(from.cx, to.cx)} y={lerp(from.cy, to.cy)} rotation={lerp(from.rotate, to.rotate)} scaleX={Animated.add(1, Animated.multiply(head, -side * TURN_EYE_SCALE))} scaleY={blink.interpolate({ inputRange: [0, 1], outputRange: [1, 1 - BLINK_SQUASH] })}>
      <Defs>
        <ClipPath id={clipId}>
          <Path d={to.sclera} />
        </ClipPath>
      </Defs>
      <AnimatedPath d={lerpPath(from.sclera, to.sclera)} fill={to.scleraFill} />
      <G clipPath={`url(#${clipId})`}>
        <AnimatedCircle cx={pupilX} cy={pupilY} r={pupilR} fill={FACE_COLORS.pupil} opacity={lerp(from.pupil.opacity, to.pupil.opacity)} />
        <AnimatedCircle cx={Animated.add(pupilX, lerp(from.pupil.r * GLINT.x, to.pupil.r * GLINT.x))} cy={Animated.add(pupilY, lerp(from.pupil.r * GLINT.y, to.pupil.r * GLINT.y))} r={lerp(from.glint.r, to.glint.r)} fill={FACE_COLORS.glint} opacity={lerp(from.glint.opacity, to.glint.opacity)} />
      </G>
      <AnimatedPath d={lerpPath(from.lidTop, to.lidTop)} fill={lid} />
      <AnimatedPath d={blink.interpolate({ inputRange: [0, 1], outputRange: [to.lidTop, shutLid] })} fill={lid} />
      <AnimatedPath d={lerpPath(from.lidBottom, to.lidBottom)} fill={lid} />
    </AnimatedG>
  );
}

function LiveFace({ seedKey, anchor, color, state, expression, mouth, turn, voiceOpen, onExpression }: LiveFaceProps) {
  const onExpressionRef = useRef(onExpression);
  onExpressionRef.current = onExpression;
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const director = useRef<{ key: string; director: Director } | null>(null);
  if (!director.current) director.current = { key: seedKey, director: new Director(seedKey, { state, expression }) };
  const initial = EXPRESSIONS[director.current.director.expression];
  const [faces, setFaces] = useState<{ from: FaceParams; to: FaceParams; mouthDelay: number }>({ from: initial, to: initial, mouthDelay: 0 });
  const [facesKey, setFacesKey] = useState(seedKey);
  if (director.current.key !== seedKey) {
    director.current = { key: seedKey, director: new Director(seedKey, { state, expression }) };
    const rest = EXPRESSIONS[director.current.director.expression];
    setFacesKey(seedKey);
    setFaces({ from: rest, to: rest, mouthDelay: 0 });
  }
  const progress = useRef(new Animated.Value(1)).current;
  const mouthProgress = useRef(new Animated.Value(1)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const gazeX = useRef(new Animated.Value(0)).current;
  const gazeY = useRef(new Animated.Value(0)).current;
  const jitterX = useRef(new Animated.Value(0)).current;
  const jitterY = useRef(new Animated.Value(0)).current;
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  const head = useRef(new Animated.Value(0)).current;
  const latest = useRef(faces);
  latest.current = faces;

  useEffect(() => {
    director.current?.director.set({ state, expression });
    const current = director.current?.director.expression;
    if (current) onExpressionRef.current?.(current);
  }, [state, expression, facesKey]);

  useLayoutEffect(() => {
    if (faces.from === faces.to) return;
    progress.setValue(0);
    mouthProgress.setValue(0);
    const eyes = Animated.spring(progress, { toValue: 1, ...js(FACE_SPRING) });
    const lips = Animated.sequence([Animated.delay(faces.mouthDelay), Animated.spring(mouthProgress, { toValue: 1, ...js(FACE_SPRING) })]);
    eyes.start();
    lips.start();
    return () => {
      eyes.stop();
      lips.stop();
    };
  }, [faces, progress, mouthProgress]);

  useEffect(() => {
    const running: Animated.CompositeAnimation[] = [];
    let nextDrift = 0;
    const run = (animation: Animated.CompositeAnimation) => {
      running.push(animation);
      animation.start(() => {
        const index = running.indexOf(animation);
        if (index >= 0) running.splice(index, 1);
      });
    };
    const apply = (cue: Cue) => {
      switch (cue.kind) {
        case "expression": {
          const next = EXPRESSIONS[cue.name];
          onExpressionRef.current?.(cue.name);
          if (next !== latest.current.to) setFaces({ from: latest.current.to, to: next, mouthDelay: cue.mouthDelay });
          return;
        }
        case "blink": {
          const once = Animated.sequence([
            Animated.timing(blink, { toValue: 1, duration: cue.duration * BLINK_CLOSE_SHARE, easing: Easing.in(Easing.quad), useNativeDriver: false }),
            Animated.timing(blink, { toValue: 0, duration: cue.duration * (1 - BLINK_CLOSE_SHARE), easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          ]);
          run(cue.count === 2 ? Animated.sequence([once, Animated.delay(60), once]) : once);
          return;
        }
        case "gaze":
          run(
            Animated.parallel([
              Animated.sequence([Animated.spring(gazeX, { toValue: cue.x, ...js(SACCADE_SPRING) }), Animated.spring(gazeX, { toValue: cue.x, ...js(GAZE_SPRING) })]),
              Animated.sequence([Animated.spring(gazeY, { toValue: cue.y, ...js(SACCADE_SPRING) }), Animated.spring(gazeY, { toValue: cue.y, ...js(GAZE_SPRING) })]),
              Animated.spring(head, { toValue: cue.x * HEAD_FOLLOW, ...js(TURN_SPRING) }),
            ]),
          );
          return;
        case "saccade":
          run(
            Animated.sequence([
              Animated.parallel([Animated.timing(jitterX, { toValue: cue.x, duration: cue.duration, useNativeDriver: false }), Animated.timing(jitterY, { toValue: cue.y, duration: cue.duration, useNativeDriver: false })]),
              Animated.parallel([Animated.timing(jitterX, { toValue: 0, duration: cue.duration, useNativeDriver: false }), Animated.timing(jitterY, { toValue: 0, duration: cue.duration, useNativeDriver: false })]),
            ]),
          );
      }
    };
    const off = nativeTicker.subscribe((now) => {
      for (const cue of director.current?.director.tick(now) ?? []) apply(cue);
      if (now >= nextDrift) {
        nextDrift = now + GAZE_DRIFT.periodX / 2;
        const phase = (now / GAZE_DRIFT.periodX) * Math.PI * 2;
        run(
          Animated.parallel([
            Animated.spring(driftX, { toValue: GAZE_DRIFT.x * Math.sin(phase), ...js(TURN_SPRING) }),
            Animated.spring(driftY, { toValue: GAZE_DRIFT.y * Math.sin((now / GAZE_DRIFT.periodY) * Math.PI * 2), ...js(TURN_SPRING) }),
          ]),
        );
      }
    });
    return () => {
      off();
      for (const animation of running.splice(0)) animation.stop();
    };
  }, [blink, gazeX, gazeY, jitterX, jitterY, head, driftX, driftY]);

  const from = useMemo(() => faceGeometry(faces.from, anchor), [faces.from, anchor]);
  const to = useMemo(() => faceGeometry(faces.to, anchor), [faces.to, anchor]);
  const shut = useMemo(() => faceGeometry(faces.to, anchor, { blink: 1, gazeX: 0, gazeY: 0 }), [faces.to, anchor]);
  const gaze: [Animated.AnimatedNode, Animated.AnimatedNode] = useMemo(() => [Animated.add(Animated.add(gazeX, jitterX), driftX), Animated.add(Animated.add(gazeY, jitterY), driftY)], [gazeX, gazeY, jitterX, jitterY, driftX, driftY]);
  const headTurn = useMemo(() => Animated.add(head, Animated.multiply(turn, 0.35)), [head, turn]);
  const shift = Animated.multiply(headTurn, TURN_SHIFT * anchor.scale);
  const lerp = (a: number, b: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const lerpMouth = (a: number, b: number) => mouthProgress.interpolate({ inputRange: [0, 1], outputRange: [a, b] });
  const voiceMouth = useMemo(() => {
    if (!voiceOpen) return null;
    const stops = VOICE_OPEN_STOPS.map((share) => {
      const open = share * VOICE_MOUTH.maxOpen;
      return faceGeometry(applyVoice(faces.to, "speaking", share, { open, width: 1 - open * VOICE_MOUTH.jawNarrow }), anchor).mouth;
    });
    const input = VOICE_OPEN_STOPS.map((share) => share * VOICE_MOUTH.maxOpen);
    return {
      d: voiceOpen.interpolate({ inputRange: input, outputRange: stops.map((m) => m.d), extrapolate: "clamp" }),
      stroke: voiceOpen.interpolate({ inputRange: input, outputRange: stops.map((m) => m.stroke), extrapolate: "clamp" }),
      opacity: stops[0].opacity,
    };
  }, [voiceOpen, faces.to, anchor]);
  return (
    <AnimatedG x={shift}>
      <AnimatedG opacity={lerp(from.blush.opacity, to.blush.opacity)}>
        <Ellipse cx={from.blush.left.cx} cy={from.blush.left.cy} rx={from.blush.left.rx} ry={from.blush.left.ry} fill={FACE_COLORS.blush} />
        <Ellipse cx={from.blush.right.cx} cy={from.blush.right.cy} rx={from.blush.right.rx} ry={from.blush.right.ry} fill={FACE_COLORS.blush} />
      </AnimatedG>
      <LiveEye from={from.left} to={to.left} shutLid={shut.left.lidTop} side={-1} progress={progress} blink={blink} gaze={gaze} head={headTurn} gazeBiasFrom={[faces.from.gazeX, faces.from.gazeY]} gazeBiasTo={[faces.to.gazeX, faces.to.gazeY]} lid={color} clipId={`af${clipId}l`} />
      <LiveEye from={from.right} to={to.right} shutLid={shut.right.lidTop} side={1} progress={progress} blink={blink} gaze={gaze} head={headTurn} gazeBiasFrom={[faces.from.gazeX, faces.from.gazeY]} gazeBiasTo={[faces.to.gazeX, faces.to.gazeY]} lid={color} clipId={`af${clipId}r`} />
      {mouth && voiceMouth ? <AnimatedPath d={voiceMouth.d} fill={FACE_COLORS.mouth} stroke={FACE_COLORS.mouth} strokeWidth={voiceMouth.stroke} strokeLinejoin="round" strokeLinecap="round" opacity={voiceMouth.opacity} /> : null}
      {mouth && !voiceMouth ? (
        <AnimatedPath d={mouthProgress.interpolate({ inputRange: [0, 1], outputRange: [from.mouth.d, to.mouth.d] })} fill={FACE_COLORS.mouth} stroke={FACE_COLORS.mouth} strokeWidth={lerpMouth(from.mouth.stroke, to.mouth.stroke)} strokeLinejoin="round" strokeLinecap="round" opacity={lerpMouth(from.mouth.opacity, to.mouth.opacity)} />
      ) : null}
    </AnimatedG>
  );
}

const LOOP_EASING = Easing.inOut(Easing.ease);

function useLoop(duration: number, loop: boolean, delay = 0, easing: (value: number) => number = LOOP_EASING): Animated.Value {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    t.setValue(0);
    const run = Animated.timing(t, { toValue: 1, duration, easing, useNativeDriver: true });
    const animation = Animated.sequence([Animated.delay(delay), loop ? Animated.loop(run) : run]);
    animation.start();
    return () => animation.stop();
  }, [t, duration, loop, delay, easing]);
  return t;
}

function Ring({ size, color, delay }: { size: number; color: string; delay: number }) {
  const t = useLoop(1800, true, delay);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: size * 0.06,
        top: size * 0.06,
        width: size * 0.88,
        height: size * 0.88,
        borderRadius: size,
        borderWidth: Math.max(1, size * 0.016),
        borderColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.04] }) }],
      }}
    />
  );
}

function Spinner({ size, children, duration }: { size: number; children: ReactNode; duration: number }) {
  const t = useLoop(duration, true);
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: [{ rotate: t.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }}>
      {children}
    </Animated.View>
  );
}

function Dot({ size, x, y, delay }: { size: number; x: number; y: number; delay: number }) {
  const t = useLoop(900, true, delay);
  const r = size * 0.03;
  return <Animated.View pointerEvents="none" style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: r, backgroundColor: FACE_COLORS.sclera, transform: [{ translateY: t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, -size * 0.04, 0] }) }] }} />;
}

function Ornament({ kind, size, color, anchor }: { kind: OrnamentKind; size: number; color: string; anchor: FaceAnchor }) {
  switch (kind) {
    case "tracker":
      return (
        <>
          <View pointerEvents="none" style={{ position: "absolute", left: size * 0.04, top: size * 0.04, width: size * 0.92, height: size * 0.92, borderRadius: size, borderWidth: Math.max(1, size * 0.012), borderColor: color, opacity: 0.28 }} />
          <Spinner size={size} duration={1600}>
            <View style={{ position: "absolute", left: size / 2 - size * 0.036, top: size * 0.004, width: size * 0.072, height: size * 0.072, borderRadius: size, backgroundColor: color }} />
          </Spinner>
        </>
      );
    case "ripple":
      return (
        <>
          <Ring size={size} color={color} delay={0} />
          <Ring size={size} color={color} delay={900} />
        </>
      );
    case "spinner":
      return (
        <>
          <View pointerEvents="none" style={{ position: "absolute", left: size * 0.04, top: size * 0.04, width: size * 0.92, height: size * 0.92, borderRadius: size, borderWidth: Math.max(1.5, size * 0.03), borderColor: color, opacity: 0.18 }} />
          <Spinner size={size} duration={1200}>
            <Svg viewBox="0 0 100 100" width={size} height={size}>
              <Circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray="72 217" />
            </Svg>
          </Spinner>
        </>
      );
    case "typing": {
      const y = ((anchor.cy + MOUTH_OFFSET_Y * anchor.scale) / 100) * size;
      return (
        <>
          <Dot size={size} x={size * 0.41} y={y} delay={0} />
          <Dot size={size} x={size * 0.5} y={y} delay={150} />
          <Dot size={size} x={size * 0.59} y={y} delay={300} />
        </>
      );
    }
  }
}

function confettiShapeStyle(piece: ConfettiPiece, color: string, unit: number) {
  switch (piece.kind) {
    case "strip":
      return { width: CONFETTI_SIZES.strip.w * unit, height: CONFETTI_SIZES.strip.h * unit, borderRadius: (CONFETTI_SIZES.strip.w / 2) * unit, backgroundColor: color };
    case "square":
      return { width: CONFETTI_SIZES.square * unit, height: CONFETTI_SIZES.square * unit, borderRadius: 0.8 * unit, backgroundColor: color };
    case "dot":
      return { width: CONFETTI_SIZES.dot * 2 * unit, height: CONFETTI_SIZES.dot * 2 * unit, borderRadius: CONFETTI_SIZES.dot * unit, backgroundColor: color };
    case "ring":
      return { width: CONFETTI_SIZES.ring.r * 2 * unit, height: CONFETTI_SIZES.ring.r * 2 * unit, borderRadius: CONFETTI_SIZES.ring.r * unit, borderWidth: Math.max(1, CONFETTI_SIZES.ring.stroke * unit), borderColor: color };
    case "tri":
      return { width: 0, height: 0, borderLeftWidth: (CONFETTI_SIZES.tri.w / 2) * unit, borderRightWidth: (CONFETTI_SIZES.tri.w / 2) * unit, borderBottomWidth: CONFETTI_SIZES.tri.h * unit, borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: color };
  }
}

function ConfettiBit({ size, piece, bodyColor, palette }: { size: number; piece: ConfettiPiece; bodyColor: string; palette: readonly string[] }) {
  const t = useLoop(piece.duration, true, piece.delay, Easing.linear);
  const unit = size / 100;
  const shape = confettiShapeStyle(piece, confettiColor(piece, bodyColor, palette), unit);
  const span = 6 * unit;
  const stops = [0, CONFETTI_BURST_SHARE, CONFETTI_MID_SHARE, 1];
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: CONFETTI_ORIGIN.x * unit - span / 2,
        top: CONFETTI_ORIGIN.y * unit - span / 2,
        width: span,
        height: span,
        alignItems: "center",
        justifyContent: "center",
        opacity: t.interpolate({ inputRange: [0, CONFETTI_BURST_SHARE, CONFETTI_FADE_SHARE, 1], outputRange: [0, 1, 1, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: stops, outputRange: [0, piece.x * unit, (piece.x + piece.sway * CONFETTI_MID_SWAY) * unit, (piece.x + piece.sway) * unit] }) },
          { translateY: t.interpolate({ inputRange: stops, outputRange: [0, piece.y * unit, CONFETTI_MID_Y * unit, CONFETTI_FALL * unit] }) },
          { rotate: t.interpolate({ inputRange: stops, outputRange: ["0deg", `${piece.spin * 0.25}deg`, `${piece.spin * 0.6}deg`, `${piece.spin}deg`] }) },
          { scale: t.interpolate({ inputRange: [0, CONFETTI_BURST_SHARE, 1], outputRange: [0.2, 1, 0.9] }) },
        ],
      }}
    >
      <View style={shape} />
    </Animated.View>
  );
}

interface GlyphDrive {
  kind: GlyphKind | null;
  progress: Animated.Value;
}

function useGlyph(state: AgentState, live: boolean, love: boolean): GlyphDrive {
  const progress = useRef(new Animated.Value(0)).current;
  const stateKind = STATE_GLYPH[state] ?? null;
  const schedule = GLYPH_SCHEDULE[state];
  const wanted: GlyphKind | null = live ? (love ? "heart" : stateKind) : null;
  const [drawn, setDrawn] = useState<GlyphKind | null>(wanted);
  if (wanted && wanted !== drawn) setDrawn(wanted);
  useEffect(() => {
    if (!live) {
      progress.setValue(0);
      setDrawn(null);
      return;
    }
    const spring = (toValue: number) => Animated.spring(progress, { toValue, ...js(GLYPH_SPRING) });
    let animation: Animated.CompositeAnimation;
    if (love) animation = spring(1);
    else if (stateKind && schedule) {
      const cycle = Animated.sequence([spring(0), Animated.delay(schedule.rest), spring(1), Animated.delay(schedule.hold), spring(0)]);
      animation = schedule.loop ? Animated.loop(cycle) : cycle;
    } else animation = spring(0);
    animation.start(({ finished }) => {
      if (finished && !love && !stateKind) setDrawn(null);
    });
    return () => animation.stop();
  }, [live, love, stateKind, schedule, progress]);
  return { kind: drawn, progress };
}

export function AgentFace(props: AgentFaceProps) {
  const theme = useAgentFacesTheme();
  const face = resolveFace(props, theme);
  const { state, shape: finalShape, color: finalColor, seed, size, variant, mouth, accessibleName, reducedMotion, palette, expression } = face;
  const { decorative = false, testID } = props;
  const systemReduced = useReducedMotion();
  const live = variant === "live" && !(reducedMotion ?? systemReduced);
  const spec = STATE_MOTION[state];
  const anchor = useMemo(() => anchorForSize(finalShape, size), [finalShape, size]);
  const [love, setLove] = useState(expression ? EXPRESSION_GLYPH[expression] === "heart" : false);
  const glyph = useGlyph(state, live, love);
  const glyphSpec = glyph.kind ? GLYPHS[glyph.kind] : null;
  const bodyPath = useMemo(() => {
    if (!glyph.kind) return null;
    const track = morphKeyframes(finalShape, glyph.kind);
    return glyph.progress.interpolate({ inputRange: track.input, outputRange: track.paths, extrapolate: "clamp" });
  }, [glyph.kind, glyph.progress, finalShape]);
  const faceOpacity = useMemo(() => (glyphSpec && !glyphSpec.face ? glyph.progress.interpolate({ inputRange: [0, GLYPH_FACE_FADE, 1], outputRange: [1, 0, 0], extrapolate: "clamp" }) : 1), [glyphSpec, glyph.progress]);
  const ride = glyphSpec?.face ?? null;
  const rideX = useMemo(() => (ride ? Animated.multiply(glyph.progress, ride.cx - anchor.cx) : 0), [ride, glyph.progress, anchor]);
  const rideY = useMemo(() => (ride ? Animated.multiply(glyph.progress, ride.cy - anchor.cy) : 0), [ride, glyph.progress, anchor]);
  const rideScale = useMemo(() => (ride ? Animated.add(1, Animated.multiply(glyph.progress, ride.scale / anchor.scale - 1)) : 1), [ride, glyph.progress, anchor]);
  const dotR = useMemo(() => {
    if (!glyphSpec?.dot) return null;
    const stops = glyphDotStops();
    const r = glyphSpec.dot.r;
    return glyph.progress.interpolate({ inputRange: stops.input, outputRange: stops.scale.map((scale) => scale * r), extrapolate: "clamp" });
  }, [glyphSpec, glyph.progress]);
  const ornament = STATE_ORNAMENT[state];
  const showOrnament = live && ornament !== undefined;
  const showMouth = mouth && !(showOrnament && ornament === "typing");
  const a11y = decorative ? ({ accessible: false, importantForAccessibility: "no-hide-descendants" } as const) : ({ accessible: true, accessibilityRole: "image", accessibilityLabel: accessibleName } as const);
  const body = useBodyValues();
  const turnJs = useRef(new Animated.Value(0)).current;
  const voiceBody = useRef(new Animated.Value(0)).current;
  const voiceOpen = useRef(new Animated.Value(0)).current;
  const voice = isVoiceState(state);
  const levelRef = useFaceLevel(live && voice, state === "speaking", props.audio, seed);
  const [voiceDriven, setVoiceDriven] = useState(false);

  useEffect(() => {
    if (!live || !voice) {
      setVoiceDriven(false);
      voiceBody.setValue(0);
      voiceOpen.setValue(0);
      return;
    }
    const mouthModel = new MouthModel();
    let last = 0;
    let driven = false;
    const running: Animated.CompositeAnimation[] = [];
    const off = nativeTicker.subscribe((now, dt) => {
      const level = levelRef.current;
      if (!level) return;
      if (!driven) {
        driven = true;
        setVoiceDriven(true);
      }
      const amount = level.update(now);
      const shape = state === "speaking" ? mouthModel.update(amount, level.bands, dt) : null;
      if (Math.abs(amount - last) < 0.004 && !shape) return;
      last = amount;
      for (const animation of running.splice(0)) animation.stop();
      const step = [Animated.timing(voiceBody, { toValue: amount, duration: NATIVE_TICK_MS, easing: Easing.linear, useNativeDriver: true })];
      if (shape) step.push(Animated.timing(voiceOpen, { toValue: shape.open, duration: NATIVE_TICK_MS, easing: Easing.linear, useNativeDriver: false }));
      const animation = Animated.parallel(step);
      running.push(animation);
      animation.start();
    });
    return () => {
      off();
      for (const animation of running.splice(0)) animation.stop();
    };
  }, [live, voice, state, voiceBody, voiceOpen, levelRef]);

  useEffect(() => {
    if (!live) return;
    return warmMorphs(finalShape, glyphKindsFor(state, STATE_EXPRESSIONS[state].pool, expression));
  }, [live, finalShape, state, expression]);

  useEffect(() => {
    if (!live) return;
    const animation = bodyMotion(spec.kind, spec.duration, spec.loop, body, turnJs, finalShape);
    animation.start();
    return () => animation.stop();
  }, [live, spec, body, turnJs, finalShape]);

  if (!live) {
    const geometry = faceGeometry(EXPRESSIONS[expression ?? restExpression(state)], anchor);
    return (
      <View testID={testID ?? "agentface-still"} {...a11y} style={{ width: size, height: size }}>
        <Svg viewBox="0 0 100 100" width={size} height={size}>
          <Path d={SHAPE_PATHS[finalShape]} fill={finalColor} />
          <StaticFace geometry={geometry} lid={finalColor} mouth={showMouth} />
        </Svg>
      </View>
    );
  }

  const shrink = showOrnament && ornament !== "typing";
  return (
    <View testID={testID ?? "agentface-live"} {...a11y} style={{ width: size, height: size }}>
      {showOrnament && ornament !== "typing" ? <Ornament kind={ornament} size={size} color={finalColor} anchor={anchor} /> : null}
      <Animated.View style={{ width: size, height: size, transform: bodyTransform(body, size, SHAPE_BOUNDS[finalShape].maxY, voiceBody, state) }}>
        <Svg viewBox="0 0 100 100" width={size} height={size}>
          <G scale={shrink ? ORNAMENT_SCALE : 1} origin="50, 50">
            {bodyPath ? <AnimatedPath d={bodyPath} fill={finalColor} /> : <Path d={SHAPE_PATHS[finalShape]} fill={finalColor} />}
            {dotR && glyphSpec?.dot ? <AnimatedCircle cx={glyphSpec.dot.cx} cy={glyphSpec.dot.cy} r={dotR} fill={finalColor} /> : null}
            <AnimatedG opacity={faceOpacity} x={rideX} y={rideY} scale={rideScale} origin={`${anchor.cx}, ${anchor.cy}`}>
              <LiveFace seedKey={seed} anchor={anchor} color={finalColor} state={state} expression={expression ?? null} mouth={showMouth} turn={turnJs} voiceOpen={voiceDriven && state === "speaking" ? voiceOpen : null} onExpression={(name) => setLove(EXPRESSION_GLYPH[name] === "heart")} />
            </AnimatedG>
          </G>
        </Svg>
      </Animated.View>
      {showOrnament && ornament === "typing" ? <Ornament kind="typing" size={size} color={finalColor} anchor={anchor} /> : null}
      {STATE_CONFETTI[state] ? CONFETTI_PIECES.map((piece, i) => <ConfettiBit key={i} size={size} piece={piece} bodyColor={finalColor} palette={palette} />) : null}
    </View>
  );
}
