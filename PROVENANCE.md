# Provenance

Agentfaces is an original implementation written by Hammed Ajibade at Specvista. It contains no third-party code, path data, fonts, images or other assets.

How each part was made:

- **Body shapes** (circle, triangle, square) are hand-set paths on a 100 unit grid.
- **Faces** are built in code from a small set of parameters per eye (size, roundness, slant, lids with their own bow and tilt, pupil, glint) and per mouth (width, curve, openness, corner lift). Every expression is one parameter set in `src/core/expressions.ts`.
- **Glyphs** are generated: the exclamation and check marks come from a variable-width stroker, the question mark from a circular hook plus a tangent-continuous tail, and the heart from the classic parametric heart curve. Dots are placed by a formula from the end of their stroke.
- **Morphs** blend signed distance fields of the body and the glyph and trace the result with marching squares, then smooth it with Taubin smoothing. These are standard, published techniques.
- **Timing** comes from a documented tempo scale (`tempo(step) = 400 ms * 2^(step / 3)`, rounded to 20 ms) and springs described by frequency and damping ratio.
- **Confetti** is generated from a seeded random number generator (mulberry32 over an FNV-1a hash, both public domain).
- **State and expression names** are our own vocabulary for agent work states.
- **Voice** levels use a root mean square on a decibel scale with one-pole attack and release smoothing, both standard signal processing. The mouth mapping, band edges, synthetic voice and every timing constant in `src/core/audio.ts` and `src/core/voice.ts` were chosen for this project.
