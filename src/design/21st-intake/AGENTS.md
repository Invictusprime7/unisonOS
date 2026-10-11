# Directory rules
- Motion/3D sources pass through `experiencePackIntake.ts`; three.js deps are capability-gated (never shipped raw) and must be adapted onto `@/unison/ui/experience` before promotion; why: WebGL guards, budgets and fallbacks live only in the experience primitives.
