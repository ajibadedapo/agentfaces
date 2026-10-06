import { describe, expect, it } from "vitest";
import { CONFETTI_COUNT, CONFETTI_DURATION, CONFETTI_KINDS, CONFETTI_PIECES, CONFETTI_SPREAD, confettiColor, generateConfetti } from "./confetti";
import { DEFAULT_PALETTE } from "./palette";

describe("confetti", () => {
  it("is generated from the seeded generator and stable", () => {
    expect(generateConfetti()).toEqual(CONFETTI_PIECES);
    expect(generateConfetti("other")).not.toEqual(CONFETTI_PIECES);
    expect(CONFETTI_PIECES).toHaveLength(CONFETTI_COUNT);
  });

  it("uses every kind, stays in the spread, and only spins pieces that read as spinning", () => {
    expect(new Set(CONFETTI_PIECES.map((p) => p.kind))).toEqual(new Set(CONFETTI_KINDS));
    for (const piece of CONFETTI_PIECES) {
      expect(Math.abs(piece.x)).toBeLessThanOrEqual(CONFETTI_SPREAD.x + 4);
      expect(piece.y).toBeLessThanOrEqual(CONFETTI_SPREAD.yBottom);
      expect(piece.y).toBeGreaterThanOrEqual(CONFETTI_SPREAD.yTop);
      expect(piece.duration).toBeGreaterThanOrEqual(CONFETTI_DURATION.min);
      expect(piece.duration).toBeLessThanOrEqual(CONFETTI_DURATION.max);
      if (piece.kind === "dot" || piece.kind === "ring") expect(piece.spin).toBe(0);
    }
  });

  it("never colors a piece with the body color", () => {
    for (const body of DEFAULT_PALETTE) for (const piece of CONFETTI_PIECES) expect(confettiColor(piece, body)).not.toBe(body);
  });
});
