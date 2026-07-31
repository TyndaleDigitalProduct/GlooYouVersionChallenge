# PRD-10: YouVersion sign-in and highlight sync

## Goal

The complete YouVersion Platform API integration: OAuth sign-in, live Scripture
text, local-always highlight capture, opt-in sync, and consent. The largest
unknown in the project and the least started, and half the stated purpose of the
challenge, so it should not be the thing that quietly slips.

This used to share a document with Gloo card generation, as PRD-09 "the challenge
integrations." That bundling was deliberate: both had been the last, easiest-to-cut
layer in earlier drafts (PRD-05 layer 4, PRD-06 workstream D), and putting them in
one place made cutting either a decision instead of a quiet outcome. Splitting them
into separate documents again only preserves that if each one's own "if cut"
tradeoff stays loud in review, which is why it is restated below rather than left
to live only in [PRD-09](./09_gloo_card_generation.md).

Supersedes PRD-09 workstream B, unchanged in substance.

## Prerequisites

- Nothing outside this PRD blocks starting. Sign-in, consent, sync, live Scripture
  text, and local capture can all be built before any dependency below exists.
- The official YouVersion packages are not yet dependencies. This PRD adds
  `@youversion/platform-core`, `@youversion/platform-react-hooks`, and
  `@youversion/usfm-references` (ADR-0002, "Scripture text"). No client is
  hand-rolled.
- **One seam to agree before either side writes it:** [PRD-08](./08_playable_demo.md)
  phase 3 builds the Scripture card the "Highlight verse" button sits on. The button
  is this PRD's; the card is theirs. Agree where it sits and what reference it
  carries.
- One shared surface to expect conflicts in if this runs alongside
  [PRD-09](./09_gloo_card_generation.md): `runtime.ts`, the single composition
  point. Both PRDs add a real provider there; neither touches the other's.

## The integration

The earlier version of this PRD specified the *behavior* — sign-in, capture, sync,
consent — but named none of the API integration that carries it, even though
ADR-0002 had already decided the transport, the packages, the credential rule, and
the two-route server tier. This section makes those decisions the spec so the whole
YouVersion Platform API surface, not just its user-facing behavior, is what gets
built and reviewed. Live Scripture text is folded in here: the product PRD lists it
as a learning goal, no other active PRD owns it, and PRD-08 shipped only the bundled
WEB fallback the real fetch degrades to.

**Transport and packages.** The official typed packages, not a hand-rolled client:
`@youversion/platform-core` and `@youversion/platform-react-hooks` for sign-in,
Scripture, and highlights, and `@youversion/usfm-references` for parsing the USFM
references `AGENTS.md` §5 mandates. (ADR-0002, "Scripture text".)

**The routes.** The YouVersion token exchange runs on a Vercel serverless route
under `/api`, Node runtime. This is the second of the two-route server tier; the
first, the Gloo generation route, is [PRD-09](./09_gloo_card_generation.md).
(ADR-0002, "Hosting".)

**Credentials.** The YouVersion `app_key` is a public OAuth client identifier sent
as the `X-YVP-App-Key` header, and it is safe in the browser bundle — it is the one
credential `AGENTS.md` §6 permits there. Sign-in is OAuth 2.0 with PKCE and **no
client secret**, so there is no server-side secret to guard for the sign-in flow
itself. The refresh token stays in the browser and never leaves the device (see
Decisions below); it is never written to the save blob and never sent to a server.

**Sign-in.** OAuth 2.0 with PKCE. The real `SessionProvider` replaces
`createStubSessionProvider`: `signIn()` runs the PKCE flow through the platform
packages and the token-exchange route, `current()` returns the `YouVersionSession`
(`{ yvpId }`) the save already models, `signOut()` clears it. Signing in is never a
gate — every path works signed out.

**Scripture text.** Passages come from the YouVersion Platform API with
`format=text` and the `app_key` as `X-YVP-App-Key`. The real `ScriptureProvider` —
today the bundled-WEB implementation PRD-08 phase 2 committed — swaps to a YouVersion
fetch of the same async signature and the same explicit `unavailable` status, so the
call site does not change. On failure it degrades to the bundled WEB text, and
because WEB is the default translation on both paths there is no visible translation
switch (ADR-0002, "Scripture text"). The `providers.ts` comment currently mis-attributes
this swap to PRD-09, a leftover from when the two integrations shared a document;
correcting it is part of this PRD.

**Highlight sync.** Highlights are recorded locally always — `highlights.ts` takes
no session parameter and that must not change. Sync is the opt-in layer on top:
after consent, local highlights are written to the player's YouVersion account
through the Platform API, and signing in mid-game pushes everything already
accumulated rather than only capturing from that point forward. A sync failure is
recoverable and never loses the local highlight. Capture is triggered by the
player tapping the "Highlight verse" button on the Scripture card, not by the read
gate; the button lives here, the card it sits on is PRD-08 phase 3.

**The seams.** Two real providers land in `runtime.ts` alongside the Gloo one:
`SessionProvider` (real, replacing the stub) and `ScriptureProvider` (swapped from
WEB to YouVersion). Both keep `isStub` honest, and both keep the signatures
`providers.ts` already declares so the composition point is the only edit.

**The no-credentials path.** With no YouVersion credentials, development is not
blocked (ADR-0002, "Consequences"): the session provider stays the stub, Scripture
falls to bundled WEB, highlights capture locally with no sync, and every `isStub`
flag is honest. This is the same degradation an outage or a signed-out player takes.

## Design constraints

1. **Sign-in is never required to play.** ADR-0002, carried forward by ADR-0003.
2. **Stubs stay honest.** Anything still stubbed after this PRD carries
   `isStub: true` and the UI says so.
3. **The `app_key` is the only browser credential.** `AGENTS.md` §6. It is public
   and belongs in the bundle; nothing else does.
4. **Capture never depends on a session.** `highlights.ts` takes no session
   parameter. Sign-in controls sync, not capture, and that separation must survive.

## Acceptance criteria

- [ ] The real `SessionProvider` replaces `createStubSessionProvider`, which
      currently returns `youversion-sign-in-not-implemented`. Sign-in is OAuth 2.0
      with PKCE and no client secret, built on `@youversion/platform-core` and
      `@youversion/platform-react-hooks`, with the `app_key` as the public client
      identifier in the bundle.
- [ ] The YouVersion token exchange runs on a Vercel `/api` route (Node runtime),
      the second of the two-route tier (Gloo is PRD-09).
- [ ] Scripture passages come from the YouVersion Platform API (`format=text`,
      `app_key` sent as `X-YVP-App-Key`). The `ScriptureProvider` swaps from the
      bundled-WEB implementation to a YouVersion fetch of the same async/`unavailable`
      shape, degrading to bundled WEB with no visible translation switch. The stale
      PRD-09 attribution in `providers.ts` is corrected to this PRD.
- [ ] `@youversion/platform-core`, `@youversion/platform-react-hooks`, and
      `@youversion/usfm-references` are added as dependencies, and the app builds,
      tests, and runs locally with no YouVersion credentials present.
- [ ] Sign-in is never required to play. Every path through the game works signed
      out, and a test asserts it.
- [ ] Highlights are recorded **locally always**. YouVersion opt-in controls sync,
      not capture. `highlights.ts` takes no session parameter by design and that
      must not change.
- [ ] Each reference in a Scripture card has a **"Highlight verse" button** the
      player taps to record the highlight. Highlighting is a deliberate player
      action, not an automatic consequence of reading, revising `storyboard-v2.md`
      item 7 and §4 step 7 accordingly. **Depends on PRD-08 phase 3** only for the
      Scripture card the button lives on, not for its read gate: the trigger is the
      button, so the "read" definition no longer gates capture. Agree the seam
      (where the button sits on the card, what reference it carries) before either
      side writes it.
- [ ] **Highlight colour is the YouVersion default yellow.** One game colour for
      every highlight. This resolves open decision 3 in `storyboard-v2.md`:
      `highlights.ts` keeps its one-colour-per-reference model unchanged, and the
      shared anchor `DAN.1.1` is yellow in both Scene 1 encounters regardless of
      order. See Notes.
- [ ] Signing in mid-game syncs the highlights already accumulated locally, rather
      than only capturing from that point on. Sync writes to the account through the
      Platform API.
- [ ] The consent moment says what will be written to the player's account, what
      happens if they decline, and does not present declining as a lesser path.
- [ ] A sync failure is recoverable and never loses the local highlight.
- [ ] The `app_key` is the only credential in the browser bundle, per
      `AGENTS.md` §6. The refresh token **stays in the browser and never leaves the
      device** (see Decisions): never in the save blob, never sent to a server. PRD-03
      flagged this may warrant its own ADR; that ADR, if written, records this
      decision rather than reopens it.

Note that the optional sign-in *offer* on the home screen belongs to
[PRD-11](./11_home_screen_and_intro.md), because that is the surface it appears on.
The provider it calls is this PRD's. If PRD-11 lands first, it offers sign-in
against the stub and says so in the UI.

## Out of scope

- **Gloo card generation.** [PRD-09](./09_gloo_card_generation.md).
- **The encounter itself**: cards as a mechanic, the reveal, the read gate.
  [PRD-08](./08_playable_demo.md). Live Scripture *text* is in scope here; the
  card, its gate, and the reveal are not.
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
- The transport — YouVersion Platform API, `format=text`, `app_key` as
  `X-YVP-App-Key`, OAuth 2.0 PKCE, the official `@youversion/*` packages, and the
  token-exchange route: ADR-0002, "Scripture text" and "Hosting".
- The one-credential-in-the-bundle rule: `AGENTS.md` §6.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

### Decisions

Two questions that earlier drafts left open, per `AGENTS.md` §7, are now decided by
the operator. Both blocked acceptance criteria above, so they are recorded here
rather than left to implementation:

1. **Highlight colour: the YouVersion default yellow, one colour for every
   highlight.** This closes open decision 3 in `storyboard-v2.md`. It keeps the
   existing one-colour-per-reference model in `highlights.ts` unchanged, so the
   shared anchor `DAN.1.1` is yellow in both Scene 1 encounters no matter which the
   player opens first.
2. **Refresh token storage: in the browser, never leaves the device.** The token is
   held client-side and is never written to the save blob and never sent to a
   server. PRD-03 declined this once and flagged it might need an ADR; if that ADR
   is written it records this decision, it does not reopen it. PKCE already removes
   the client secret, so there is no server-side sign-in secret either.

On ordering: this is the largest risk in the project and the least understood, so
starting it late is how it ends up cut. Its dependency on PRD-08 phase 3 covers
only the Scripture card the "Highlight verse" button sits on; sign-in, consent,
sync, and live Scripture text can all be built before phase 3 exists.

On cutting: if this PRD is cut entirely, local highlights still work, because
capture never depends on sign-in, and Scripture still renders from the bundled WEB
text. What is lost is the YouVersion half of the challenge's stated learning goal —
sign-in, sync, and live Platform API Scripture — and the reason the entry is a Gloo
and YouVersion entry rather than a Bible game. Gloo generation in
[PRD-09](./09_gloo_card_generation.md) is unaffected either way. That is the
tradeoff, stated here so that cutting it is a decision someone makes out loud.
