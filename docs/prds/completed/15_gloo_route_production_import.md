# PRD-15: fix the Gloo route's production module resolution

## The bug

The deployed `/api/generate-cards` crashed with `FUNCTION_INVOCATION_FAILED`
on every invocation, on every environment (found 2026-07-31, hours before
the challenge deadline). The Gloo integration — one of the two the entry
exists to demonstrate — had likely never generated a single card set in
production. Nobody noticed because the client converts the 500 into
`unavailable` by design and every encounter silently degraded to the
reviewed fallback set, with the honest fallback notice reading as the
expected no-credentials path.

## Root cause

Vercel deploys an ESM project's `api/` functions by compiling TypeScript
per-file and tracing dependencies — it does not bundle, and it does not
rewrite import specifiers. `package.json` sets `"type": "module"`, so the
function runs as strict ESM, where a relative import must name its exact
file. The route imported `"../src/core/encounters"` (extensionless, the
repo's normal style); the compiled bundle contained `encounters.js`, Node
looked for a file literally named `encounters`, and the function died at
load with `ERR_MODULE_NOT_FOUND`. The same held transitively:
`encounters.ts` imports `./ledger`, `./manifest`, `./result`, and
`ledger.ts` imports `./result`.

Neither the suite nor CI could catch this: Vite rewrites specifiers when
bundling the app and vitest resolves them itself. The only faithful
reproduction is `vercel build`, which produces the exact deployed artifact.

## The fix

- Every *runtime* relative import reachable from an `api/` route names its
  `.js` extension (the ESM-correct style; TypeScript's `Bundler` resolution
  maps `.js` specifiers to `.ts` sources, so Vite, vitest, and tsc are all
  unaffected). Five specifiers across `api/generate-cards.ts`,
  `api/youversion-token.test.ts`, `src/core/encounters.ts`, and
  `src/core/ledger.ts`. Type-only imports are untouched — tsc erases them.
- A guard test (`tests/apiRouteImports.test.ts`) walks the transitive
  runtime-import chain from every `api/` route and fails on any
  extensionless relative specifier, so the mistake cannot ship again.

## Verification

- The guard test failed on the five bad specifiers before the fix and
  passes after.
- `npx vercel build` + loading the compiled
  `generate-cards.func/api/generate-cards.js` under Node as strict ESM:
  `ERR_MODULE_NOT_FOUND` before the fix, loads cleanly after.
- All five quality gates pass.
- Post-deploy: a live POST to `/api/generate-cards` must return
  `{"status":"generated", ...}` — the check that closes this PRD.

## Flagged for the operator (Ben)

- `api/youversion-token.test.ts` is deployed as a serverless function
  (`youversion-token.test.func`) because it lives in `api/`. Harmless but
  probably unintended; moving it is Ben's call.
- The game's public domain is `verse-vale.crevex.tech`, CNAME'd to the
  Vercel project so the YouVersion Platform connection resolves to a stable
  URI (operator, 2026-07-31). The fix lands there on deploy, and that
  domain is where the post-deploy verification should run.
