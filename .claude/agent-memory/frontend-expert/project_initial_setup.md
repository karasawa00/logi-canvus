---
name: logi-canvus initial project setup decisions
description: Key decisions made during initial Next.js 15 project setup — versions, config choices, and workarounds
type: project
---

Next.js upgraded to 15.5.18 immediately after scaffolding (15.3.2 had a critical CVE).

**Why:** npm audit flagged CVE in 15.3.2 during `npm install`. Always install 15.5.x or later.
**How to apply:** When adding Next.js dependencies, pin to `^15.5.18` or later.

ESLint uses flat config (`eslint.config.mjs`) not legacy `.eslintrc`. The `next-env.d.ts` file must be added to `ignores` in the flat config to suppress `@typescript-eslint/triple-slash-reference` false positive.

**Why:** ESLint 9 dropped `.eslintignore` support; `.eslintignore` produces a warning with flat config.
**How to apply:** In `eslint.config.mjs`, always include `{ ignores: ['next-env.d.ts', '.next/**', 'node_modules/**'] }` as the first config object.

`next lint` is deprecated in Next.js 15.5. The `lint` script uses `eslint . --max-warnings=0` directly.

Node.js on this machine is v22.3.0. `engine-strict=true` in `.npmrc` breaks install because some transitive deps require `^22.13.0`. `.npmrc` uses `engine-strict=false` and `package.json` engines field is set to `>=22.3.0`.

Tailwind CSS v4 uses `@import 'tailwindcss'` in CSS (not `@tailwind base/components/utilities`) and requires `@tailwindcss/postcss` in PostCSS config (not `tailwindcss` directly).

Husky pre-commit hook runs Prettier in-place (`npx prettier --write .`), then `make lint`, then `make type-check`. All three must pass for commit to proceed.

Auth.js session is extended via `src/types/next-auth.d.ts` to include `orgId` and `orgSlug` on the `Session.user` object and the `JWT` token.
