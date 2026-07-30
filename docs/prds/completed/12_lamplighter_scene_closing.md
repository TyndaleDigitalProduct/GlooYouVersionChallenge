# PRD-12: The Lamplighter, cast interaction, and scene closing

## Goal

Three pieces, all engine-cheap and all content-blocked, which is why they were
sitting in one PRD's shadow and are grouped here rather than split further:

1. **The Lamplighter**, who is the only character who can end a scene and
   currently does not exist anywhere. Currently absent from every content file
   and every line of code, so as designed the scene has no exit.
2. **Story characters and NPCs**, who have full dialogue for all nine scenes as
   of 2026-07-29 (see Prerequisites) but no way for the player to reach them:
   nothing in `src/game/` places a marker or resolves a click for anyone who
   isn't a cross-reference guide.
3. **Wiring the real cast art.** `content/characters.json` still assigns
   generic `ex_*` stand-in sprites to every guide and marks itself
   `"provisional"`, even though named, designed art for the Lamplighter, all
   six personas, and the story characters now exists in `art/Characters/`.

None of the three touch `src/core/` rules or the encounter itself.

This used to share a document with the home screen and intro, as PRD-10 "shell and
scene framing." Splitting them out separately reflects that they were already
independent workstreams with no dependency on each other; this one is content-
blocked while the home screen (now [PRD-11](./11_home_screen_and_intro.md)) is not,
so bundling them under one PR timeline only slowed down the half that was ready to
ship.

Supersedes PRD-10 workstream B, unchanged in substance. Also absorbs the
story-character/NPC interaction workstream that the pre-split draft called
"PRD-06 workstream A" — that PRD number no longer refers to a real document
(the draft was split into PRD-07 through PRD-12), and the workstream did not
land in any of the split files until now.

## Prerequisites

- [PRD-08](./08_playable_demo.md) phase 1 merged, for the `scene-complete` and
  `all-references` causes and the orchestrator that computes the bonus, which
  this PRD awards.
- One shared surface to expect conflicts in, and nowhere else: `runtime.ts`, the
  single composition point.
- **Content landed 2026-07-29**, reviewed and approved by Keith: dialogue for
  all nine scenes (`content/daniel-1.dialogue.json`, `status: "final"`),
  personas for the Lamplighter and all six guides
  (`content/personas.json`), and named walk-sprite art for the Lamplighter, all
  six personas, and every story character (`art/Characters/<name>/`). This is
  what unblocks all three pieces below; before this landed, only the Lamplighter
  bullet existed and even it had no content to build against.

## Acceptance criteria

### The Lamplighter

- [ ] A Lamplighter opens every scene with the full passage and closes it.
- [ ] It is **reachable** at scene exit. PRD-04's scene ended when dialogue ran
      out; the storyboard's version requires a character the player can find and
      walk to, and item 8 flags that as written the only character who could end
      the scene was unfindable.
- [ ] Exit copy branches three ways: all encounters engaged, some, none. None of
      the three is punitive about the ones skipped. Content already tags each
      exit beat with `branch: "all" | "some" | "none"` in
      `daniel-1.dialogue.json`; nothing reads that field yet.
- [ ] Completing the scene through the Lamplighter awards the scene-complete
      stones and, where earned, the all-references bonus. **Depends on PRD-08
      phase 1** for those two causes and the orchestrator that computes the bonus.

### Story characters and NPCs

- [ ] Story characters and NPCs are placed in the world and are clickable in
      free movement, the same click-resolution path guides already use
      (`resolveClick`, `nearestMarker` in `src/game/worldLayout.ts` — this is
      generic over any marker list, not guide-specific, so it should extend
      rather than fork).
- [ ] Clicking one plays its lines with **no read gate, no Scripture cards, and
      no scoring** — the Lamplighter's plain-beat shape, not the guide encounter
      flow. Per `storyboard-v2.md` §4 steps 3–4: "one bland line, no
      interaction" for NPCs and "1–3 scene-appropriate lines, no interaction" for
      story characters means no *scored* interaction, not no click — §3's
      "Mechanics to teach" list is explicit that "click a character to talk"
      is a core mechanic, not guide-only.
- [ ] Re-clicking a story character or NPC replays its lines rather than doing
      nothing; nothing about them is stateful or one-time, unlike a guide
      encounter.
- [ ] **Content shape change needed first:** `daniel-1.dialogue.json` currently
      flattens the Lamplighter's beats and every story-character/NPC line into
      one linear `beats` array, which is what a forced "Continue" sequence
      (`DialogueBox.tsx`) needs but a per-character lookup cannot use as-is.
      Splitting story-character/NPC beats out by speaker (or by a stable
      character id) is content-schema work, not authoring work — the scene
      files in `docs/notes/authoring/` already group lines by character; only
      the JSON shape needs to change to match.

### Cast art

- [ ] `content/characters.json` maps the Lamplighter and each of the six
      guide personas (the Elder, the Chronicler, Lady Wisdom, the Watchman, the
      Witness, the Courier) to their own named walk sprite in
      `art/Characters/<name>/`, not an `ex_*` stand-in, and those sheets are
      staged into `public/assets/sprites` following the existing convention
      (`art/Characters/<name>/<name>_sheet_8dir_24x32_tone<N>.png` →
      `public/assets/sprites/<name>-tone<N>.png`, documented in
      `src/game/spriteDirections.ts`). Drop the file's `"status":
      "provisional"` and its note claiming the personas aren't designed yet —
      they are, in `content/personas.json`.
- [ ] Story characters (Daniel, Hananiah, Mishael, Azariah, and the
      scene-specific cast — Nebuchadnezzar, Ashpenaz, Jehoiakim, …) are wired to
      their own named sprites the same way. All are already 24x32 8-direction
      sheets in the same format as the stand-ins currently in use, so no art
      reprocessing is expected.
- [ ] **Naming trap:** the art folder for the OT Poetry/Wisdom persona is named
      `art/Characters/songkeeper/`, but the reviewed, final persona name in
      `content/personas.json` is **Lady Wisdom**. Map
      `guidesBySection["OT Poetry/Wisdom"]` to the `songkeeper` art under the
      `Lady Wisdom` name; do not assume the folder name is the character name,
      and do not rename the art folder just to match.
- [ ] **Blocked, not ready to wire:** dialogue portrait busts (the 24x24
      head-and-shoulders art `encounter-portrait` renders) exist only for the
      generic `ex_*` stand-ins in `art/incoming/extras/3A - Dialogue
      Portraits/skin-*-*/` — none exist yet for the Lamplighter or any of the
      six named personas. Guide encounters need a portrait (`encounter-portrait`
      is asserted in `e2e/vertical-slice.spec.ts`); story characters and NPCs
      do not (`DialogueBox` has never rendered one). Treat new portrait art for
      the Lamplighter and six personas as a separate asset request; wiring the
      walk sprites does not have to wait on it, but flipping guide encounters
      over to the real art does.

## Out of scope

- **The encounter itself**: cards, Scripture text, the reveal, the read gate, and
  click-to-move. [PRD-08](./08_playable_demo.md).
- **Gloo generation and YouVersion sign-in, sync, and consent.**
  [PRD-09](./09_gloo_card_generation.md),
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md).
- **Home screen, name entry, intro.** [PRD-11](./11_home_screen_and_intro.md).
- **CI.** PRD-07, complete.
- **Making scenes 2 through 9 playable.** `regionRects`, `markerPlacements`, and
  `drawGuides` in `src/game/` already generalize over any playable scene in the
  manifest — this was checked, not assumed — but the world itself is still
  placeholder rectangles (no tilemap, no background art, no audio; those
  directories are still empty per PRD-04 and PRD-08). Flipping `playable` to
  `true` for scenes 2-9 before this PRD's Lamplighter and cast-interaction work
  lands reproduces the exact `pnpm e2e` breakage a content push caused on
  2026-07-29 (`DialogueBox`'s "scene complete" screen is gated on
  `!scene.playable`, so a second playable scene makes it stop firing). Land
  this PRD first; treat "make scenes 2-9 playable" as its own follow-up with
  its own world-art dependency, not a checkbox here.
- **New portrait art for the Lamplighter and the six personas.** Content/asset
  request, not engineering. See "Cast art" above.
- **World art, tilemaps, audio.** Still empty directories.

## Notes

Where the rules come from:

- Lamplighter opening the scene with the full passage and closing it:
  `storyboard-v2.md` §4 steps 1 and 6.
- Reachability at exit and the three-way exit copy: item 8.
- "Click a character to talk" as a taught mechanic, and NPCs/story characters
  being un-scored rather than un-clickable: `storyboard-v2.md` §3 ("Mechanics to
  teach") and §4 steps 2-4. Cast list and per-scene detail:
  `docs/notes/scene-01-flow.md`, "Cast" and beat 2 ("Free movement").

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

Two things to surface rather than decide, per `AGENTS.md` §7:

1. **Scene revisit.** Open decision in `storyboard-v2.md`, and it interacts
   directly with this PRD: if the Lamplighter's exit is final, the exit copy must
   say so, and if revisit exists, the all-references bonus becomes reachable after
   completion. Resolve before writing the exit copy. PRD-08 declares it out of
   scope, so it lands here by default.
2. **Story characters reacting to engaged cross-references** (`storyboard-v2.md`
   open decision 5): a cheap way to make the 24 identically-shaped encounters
   feel less repeated. Explicitly unscoped there and not picked up here either;
   flag it if it turns out to be cheap once the click-to-talk plumbing exists.

On ordering: content is no longer the blocker — the Lamplighter's copy, all six
personas, and named walk-sprite art all landed 2026-07-29. What is still
missing (portrait busts for the Lamplighter and six personas, and the
dialogue-document reshape for per-character lookup) is called out above and
does not block starting.

On cutting: if this PRD is cut entirely, a scene has no way to close (the game
cannot be called complete end to end even though every encounter in it works),
story characters and NPCs stay permanently unreachable despite having authored
lines for all nine scenes, and every guide keeps standing in front of the
player as a generic `ex_*` archetype instead of its designed persona. This is
the one PRD in the split where cutting it is closer to "not finished" than "a
feature we chose not to build."
