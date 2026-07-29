# PRD-09: The challenge integrations

## Goal

The two platform integrations the challenge is actually about: Gloo generating the
insight cards at runtime, and YouVersion sign-in with highlight sync. Both are
enhancements to a game that already works without them, which is the point of
building [PRD-08](./08_playable_demo.md) first.

This PRD exists as its own document for one reason. In the previous cut, Gloo was
the last layer of PRD-05 and YouVersion was the last workstream of PRD-06, so both
sat at the bottom of a list behind work that was easier to justify. Both source
documents flagged the same worry in almost the same words: PRD-05 said layer 4
"should not be the first thing cut without saying so", and PRD-06 said workstream D
"should not be the thing that quietly slips". Putting them in one PRD makes cutting
them a decision rather than an outcome.

Supersedes PRD-05 layer 4 and PRD-06 workstream D, unchanged in substance.

## Prerequisites

- [PRD-08](./08_playable_demo.md) phase 1 merged, for the encounter record that
  persists a generated card set and the six-card validation the model output is
  checked against.
- **One seam to agree before either side writes it:** PRD-08 phase 3 owns the read
  gate, and highlight-on-read below is triggered by it. Capture belongs here, the
  trigger comes from there. Everything else in workstream B can be built before
  PRD-08 phase 3 exists.
- Two shared surfaces to expect conflicts in, and nowhere else: `runtime.ts` (the
  single composition point) and the Scripture card component.

## Two workstreams

A and B are independent of each other and can run in parallel. B is the larger
unknown and the less started, so if only one person is on this PRD, B starts first.

## Design constraints

1. **The Gloo API key is server-side only.** `AGENTS.md` §6 allows exactly one
   credential in the browser bundle and it is the YouVersion `app_key`.
2. **Sign-in is never required to play.** ADR-0002, carried forward by ADR-0003.
3. **Stubs stay honest.** Anything still stubbed after this PRD carries
   `isStub: true` and the UI says so.

## Workstream A: Gloo card generation

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

## Workstream B: YouVersion sign-in and highlight sync

The largest unknown in the project and the least started. It is also half the
stated purpose of the challenge, so it should not be the thing that quietly slips.

- [ ] The real `SessionProvider` replaces `createStubSessionProvider`, which
      currently returns `youversion-sign-in-not-implemented`.
- [ ] Sign-in is never required to play. Every path through the game works signed
      out, and a test asserts it.
- [ ] Highlights are recorded **locally always**. YouVersion opt-in controls sync,
      not capture. `highlights.ts` takes no session parameter by design and that
      must not change.
- [ ] Every reference read in a Scripture card gets a highlight, per
      `storyboard-v2.md` item 7 and §4 step 7. **Depends on PRD-08 phase 3**, which
      builds the Scripture card and its read gate; that gate is what defines "read".
      Capture belongs here, the trigger comes from there, so agree the seam before
      either side writes it.
- [ ] **Blocked on a decision: the highlight colour scheme.** Open decision 3 in
      `storyboard-v2.md`. `highlights.ts` stores one colour per reference and
      `DAN.1.1` is the anchor for both Scene 1 encounters, so with no decision the
      anchor flips colour depending on which encounter the player opens first.
      PRD-08 declares this out of scope, so it lands here by default. One game
      colour is the cheap answer; anchor-versus-cross-reference needs the
      one-colour-per-reference model revisited. See Notes.
- [ ] Signing in mid-game syncs the highlights already accumulated locally, rather
      than only capturing from that point on.
- [ ] The consent moment says what will be written to the player's account, what
      happens if they decline, and does not present declining as a lesser path.
- [ ] A sync failure is recoverable and never loses the local highlight.
- [ ] The `app_key` is the only credential in the browser bundle, per
      `AGENTS.md` §6. **Where a refresh token lives is an open security question,
      not an implementation detail.** PRD-03 deliberately declined to decide it and
      flagged that it may warrant its own ADR. Do not quietly put one in the save
      blob. Stop and ask.

Note that the optional sign-in *offer* on the home screen belongs to
[PRD-10](./10_shell_and_scene_framing.md) workstream A, because that is the surface
it appears on. The provider it calls is this PRD's. If PRD-10 lands first, it offers
sign-in against the stub and says so in the UI.

## Out of scope

- **The encounter itself**: cards as a mechanic, Scripture text, the reveal, the
  read gate. [PRD-08](./08_playable_demo.md).
- **Home screen, name entry, intro, the Lamplighter.**
  [PRD-10](./10_shell_and_scene_framing.md).
- **CI.** PRD-07, complete.
- **Dialogue, personas, world art, tilemaps, audio.** Content.
- **The 22 remaining fallback card sets.** Workstream A covers the live path; the
  fallback only matters for offline and outage play, and PRD-08 already ships the
  two that scene 1 needs.

## Notes

Where the rules come from:

- Card generation and the six-card constraints the output is validated against:
  ADR-0003, "Decision".
- Highlights captured locally always and sync being opt-in:
  `storyboard-v2.md` item 10 and §2.
- Sign-in never required: ADR-0002, carried forward by ADR-0003.
- The one-credential-in-the-bundle rule: `AGENTS.md` §6.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

Two things to surface rather than decide, per `AGENTS.md` §7. Both block criteria in
workstream B, so neither can wait until implementation:

1. **The highlight colour scheme.** Open decision 3 in `storyboard-v2.md`. PRD-08
   declares it out of scope, so it arrives here whether or not this PRD wants it.
   One colour unblocks the work immediately; two changes the reference-to-colour
   model in `highlights.ts`.
2. **Refresh token storage.** Flagged in workstream B. This is a security decision
   the operator owns and it may need an ADR before code lands. PRD-03 declined it
   once already, so it has been open across two PRDs now.

On ordering within this PRD: workstream B is the largest risk in the project and the
least understood, so starting it late is how it ends up cut. Its dependency on PRD-08
phase 3 covers only highlight-on-read, so sign-in, consent, and sync can all be built
before phase 3 exists. Workstream A is smaller, better understood, and its dependency
(PRD-08 phase 1) is the first thing that lands.

On cutting: if this PRD is cut entirely, the game still plays, because PRD-08 ships
reviewed cards and local highlights work without sign-in. What is lost is both
stated learning goals of the project and the reason the entry is a Gloo and
YouVersion entry rather than a Bible game. That is the tradeoff, stated here so that
cutting it is a decision someone makes out loud.
