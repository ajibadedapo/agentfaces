import { EXPRESSION_NAMES, type ExpressionName } from "./expressions";
import { SHAPE_NAMES, type ShapeName } from "./shapes";
import { AGENT_STATES, type AgentState } from "./states";

export type NameKind = "state" | "shape" | "expression";

const NAMES: Record<NameKind, readonly string[]> = {
  state: AGENT_STATES,
  shape: SHAPE_NAMES,
  expression: EXPRESSION_NAMES,
};

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * The valid name closest to `value`, or undefined when nothing is close.
 * Case, spaces and underscores are ignored, so "Needs_You" suggests "needs-you".
 */
export function suggestName(value: string, names: readonly string[]): string | undefined {
  const wanted = normalize(value);
  if (!wanted) return undefined;
  const bare = wanted.replace(/-/g, "");
  let best: string | undefined;
  let bestScore = Infinity;
  for (const name of names) {
    const prefix = wanted.length >= 3 && (name.startsWith(wanted) || wanted.startsWith(name));
    const distance = name === wanted ? 0 : prefix ? 1 : Math.min(editDistance(wanted, name), editDistance(bare, name.replace(/-/g, "")));
    const score = distance / Math.max(2, Math.floor(name.length / 3));
    if (score <= 1 && score < bestScore) {
      best = name;
      bestScore = score;
    }
  }
  return best;
}

function isDevelopment(): boolean {
  try {
    return process.env.NODE_ENV !== "production";
  } catch {
    return false;
  }
}

const warned = new Set<string>();

/**
 * The message agentfaces warns with for an unknown state, shape or expression name.
 * It names the fallback that is used instead and, when one is close, the valid name you probably meant.
 */
export function unknownNameMessage(kind: NameKind, value: unknown, fallback: string): string {
  const shown = typeof value === "string" ? `"${value}"` : String(value);
  const suggestion = typeof value === "string" ? suggestName(value, NAMES[kind]) : undefined;
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : "";
  return `agentfaces: unknown ${kind} ${shown}.${hint} Using ${fallback} instead. Valid ${kind}s: ${NAMES[kind].join(", ")}.`;
}

function check<T extends string>(kind: NameKind, value: unknown, fallback: T | undefined, fallbackLabel: string): T | undefined {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && NAMES[kind].includes(value)) return value as T;
  if (isDevelopment()) {
    const message = unknownNameMessage(kind, value, fallbackLabel);
    if (!warned.has(message)) {
      warned.add(message);
      console.warn(message);
    }
  }
  return fallback;
}

/**
 * Returns `value` when it is a valid agent state, otherwise `fallback` (idle by default).
 * Unknown names warn once in development with a "did you mean" suggestion and never throw.
 */
export function checkState(value: unknown, fallback: AgentState = "idle"): AgentState {
  return check<AgentState>("state", value, fallback, `"${fallback}"`)!;
}

/**
 * Returns `value` when it is a valid shape, otherwise `fallback`.
 * Unknown names warn once in development with a "did you mean" suggestion and never throw.
 */
export function checkShape(value: unknown, fallback?: ShapeName): ShapeName | undefined {
  return check<ShapeName>("shape", value, fallback, fallback ? `"${fallback}"` : "the seeded shape");
}

/**
 * Returns `value` when it is a valid expression, otherwise undefined so the face cycles its state's expressions.
 * Unknown names warn once in development with a "did you mean" suggestion and never throw.
 */
export function checkExpression(value: unknown): ExpressionName | undefined {
  return check<ExpressionName>("expression", value, undefined, "the state's expressions");
}
