---
"agentfaces": patch
---

Unknown `state`, `shape` and `expression` names no longer crash a face. They fall back (`idle`, the seeded shape, the state's own expressions; `circle` in `renderFaceSvg` and `buildFaceSet`) and, in development only, warn once with a "did you mean" suggestion, for example `unknown state "needs_you". Did you mean "needs-you"?`. The core exports `checkState`, `checkShape`, `checkExpression`, `suggestName` and `unknownNameMessage`. Also: `llms.txt`, `llms-full.txt`, `AGENTS.md`, a Claude Code skill, a shadcn registry item and more npm keywords so AI coding agents find and use the library correctly.
