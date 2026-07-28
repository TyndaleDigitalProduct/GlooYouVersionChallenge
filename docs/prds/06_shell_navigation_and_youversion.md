# PRD-06: Game shell, navigation, and YouVersion

## Goal

Everything around the encounter that `storyboard-v2.md` specifies and PRD-04 either
built the wrong way or never built: how the player gets into the game, how they move
once they are in, how a scene opens and closes, and the YouVersion integration that
is half the point of the challenge. The storyboard is the source for nearly all of
it; ADR-0003 contributes only the reward causes workstream C awards and the
carried-forward rule that sign-in is never required.

Four workstreams. A and B are independent of everything. C and D each carry one
named dependency on PRD-05, recorded in place below. This runs alongside PRD-05,
not after it, but the two are not fully decoupled and pretending otherwise is how
the seams get discovered late.

## Prerequisites

- PR #3 merged.
- Two real dependencies on PRD-05, both narrow:
  - Workstream C needs the `scene-complete` and all-references constants from
    PRD-05 layer 1.
  - Workstream D's highlight-on-read needs the Scripture card component from
    PRD-05 layer 3, since that is what knows a passage was opened.
- Three shared surfaces to expect conflicts in, and nowhere else: `runtime.ts`
  (the single composition point), the v3 save schema (see Notes), and the
  Scripture card component.

## Workstream A: click to move

Click-to-move has been the design since v1 of the storyboard, and
`storyboard-v2.md` line 31 lists it as unchanged in v2. PRD-04 shipped arrows and
WASD instead, so this replaces them. ADR-0003 is about card-selection encounters
and says nothing about input; the source here is the storyboard.

- [ ] Click or tap a point and the player walks there, replacing arrows and WASD.
- [ ] Click a character to walk to them and open the interaction, so talking is
      one gesture rather than walk-then-press.
- [ ] The interaction radius is **explicit**, and a click inside it opens the
      interaction without also moving the player. Both halves are required by
      `storyboard-v2.md` §4 step 2, and the second half is the one that gets found
      in QA rather than in review.
- [ ] **The lantern affordance.** Personas carry a lantern and a lit lantern means
      interactable, per `storyboard-v2.md` item 9 and §4. This is the only signal
      telling a touch player what can be interacted with, since there is no hover
      and movement is now click-driven. It is real work and it belongs here, not
      to content.
- [ ] Pathing handles the region bounds the world already defines. No pathfinding
      around obstacles is required, since the ground is open rectangles.
- [ ] The eight-direction sprite animation still selects the correct row from
      movement direction, using the existing `spriteDirections.ts` geometry.
- [ ] Touch works. This is the reason for the change.
- [ ] Keyboard movement is removed, not left as a second path. Two input schemes
      means two things to keep working and the e2e suite currently drives the
      keyboard, so those tests move to clicks.
- [ ] **Accepted tradeoff, stated deliberately:** removing keyboard movement also
      supersedes `ProximityPrompt`'s `e` key, which leaves no keyboard path through
      the game at all. Nothing in the storyboard or `AGENTS.md` requires one, and
      a11y appears in the storyboard only as alt text (line 196), so this is a
      choice rather than a violation. Record it in the PR so it is a known gap and
      not an accident.
- [ ] The overlay still does not intercept pointer events outside its own
      controls. There is an e2e test for this from PRD-04; it must keep passing,
      and it matters much more once movement is click-driven.

## Workstream B: home screen, name entry, intro

- [ ] Two entry states decided by whether a readable save exists: title, tagline,
      and a single *Enter* action when there is none, Continue plus New game when
      there is one. *Enter* is a button, not the Enter key. Worth saying now that
      workstream A removes keyboard input.
- [ ] New game over an existing save confirms first, and the confirm says exactly
      what is lost: progress, encounter state, and local highlights. Nothing more.
- [ ] Name entry is **required**. The player cannot continue without entering one,
      because every `{name}` line in the dialogue works unconditionally and no
      fallback form of address has been written.
- [ ] The name is substituted into dialogue wherever `{name}` appears.
- [ ] The intro is skippable and reopenable, so a returning player is not trapped
      in it and a curious one can find it again. `storyboard-v2.md` §3 puts the way
      back behind the HUD menu, which means this workstream creates that menu. Note
      that an editable name (surfacing decision 2 below) would live on the same
      surface, so building it once covers both.
- [ ] The optional YouVersion sign-in offer appears here, and declining is a
      first-class path to the full game rather than a dead end.
- [ ] The name is persisted in the save, which means a save format change. Confirm
      whether it lands as part of PRD-05's v3 or as its own v4. See Notes.

## Workstream C: the Lamplighter

Currently absent from every content file and every line of code. It is the only
character who can end a scene, so as designed the scene has no exit.

- [ ] A Lamplighter opens every scene with the full passage and closes it.
- [ ] It is **reachable** at scene exit. PRD-04's scene ended when dialogue ran
      out; the storyboard's version requires a character the player can find and
      walk to, and item 8 flags that as written the only character who could end
      the scene was unfindable.
- [ ] Exit copy branches three ways: all encounters engaged, some, none. None of
      the three is punitive about the ones skipped.
- [ ] Completing the scene through the Lamplighter awards the scene-complete
      stones and, where earned, the all-references bonus. **Depends on PRD-05
      layer 1** for those two causes and the orchestrator that computes the bonus.
      Everything else in this workstream can be built and tested without it.
- [ ] **Blocked on content:** the Lamplighter has no dialogue, no art, and no
      persona definition. The engine work here is small; what it renders does not
      exist. Build against clearly labelled placeholder copy, per the existing
      placeholder policy in `daniel-1.dialogue.json`, and flag it in the PR.

## Workstream D: YouVersion sign-in and highlight sync

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
      `storyboard-v2.md` item 7 and §4 step 7. **Depends on PRD-05 layer 3**, which
      builds the Scripture card and its read gate; that gate is what defines "read".
      Capture belongs here, the trigger comes from there, so agree the seam before
      either side writes it.
- [ ] **Blocked on a decision: the highlight colour scheme.** Open decision 3 in
      `storyboard-v2.md`. `highlights.ts` stores one colour per reference and
      `DAN.1.1` is the anchor for both Scene 1 encounters, so with no decision the
      anchor flips colour depending on which encounter the player opens first.
      PRD-05 declares this out of scope, so it lands here by default. One game
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

## Out of scope

- **The encounter itself**: cards, generation, Scripture text, the reveal. PRD-05.
- **CI.** PRD-07.
- **Dialogue for scenes 2 through 9**, and authored copy for scene 1. Content.
- **The six designed personas.** Content, and it gates workstream C's Lamplighter
  copy along with the rest of the cast.
- **World art, tilemaps, audio.** Still empty directories.
- **Scene revisit.** Open decision, and it interacts with workstream C: if the
  Lamplighter's exit is final, the exit copy must say so, and if revisit exists,
  the all-references bonus becomes reachable after completion. Resolve before
  writing the exit copy.

## Notes

Where the rules come from:

- Two entry states: `storyboard-v2.md` item 13 and §1.
- Required name: item 14 and §2.
- Skippable and reopenable intro, with the way back behind the HUD menu: §3.
- Click to move, and the interaction radius rule: line 31 and §4 step 2.
- The lantern affordance: item 9 and §4 step 2.
- Lamplighter opening the scene with the full passage and closing it: §4 steps 1
  and 6.
- Reachability at exit and the three-way exit copy: item 8.
- Highlights captured locally always and sync being opt-in:
  `storyboard-v2.md` item 10 and §2.
- Sign-in never required: ADR-0002, carried forward by ADR-0003.
- The one-credential-in-the-bundle rule: `AGENTS.md` §6.

Citation convention, matching PRD-05 and PRD-07: `§n` is a numbered section of the
cited document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

Four things to surface rather than decide. The first is time-sensitive:

1. **Which save version carries the player name. Decide before PRD-05 layer 1
   lands.** Workstream B needs a persisted name and PRD-05 is already migrating v2
   to v3. Adding the name to that migration is much cheaper than a second one, but
   PRD-05 as written does not mention a name field at all, so the default outcome is
   that v3 ships without it and this workstream owns a v4. Cleanest is for PRD-05's
   v3 schema to carry an optional name field it does not read, so this workstream
   only fills it. **That requires an edit to PRD-05, not just a note here.** If
   PRD-05 layer 1 has already merged by the time this is picked up, stop treating
   this as open: workstream B owns `migrateV3ToV4` and says so in the PR.
2. **Whether the name is editable after creation.** Open decision 6 in
   `storyboard-v2.md`. Write-once is simpler; editable makes it save state with a
   settings surface to change it from, and workstream B is already building the HUD
   menu that surface would live on.
3. **The highlight colour scheme.** Open decision 3 in `storyboard-v2.md`, blocking
   a criterion in workstream D. PRD-05 declares it out of scope, so it arrives here
   whether or not this PRD wants it. One colour unblocks the work immediately; two
   changes the reference-to-colour model in `highlights.ts`.
4. **Refresh token storage.** Flagged in workstream D. This is a security decision
   the operator owns and it may need an ADR before code lands.

On ordering: A and B are small, self-contained, depend on nothing outside this PRD,
and make the game feel like a game, so they are the cheapest visible progress
available and they start first. D is the largest risk in the project and the least
understood, so starting it late is how it ends up cut; its dependency on PRD-05
layer 3 covers only highlight-on-read, so sign-in, consent, and sync can all be
built before layer 3 exists. C is engine-cheap and content-blocked, which makes it
the one workstream where the bottleneck is not this team, and its PRD-05 dependency
is two constants.

On the self sprite: open decision 4 in `storyboard-v2.md` asks whether the player
is `youth_a` or `youth_b`, with the other becoming an NPC. Workstream A touches the
player sprite, so it is the natural moment to settle it. `characters.json` currently
maps the player to `daniel_judean-tone2`. The cost here is lower than it looks:
`art/characters/youth_a/` and `youth_b/` both exist with three tones each, they are
simply not among the seven sheets in `public/assets/sprites/`. So this is copying two
files and editing one content row, not commissioning art. Worth checking the decision
still means what it did.
