export interface SpringConfig {
  stiffness: number;
  damping: number;
  rest: number;
}

export const FACE_SPRING: SpringConfig = { stiffness: 150, damping: 20, rest: 0.002 };
export const GAZE_SPRING: SpringConfig = { stiffness: 90, damping: 16, rest: 0.004 };
export const SACCADE_SPRING: SpringConfig = { stiffness: 420, damping: 30, rest: 0.002 };
export const TURN_SPRING: SpringConfig = { stiffness: 40, damping: 11, rest: 0.004 };

const MAX_STEP = 1 / 40;

export function stepSprings(values: number[], velocities: number[], targets: ArrayLike<number>, dtSeconds: number, config: SpringConfig): boolean {
  let remaining = Math.min(Math.max(dtSeconds, 0), 0.25);
  while (remaining > 0) {
    const dt = Math.min(MAX_STEP, remaining);
    remaining -= dt;
    for (let i = 0; i < values.length; i++) {
      const displacement = values[i] - targets[i];
      const acceleration = -config.stiffness * displacement - config.damping * velocities[i];
      velocities[i] += acceleration * dt;
      values[i] += velocities[i] * dt;
    }
  }
  let settled = true;
  for (let i = 0; i < values.length; i++) {
    if (Math.abs(values[i] - targets[i]) > config.rest || Math.abs(velocities[i]) > config.rest * 10) {
      settled = false;
      break;
    }
  }
  if (settled) {
    for (let i = 0; i < values.length; i++) {
      values[i] = targets[i];
      velocities[i] = 0;
    }
  }
  return settled;
}
