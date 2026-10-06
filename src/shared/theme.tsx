import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_PALETTE, faceFor, STATE_LABEL, type AgentState, type ShapeName } from "agentfaces";

export interface AgentFacesTheme {
  /** Shapes that seeded faces are picked from. Defaults to circle, triangle and square. */
  shapes?: readonly ShapeName[];
  /** Colors that seeded faces and confetti are picked from. */
  palette?: readonly string[];
  /** Default size in pixels for faces that do not set one. */
  size?: number;
  /** Default variant for faces that do not set one. */
  variant?: "live" | "still";
  /** Default mouth switch for faces that do not set one. */
  mouth?: boolean;
  /** Force reduced motion on or off for every face. Follows the OS setting when unset. */
  reducedMotion?: boolean;
  /** Override the accessible state names, for example to translate them. */
  labels?: Partial<Record<AgentState, string>>;
}

const ThemeContext = createContext<AgentFacesTheme>({});

export interface AgentFacesProviderProps extends AgentFacesTheme {
  children?: ReactNode;
}

export function AgentFacesProvider({ children, shapes, palette, size, variant, mouth, reducedMotion, labels }: AgentFacesProviderProps) {
  const parent = useContext(ThemeContext);
  const value = useMemo<AgentFacesTheme>(
    () => ({
      shapes: shapes ?? parent.shapes,
      palette: palette ?? parent.palette,
      size: size ?? parent.size,
      variant: variant ?? parent.variant,
      mouth: mouth ?? parent.mouth,
      reducedMotion: reducedMotion ?? parent.reducedMotion,
      labels: labels || parent.labels ? { ...parent.labels, ...labels } : undefined,
    }),
    [parent, shapes, palette, size, variant, mouth, reducedMotion, labels],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAgentFacesTheme(): AgentFacesTheme {
  return useContext(ThemeContext);
}

export interface BaseFaceProps {
  state?: AgentState;
  shape?: ShapeName;
  color?: string;
  seed?: string;
  size?: number;
  variant?: "live" | "still";
  mouth?: boolean;
  label?: string;
  name?: string;
  reducedMotion?: boolean;
}

export interface ResolvedFace {
  state: AgentState;
  shape: ShapeName;
  color: string;
  seed: string;
  size: number;
  variant: "live" | "still";
  mouth: boolean;
  accessibleName: string;
  reducedMotion: boolean | undefined;
  palette: readonly string[];
}

export function resolveFace(props: BaseFaceProps, theme: AgentFacesTheme): ResolvedFace {
  const state = props.state ?? "idle";
  const seed = props.seed ?? "";
  const palette = theme.palette && theme.palette.length ? theme.palette : DEFAULT_PALETTE;
  const picked = props.shape && props.color ? null : faceFor(seed, { shapes: theme.shapes, palette });
  const stateName = theme.labels?.[state] ?? STATE_LABEL[state];
  return {
    state,
    shape: props.shape ?? picked!.shape,
    color: props.color ?? picked!.color,
    seed,
    size: props.size ?? theme.size ?? 48,
    variant: props.variant ?? theme.variant ?? "live",
    mouth: props.mouth ?? theme.mouth ?? true,
    accessibleName: props.label ?? (props.name ? `${props.name}, ${stateName}` : stateName),
    reducedMotion: props.reducedMotion ?? theme.reducedMotion,
    palette,
  };
}
