# PRD-09: Gloo card generation

## Goal

Runtime insight-card generation through the Gloo API: the complete server-side
integration that turns an encounter into a validated six-card set — the model
call, the transport it rides on, the credential boundary it respects, and the
seam it plugs into — with a reviewed fallback when it fails or is unavailable.
One half of what challenge grading actually looks at, and one of the project's
two stated learning goals (ADR-0003).

This used to share a document with YouVersion sign-in and sync, as PRD-09 "the
challenge integrations." That bundling was deliberate: both had been the last,
easiest-to-cut layer in earlier drafts (PRD-05 layer 4, PRD-06 workstream D), and
putting them in one place made cutting either a decision instead of a quiet
outcome. Splitting them into separate documents again only preserves that if each
one's own "if cut" tradeoff stays loud in review, which is why it is restated below
rather than left to live only in [PRD-10](./10_youversion_sign_in_and_highlight_sync.md).

Supersedes PRD-09 workstream A ("The challenge integrations"), unchanged in
substance.

## Prerequisites

- [PRD-08](./08_playable_demo.md) phase 1 merged, for the encounter record that
  persists a generated card set and the six-card validation the model output is
  checked against.
- The Vercel AI SDK is not yet a dependency. This PRD adds `ai` and
  `@ai-sdk/openai-compatible` (ADR-0002, "Content"); those are the only new
  runtime dependencies it introduces.
- One shared surface to expect conflicts in if this runs alongside
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md): `runtime.ts`, the single
  composition point. The Scripture card component is not shared with PRD-10 the way
  it was when both lived in one document; this workstream does not touch it.

## The integration

The earlier version of this PRD specified the *result* — a route that returns a
validated six-card set with a fallback — but named none of the integration that
produces it, even though ADR-0002 and ADR-0003 had already decided it. This
section makes those decisions the spec so the whole API path, not just its
output, is what gets built and reviewed.

**Transport.** The Vercel AI SDK (`ai`) with the `@ai-sdk/openai-compatible`
provider, pointed at Gloo AI Studio's OpenAI-compatible base URL, calling
`generateObject` with a zod schema. Not `streamText`: ADR-0003 collapsed
generation to a single non-streamed structured call, so the streaming
justification ADR-0002 originally gave this route no longer applies.
(ADR-0002 "Content"; ADR-0003 "Retained from ADR-0002".)

**The route.** One Vercel serverless route under `/api`, on the Node runtime so
the OpenAI-compatible SDK runs untouched. This is the first of the two-route
server tier; the second, the YouVersion token exchange, is
[PRD-10](./10_youversion_sign_in_and_highlight_sync.md). (ADR-0002 "Hosting".)

**Credentials.** The Gloo API key, base URL, and model id are server-side
configuration read only inside the route — Vercel environment variables, never
imported into anything Vite bundles. `AGENTS.md` §6 permits exactly one credential
in the browser bundle and it is the YouVersion `app_key` (PRD-10); the Gloo key is
not it.

**The request/response contract.** The browser posts an encounter's identity and
the authority material for it — the Daniel passage, the cross-referenced passage,
and the curated note — and the route answers with either a generated six-card set
or an explicit unavailable status. The response is a discriminated union with a
status field, mirroring `PassageResult` in `providers.ts`, so a degraded
generation is a value the caller handles rather than an exception it catches. The
curated note travels as the authority: the model distributes a human-written
claim across the cards and never decides what is true of Scripture, and nothing in
the contract lets it override or replace the note (ADR-0003, "Cards are generated
at runtime by Gloo, grounded in the curated note").

**The schema.** The zod schema `generateObject` enforces encodes the same five
constraints as `validateCardSet` in `src/core/encounters.ts`: exactly six cards,
integer values 0–5, at least one at 0, at least three above 0, no duplicate text.
These are one rule expressed twice and must not drift — the route re-checks the
model's output against `validateCardSet` after it returns, and a violation is a
hard failure, not a coerced repair.

**The seam.** A `CardProvider` interface joins `ScriptureProvider` and
`SessionProvider` in `providers.ts`, constructed once in `runtime.ts`: `isStub`
plus an async method that returns a generated set or unavailable, shaped so the
real implementation and the stub are interchangeable without a signature change.
The real implementation calls the route; the stub returns the reviewed fallback
for the reference and carries `isStub: true`. `openEncounter` in
`encounterController.ts` becomes async and asks the provider instead of reading
`fallbackCardSetFor` directly; on a generated set it persists that, on unavailable
it degrades to the fallback and the UI says the cards are not model output.

**The no-credentials path.** With no Gloo key configured, development is not
blocked (ADR-0002 "Consequences"): the route reports unavailable, or the stub
provider stands in, every encounter uses the reviewed fallback, and `isStub` stays
honest. This is the same degradation a Gloo outage takes in production, so it is
exercised on every run, not a special mode.

## Design constraints

1. **The Gloo API key is server-side only.** `AGENTS.md` §6 allows exactly one
   credential in the browser bundle and it is the YouVersion `app_key`, which
   belongs to [PRD-10](./10_youversion_sign_in_and_highlight_sync.md), not this PRD.
2. **Stubs stay honest.** Anything still stubbed after this PRD carries
   `isStub: true` and the UI says so.
3. **One structured call, no stream.** Generation is a single `generateObject`
   call per encounter; the route does not stream and there is no conversational
   route (ADR-0003 rejected free-text verdicts outright).
4. **The schema and `validateCardSet` are one rule.** The zod schema the route
   generates against and the core validator must agree, and the route validates
   its own output with `validateCardSet` rather than trusting the model to have
   met the schema.

## Acceptance criteria

- [ ] A Vercel serverless `/api` route on the Node runtime generates a six-card
      set per encounter via the Vercel AI SDK `@ai-sdk/openai-compatible` provider
      against Gloo, using `generateObject`, with the Daniel passage, the
      cross-referenced passage, and the curated note carried as the authority.
- [ ] The Gloo key, base URL, and model id are read from server-side environment
      only and never reach the bundle. A test or a build assertion proves the key
      is absent from `dist/`.
- [ ] `ai` and `@ai-sdk/openai-compatible` are added as dependencies, and the app
      builds, tests, and runs locally with no Gloo credential present.
- [ ] Output is schema-validated against the same six-card constraints as
      `validateCardSet`, hard-failed on violation, retried exactly once, then
      degraded to the reviewed fallback set for that encounter.
- [ ] The client↔route contract returns either a generated set or an explicit
      unavailable status (mirroring `PassageResult`), and every transport failure
      — non-200, network error, timeout, malformed body — resolves to unavailable
      rather than throwing.
- [ ] A `CardProvider` seam is constructed in `runtime.ts` alongside the other
      providers: a real implementation that calls the route and a stub that
      returns the fallback, both carrying `isStub` honestly. This is the
      card-generation seam; there is no separate one.
- [ ] `openEncounter` asks the provider for cards instead of reading the fallback
      directly. The set — generated or fallback — is persisted on first generation
      and never regenerated for that encounter in that save.
- [ ] A degraded encounter is still fully playable and the UI does not pretend the
      cards came from the model.
- [ ] `createStubVerdictProvider` and the whole `VerdictProvider` seam are
      **deleted**, not implemented. ADR-0003 rejected free-text verdicts outright,
      so that seam stands for a mechanic that no longer exists. Leaving it would
      be a stub for something deliberately removed.

## Out of scope

- **YouVersion sign-in, highlight sync, and consent.**
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md).
- **A streaming or conversational Gloo route.** ADR-0003 rejected free-text
  verdicts; generation is one structured `generateObject` call. There is no chat
  route on the server tier.
- **The encounter itself**: cards as a mechanic, Scripture text, the reveal, the
  read gate. [PRD-08](./08_playable_demo.md).
- **Home screen, name entry, intro, the Lamplighter.**
  [PRD-11](./11_home_screen_and_intro.md), [PRD-12](./12_lamplighter_scene_closing.md).
- **CI.** PRD-07, complete.
- **Dialogue, personas, world art, tilemaps, audio.** Content.
- **The 22 remaining fallback card sets.** This PRD covers the live path; the
  fallback only matters for offline and outage play, and PRD-08 already ships the
  two that scene 1 needs.

## Notes

Where the rules come from:

- Card generation and the six-card constraints the output is validated against:
  ADR-0003, "Decision" and "Cards are generated at runtime by Gloo".
- The transport — Vercel AI SDK, `@ai-sdk/openai-compatible`, `generateObject`,
  one `/api` route, Node runtime, no stream: ADR-0002 "Hosting" and "Content",
  ADR-0003 "Retained from ADR-0002, unchanged".
- The one-credential-in-the-bundle rule: `AGENTS.md` §6.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference.

On cutting: if this PRD is cut entirely, the game still plays, because PRD-08
already ships two reviewed fallback card sets and every encounter degrades to that
path regardless. What is lost is the "generated live" half of the challenge's
premise: the fallback is static and reviewed, not model output, and the
demonstration that Gloo can produce validated interactive content at runtime is
what goes away, not playability.
