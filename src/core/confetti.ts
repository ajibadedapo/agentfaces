import { DEFAULT_PALETTE } from "./palette";
import { createRng } from "./random";

export type ConfettiKind = "strip" | "square" | "dot" | "ring" | "tri";

export interface ConfettiPiece {
  kind: ConfettiKind;
  x: number;
  y: number;
  sway: number;
  spin: number;
  delay: number;
  duration: number;
  tone: number;
}

export const CONFETTI_KINDS: readonly ConfettiKind[] = ["strip", "dot", "square", "tri", "ring"];
export const CONFETTI_COUNT = 14;
export const CONFETTI_SEED = "agentfaces:confetti";
export const CONFETTI_SPREAD = { x: 44, yTop: -34, yBottom: -2, jitter: 0.35 } as const;
export const CONFETTI_SWAY = { min: 4, max: 9 } as const;
export const CONFETTI_SPIN = { min: 380, max: 600 } as const;
export const CONFETTI_DURATION = { min: 1600, max: 2300 } as const;
export const CONFETTI_DELAY_SPAN = 1700;

export const CONFETTI_ORIGIN = { x: 50, y: 20 } as const;
export const CONFETTI_FALL = 90;
export const CONFETTI_MID_Y = (CONFETTI_ORIGIN.y + CONFETTI_FALL) / 2;
export const CONFETTI_BURST_SHARE = 1 / 7;
export const CONFETTI_MID_SHARE = 4 / 7;
export const CONFETTI_FADE_SHARE = 5 / 6;
export const CONFETTI_MID_SWAY = -0.6;

const UNIT = 2.2;
export const CONFETTI_SIZES = {
  strip: { w: UNIT, h: UNIT * 3 },
  square: UNIT * 1.8,
  dot: UNIT,
  ring: { r: UNIT, stroke: UNIT * 0.6 },
  tri: { w: UNIT * 2.2, h: UNIT * 2.2 * (Math.sqrt(3) / 2) },
} as const;

export function generateConfetti(seed: string = CONFETTI_SEED, count: number = CONFETTI_COUNT, tones: number = DEFAULT_PALETTE.length): ConfettiPiece[] {
  const rng = createRng(seed);
  const slots = Array.from({ length: count }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const lane = (2 * CONFETTI_SPREAD.x) / Math.max(1, count - 1);
  return slots.map((slot, i) => {
    const kind = CONFETTI_KINDS[i % CONFETTI_KINDS.length];
    const spins = kind !== "dot" && kind !== "ring";
    const x = -CONFETTI_SPREAD.x + slot * lane + rng.range(-CONFETTI_SPREAD.jitter, CONFETTI_SPREAD.jitter) * lane;
    const height = Math.min(1, Math.max(0, 1 - Math.abs(x) / CONFETTI_SPREAD.x));
    const y = CONFETTI_SPREAD.yBottom + (CONFETTI_SPREAD.yTop - CONFETTI_SPREAD.yBottom) * Math.min(1, height * rng.range(0.7, 1.15));
    return {
      kind,
      x: Math.round(x),
      y: Math.round(y),
      sway: Math.round(rng.range(CONFETTI_SWAY.min, CONFETTI_SWAY.max)) * (rng.chance(0.5) ? 1 : -1),
      spin: spins ? Math.round(rng.range(CONFETTI_SPIN.min, CONFETTI_SPIN.max) / 20) * 20 * (rng.chance(0.5) ? 1 : -1) : 0,
      delay: Math.round(((i / count) * CONFETTI_DELAY_SPAN + rng.range(0, CONFETTI_DELAY_SPAN / count)) / 50) * 50,
      duration: Math.round(rng.range(CONFETTI_DURATION.min, CONFETTI_DURATION.max) / 100) * 100,
      tone: i % tones,
    };
  });
}

export const CONFETTI_PIECES: readonly ConfettiPiece[] = generateConfetti();

export function confettiPalette(bodyColor: string, palette: readonly string[] = DEFAULT_PALETTE): readonly string[] {
  const body = bodyColor.trim().toLowerCase();
  const others = palette.filter((c) => c.toLowerCase() !== body);
  return others.length ? others : palette;
}

export function confettiColor(piece: ConfettiPiece, bodyColor: string, palette: readonly string[] = DEFAULT_PALETTE): string {
  const colors = confettiPalette(bodyColor, palette);
  return colors[piece.tone % colors.length];
}
