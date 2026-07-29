# PRD-10: YouVersion sign-in and highlight sync

## Goal

YouVersion sign-in, local-always highlight capture, opt-in sync, and consent. The
largest unknown in the project and the least started, and half the stated purpose
of the challenge, so it should not be the thing that quietly slips.

This used to share a document with Gloo card generation, as PRD-09 "the challenge
integrations." That bundling was deliberate: both had been the last, easiest-to-cut
layer in earlier drafts (PRD-05 layer 4, PRD-06 workstream D), and putting them in
one place made cutting either a decision instead of a quiet outcome. Splitting them
into separate documents again only preserves that if each one's own "if cut"
tradeoff stays loud in review, which is why it is restated below rather than left
to live only in [PRD-09](./09_gloo_card_generation.md).

Supersedes PRD-09 workstream B, unchanged in substance.

## Prerequisites

- Nothing outside this PRD blocks starting. Sign-in, consent, sync, and local
  capture can all be built before any dependency below exists.
- **One seam to agree before either side writes it:** [PRD-08](./08_playable_demo.md)
  phase 3 owns the read gate, and highlight-on-read below is triggered by it.
  Capture belongs here, the trigger comes from there.
- One shared surface to expect conflicts in if this runs alongside
  [PRD-09](./09_gloo_card_generation.md): `runtime.ts`, the single composition
  point.

## Design constraints

1. **Sign-in is never required to play.** ADR-0002, carried forward by ADR-0003.
2. **Stubs stay honest.** Anything still stubbed after this PRD carries
   `isStub: true` and the UI says so.

## Acceptance criteria

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
[PRD-11](./11_home_screen_and_intro.md), because that is the surface it appears on.
The provider it calls is this PRD's. If PRD-11 lands first, it offers sign-in
against the stub and says so in the UI.

## Out of scope

- **Gloo card generation.** [PRD-09](./09_gloo_card_generation.md).
- **The encounter itself**: cards as a mechanic, Scripture text, the reveal, the
  read gate. [PRD-08](./08_playable_demo.md).
- **The sign-in offer surface itself.** [PRD-11](./11_home_screen_and_intro.md)
  owns the home screen UI that invites sign-in; this PRD only owns the provider it
  calls.
- **Home screen, name entry, intro, the Lamplighter.**
  [PRD-11](./11_home_screen_and_intro.md), [PRD-12](./12_lamplighter_scene_closing.md).
- **CI.** PRD-07, complete.
- **Dialogue, personas, world art, tilemaps, audio.** Content.

## Notes

Where the rules come from:

- Highlights captured locally always and sync being opt-in:
  `storyboard-v2.md` item 10 and §2.
- Sign-in never required: ADR-0002, carried forward by ADR-0003.
- The one-credential-in-the-bundle rule: `AGENTS.md` §6.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

Two things to surface rather than decide, per `AGENTS.md` §7. Both block acceptance
criteria above, so neither can wait until implementation:

1. **The highlight colour scheme.** Open decision 3 in `storyboard-v2.md`. PRD-08
   declares it out of scope, so it arrives here whether or not this PRD wants it.
   One colour unblocks the work immediately; two changes the reference-to-colour
   model in `highlights.ts`.
2. **Refresh token storage.** This is a security decision the operator owns and it
   may need an ADR before code lands. PRD-03 declined it once already, so it has
   been open across three PRDs now.

On ordering: this is the largest risk in the project and the least understood, so
starting it late is how it ends up cut. Its dependency on PRD-08 phase 3 covers
only highlight-on-read; sign-in, consent, and sync can all be built before phase 3
exists.

On cutting: if this PRD is cut entirely, local highlights still work, because
capture never depends on sign-in. What is lost is the YouVersion half of the
challenge's stated learning goal, and the reason the entry is a Gloo and YouVersion
entry rather than a Bible game — Gloo generation in
[PRD-09](./09_gloo_card_generation.md) is unaffected either way. That is the
tradeoff, stated here so that cutting it is a decision someone makes out loud.
