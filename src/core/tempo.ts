export const TEMPO_BASE = 400;
export const TEMPO_STEPS_PER_DOUBLING = 3;
export const TEMPO_GRID = 20;

export function tempo(step: number): number {
  return Math.round((TEMPO_BASE * 2 ** (step / TEMPO_STEPS_PER_DOUBLING)) / TEMPO_GRID) * TEMPO_GRID;
}

export interface SpringFeel {
  frequency: number;
  dampingRatio: number;
}

export function springFromFeel({ frequency, dampingRatio }: SpringFeel, rest: number) {
  const omega = 2 * Math.PI * frequency;
  const stiffness = omega * omega;
  return { stiffness, damping: 2 * dampingRatio * omega, rest };
}
