# PRD-09: Gloo card generation

## Goal

Runtime insight-card generation through the Gloo API: the model call that produces
a six-card set for an encounter, validated against the same six-card shape
[PRD-08](./08_playable_demo.md) phase 1 defines, with a reviewed fallback when it
fails or is unavailable. One half of what challenge grading actually looks at.

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
- One shared surface to expect conflicts in if this runs alongside
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md): `runtime.ts`, the single
  composition point. The Scripture card component is not shared with PRD-10 the way
  it was when both lived in one document; this workstream does not touch it.

## Design constraints

1. **The Gloo API key is server-side only.** `AGENTS.md` §6 allows exactly one
   credential in the browser bundle and it is the YouVersion `app_key`, which
   belongs to [PRD-10](./10_youversion_sign_in_and_highlight_sync.md), not this PRD.
2. **Stubs stay honest.** Anything still stubbed after this PRD carries
   `isStub: true` and the UI says so.

## Acceptance criteria

- [ ] A Vercel serverless route generates a six-card set per encounter, with the
      Daniel passage, the cross-referenced passage, and the curated note carried
      as the authority.
- [ ] The API key is read server-side only and never reaches the bundle. A test or
      a build assertion proves it is absent from `dist/`.
- [ ] Output is schema-validated against the same six-card constraints from PRD-08
      phase 1, hard-failed on violation, retried exactly once, then degraded to the
      reviewed fallback set for that encounter.
- [ ] A degraded encounter is still fully playable and the UI does not pretend the
      cards came from the model.
- [ ] The generated set is persisted on first generation and never regenerated for
      that encounter in that save.
- [ ] `createStubVerdictProvider` and the whole `VerdictProvider` seam are
      **deleted**, not implemented. ADR-0003 rejected free-text verdicts outright,
      so that seam stands for a mechanic that no longer exists. Leaving it would
      be a stub for something deliberately removed.
- [ ] A card-generation seam replaces it, stubbable for tests, carrying `isStub`
      honestly.

## Out of scope

- **YouVersion sign-in, highlight sync, and consent.**
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md).
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
  ADR-0003, "Decision".
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
