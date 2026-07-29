# PRD-11: Home screen, name entry, and intro

## Goal

How the player gets into the game: the home screen with name entry and the intro.
Something the storyboard specifies in detail and PRD-04 either built the wrong way
or never built.

Small, self-contained, and the cheapest visible progress available. Does not touch
`src/core/` rules or the encounter itself.

This used to share a document with the Lamplighter, as PRD-10 "shell and scene
framing." Splitting them out separately reflects that they were already
independent workstreams with no dependency on each other; the Lamplighter
(now [PRD-12](./12_lamplighter_scene_closing.md)) is content-blocked while this
one is not, so bundling them under one PR timeline only slowed down the half that
was ready to ship.

Supersedes PRD-10 workstream A ("Shell and scene framing"), unchanged in
substance.

## Prerequisites

- [PRD-08](./08_playable_demo.md) phase 1 merged, for the optional player-name
  field in the v3 save schema, which this PRD fills. PRD-08 reserves it and does
  not read or write it, so no second migration is needed. **If PRD-08 phase 1 has
  already merged without that field, stop treating this as settled: this PRD owns
  `migrateV3ToV4` and says so in the PR.**
- One shared surface to expect conflicts in, and nowhere else: `runtime.ts`, the
  single composition point.

## Acceptance criteria

- [ ] Two entry states decided by whether a readable save exists: title, tagline,
      and a single *Enter* action when there is none, Continue plus New game when
      there is one. *Enter* is a button, not the Enter key. Worth saying now that
      PRD-08 phase 4 removes keyboard input.
- [ ] The title screen background is
      `art/start_screen/Start Screen (16 x 9).png`. It replaces the two earlier
      arrow-based mockups (`Start Screen Arrow.png` and the with/without
      selection-arrow pair), which assumed arrow-key selection; that assumption is
      gone along with the keyboard input PRD-08 phase 4 removes.
- [ ] New game over an existing save confirms first, and the confirm says exactly
      what is lost: progress, encounter state, and local highlights. Nothing more.
- [ ] Name entry is **required**. The player cannot continue without entering one,
      because every `{name}` line in the dialogue works unconditionally and no
      fallback form of address has been written.
- [ ] The name is substituted into dialogue wherever `{name}` appears.
- [ ] The intro is skippable and reopenable, so a returning player is not trapped
      in it and a curious one can find it again. `storyboard-v2.md` §3 puts the way
      back behind the HUD menu, which means this PRD creates that menu. Note
      that an editable name (surfacing decision 1 below) would live on the same
      surface, so building it once covers both.
- [ ] The optional YouVersion sign-in offer appears here, and declining is a
      first-class path to the full game rather than a dead end. The provider it
      calls belongs to [PRD-10](./10_youversion_sign_in_and_highlight_sync.md); if
      that has not landed, the offer runs against the stub and the UI says so.
- [ ] The name is persisted in the save, filling the optional field PRD-08 phase 1
      reserves. No new migration if that field exists. See Prerequisites.

## Out of scope

- **The encounter itself**: cards, Scripture text, the reveal, the read gate, and
  click-to-move. [PRD-08](./08_playable_demo.md).
- **Gloo generation and YouVersion sign-in, sync, and consent.**
  [PRD-09](./09_gloo_card_generation.md),
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md). The sign-in *offer* on
  the home screen is this PRD's; the provider behind it is not.
- **The Lamplighter and scene closing.** [PRD-12](./12_lamplighter_scene_closing.md).
- **CI.** PRD-07, complete.
- **Dialogue for scenes 2 through 9**, and authored copy for scene 1. Content.
- **The six designed personas.** Content.
- **World art, tilemaps, audio.** Still empty directories.

## Notes

Where the rules come from:

- Two entry states: `storyboard-v2.md` item 13 and §1.
- Required name: item 14 and §2.
- Skippable and reopenable intro, with the way back behind the HUD menu: §3.
- The optional sign-in offer, and declining being a first-class path:
  `storyboard-v2.md` §2, and ADR-0002 for sign-in never being required.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

One thing to surface rather than decide, per `AGENTS.md` §7:

1. **Whether the name is editable after creation.** Open decision 6 in
   `storyboard-v2.md`. Write-once is simpler; editable makes it save state with a
   settings surface to change it from, and this PRD is already building the HUD
   menu that surface would live on.

One decision that is now closed and should stop being treated as open. An earlier
cut (PRD-06, note 1) asked which save version carries the player name and warned
that fixing it "requires an edit to PRD-05, not just a note here." That edit
exists: [PRD-08](./08_playable_demo.md) phase 1 reserves an optional player-name
field in v3 that it does not read or write. This PRD fills it. There is no v4.

On ordering: this PRD depends on nothing outside itself once PRD-08 phase 1 has
landed, and it makes the game feel like a game, so it is the cheapest visible
progress available.

On cutting: if this PRD is cut entirely, the encounter in PRD-08 still plays end
to end; what is lost is everything that makes it feel like a game with a start
rather than a demo that boots straight into a scene.
