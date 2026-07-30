# PRD-13 resume state, 2026-07-30

Working scratch. Delete when PRD-13 merges.

**All eight delivery steps are done.** Steps 1-7 are committed on branch
`prd-13/scene-maps-and-chapter-loop`; step 8 (phase 5) is in the working tree,
uncommitted, awaiting operator approval to commit and open the PR.

The sections below are the trail as it was written at each pause, kept because
they record *why* things are the way they are. The "What is NOT done" list is
historical: see [Step 8](#step-8-phase-5-transitions-and-the-chapter-loop) at the
bottom for the current state.

## What is done: steps 1-3

The `opus` lead completed phases 1, 2, 3, all four backdrop files, scene 1's
scene file, and the phase 4 validator. It reported all five gates green:
489 tests passing (up from 439), `pnpm e2e` 13/13, coverage exit 0, with
`src/core/**` at 98.03% and the new gated modules `worldLayout.ts` 100%,
`pathfinding.ts` 98.5%, `sceneValidation.ts` 100%. **These are the lead's
numbers, not independently re-run by the overseer.** Re-run §4 before the PR.

Verified directly: `src/core/` is untouched, as the PRD demands.

`public/assets/maps/` is **1,707,690 bytes (1668 KB)**, against 4.84 MB of
masters. Goes in the PR description.

## What is NOT done: steps 4-8

4. **Operator reviews scene 1 in the running game.** ← paused here
5. Lead writes the correction rule set the workers get verbatim.
6. Fan out one `sonnet` worker per scene, scenes 2-9.
7. Lead validates and reviews the returned set.
8. Lead does phase 5: transitions, chapter map, scenes 2-9 playable, end state.

Do not start step 6 before step 4. That ordering is the PRD's and it is not
negotiable.

## Review round 1: character scale

Operator, 2026-07-30: characters read as too large and made the map feel small.
`SPRITE_SCALE` 2 → 1, so the drawn figure is 24x32 instead of 48x64. `pixelArt`
makes 1 and 2 the only options. There is no camera zoom, so this constant is the
whole world-to-character ratio.

Halved with it, because they position absolute world pixels against the drawn
figure: `FOOT_MARKER_WIDTH/HEIGHT/OFFSET_Y` and `LANTERN_OFFSET_X/Y/RADIUS`.

**Deliberately unchanged:** `PLAYER_SIZE` (22), `CHARACTER_CLICK_RADIUS` (40),
`INTERACT_RADIUS` (68). These are collision and input tuning, not art. Halving
`PLAYER_SIZE` would alter every route the validator blessed, and halving
`CHARACTER_CLICK_RADIUS` would change the separation rule scene 1 was authored
against. Side effect worth judging: at 22 under a 24-wide sprite the figure now
stops nearly flush against walls instead of overlapping them, and 68px of
interact radius is now about three sprite widths, so a guide may trigger from
what looks like a short distance.

All five gates re-run and green after this change: 493 tests (up from 489, 4 new
pinning the scale), e2e 13/13, coverage exit 0, build ✓, lint clean.

## Review round 2: walk-target marker

Operator, 2026-07-30: a ground click moved the player with no indication of
where they were heading. Added `walkTargetMarker` in `src/game/worldLayout.ts`
(pure, unit-tested) plus a `WALK_TARGET_*` constant block, and
`syncWalkTargetRing` in `WorldScene`.

A pale ring (20x8, `0xe8eef7`) on the ground at the destination, sized against
the foot marker so they read as one vocabulary, and deliberately not the
player/lantern gold, which already means "scored encounter available".

Two design points:

- **Derived from `moveTarget` every frame, not set imperatively.** WorldScene
  clears `moveTarget` in three places (arrival, blocked-in-every-direction, a
  fresh click superseding the old one), so a ring shown and hidden by hand would
  be stranded by whichever path someone forgot.
- **Ground clicks only.** A character target draws nothing: the player stops
  `INTERACT_RADIUS` short, the character is already the visible destination, and
  a ring at their feet would collide with the section-coloured encounter disc.
- The ring marks the *resolved* target, so a click inside a collision rectangle
  shows where the player will actually stop, not where the click landed.

All five gates green after this: 497 tests (up from 493), e2e 13/13, coverage
exit 0, build ✓, lint clean.

Not yet built: no exit exists. Scene 1's `exit` rect is authored at (1520, 426)
but nothing draws or detects it, and scene 2 is still `draft`. That is phase 5,
delivery step 8.

## What the operator needs to look at in scene 1

Spawn is (1143, 626), just inside the breach in the west wall.

1. **The city's pale house variant is not blocked.** ~12 of ~38 houses are
   walk-through. A second variant with no dark outline and per-instance noise, so
   neither outline detection nor template matching finds them. **Needs eyes;
   there is no tool for it.** Top fix in the review pass.
2. Player and Lamplighter are 57px apart at spawn. Legal, visually crowded.
3. Nebuchadnezzar at the tent mouth: confirm the depth sort reads right.
4. Bronze sea and bronze altar rects in the temple court are a few px off.
5. Do the Judean four at (1331-1466, 404-470) read as a group or as a row?

Scene 1's twelve placements: Gatekeeper (1140,567), Lamplighter (1200,640),
Soldier on the wall (1145,300), A mother (1252,262), Market vendor (1400,810),
Daniel (1466,440), Hananiah (1414,470), Mishael (1360,440), Azariah (1331,404),
guide 2KI.24.1-4 (1470,210), guide JER.25.2-11 (900,700), Nebuchadnezzar
(330,640).

## Two deviations from the PRD's letter that need the operator's ruling

Both were made to satisfy the PRD's criteria, not to dodge them.

- **Overlays are crops of the backdrop, not copies of the element art.** The PRD
  assumed the 62 elements were the composited layers. They are a vocabulary kit:
  only ~24 locate as exact 1:1 copies, big structures were rescaled or redrawn,
  flat fills carry per-instance noise, and several sit under a baked shadow band.
  Drawing element art over those would produce exactly the halo the PRD forbids.
  A backdrop crop is the same pixels in the same place, so "invisible when
  nothing is behind it" holds by construction. Cost: occlusion is rectangular.
- **A\* pathfinding was added** (`src/game/pathfinding.ts`), not in the PRD.
  Forced by the map: greedy sliding wedged the player in the city streets. It
  takes a body size and knows nothing about who is moving, so phase 5's
  Lamplighter walk to the door can reuse it.

## Other decisions worth knowing on resume

- **Phase-2 tension resolved with `status: "draft" | "authored"`.** Nine scene
  files exist; scene 1 is `authored`, 2-9 are `draft` with empty `placements`.
  The loader refuses `playable && status === "draft"`, so phase 5 cannot flip a
  scene playable without its map being authored first. This is the seam the
  step-6 workers write into.
- **Tall props are blocked at their base only** (49 rects). Full-block collision
  makes walk-behind unreachable. Flat-topped buildings keep full collision, so
  their overlays are inert by design.
- **Depth sorts on ground line**, overlays on bottom edge, characters on feet. A
  fixed "overlays above player" hid the heads of characters standing just below a
  prop.
- **Backdrops are lossless WebP** via ffmpeg libwebp; all 66 files verified to
  decode bit-identical (`pnpm stage:assets --verify`). Answers open question 5.
  No visible reduction because the encode is lossless.
- **Fog colours deleted**, open question 8 answered: a chapter screen is React
  and CSS per ADR-0002, so it will not read Phaser hex out of `worldLayout.ts`.
  `0x0b0e14` and `0x323d4f` are recorded in a comment.
- **No `siege_tower` overlay**: it is in the element set but not in the
  composite. A battering ram stands at the breach and was overlaid instead.
- The scene schema rejects `collision`/`overlays` by name via `z.never()`.
- Dev-only test handle `window.__verseAndValeWorld`, guarded by
  `import.meta.env.DEV`, gives the e2e suite the camera transform.

## Still-open non-blocking questions

3, 4, 6, 7, 9 in the PRD. Questions 5 and 8 were answered by the work above.
Question 6 (are a revisited scene's encounters replayable) will bite in phase 5.

## Note on the control channel

The Telegram loop was closed mid-task; the operator moved to `/remote-control`.

## Step 8: phase 5, transitions and the chapter loop

Done 2026-07-30, uncommitted. Built to the operator's **revised** transition
decision: a fade on an explicit "ready to move on" control, superseding
walk-to-exit. Nobody walks to a door.

**What a scene close looks like now.** The Lamplighter's panel is two presses.
"I'm finished here" runs `completeScene` (the Lamplighter is still the gate, the
stone award is untouched); only then does "Ready to move on" appear, naming its
destination. Pressing it fades to black, swaps the room behind the black with the
arriving scene's caption on screen, and fades back in at that scene's own spawn
point. On scene 9 there is nowhere to fade to, so the second press becomes "Close
the chapter" and lands on the end-state screen.

**`exit` is deleted** from the schema and all nine map files. The schema is a
`strictObject`, so a scene file that still carries one now fails at boot.

**Where the new pieces live.**

| Piece                          | File                                    |
| ------------------------------ | --------------------------------------- |
| Which scene follows, + caption | `src/app/sceneFlow.ts`                  |
| Chapter map data               | `src/app/chapterMap.ts`                 |
| Room + fade + map view state   | `src/app/viewStore.ts`                  |
| The fade and its clock         | `src/ui/SceneTransition.tsx`            |
| The chapter map                | `src/ui/ChapterMapScreen.tsx`           |
| The end state                  | `src/ui/ChapterCompleteScreen.tsx`      |
| Room swap                      | `src/game/WorldScene.ts` (`subscribe`)  |

**Decisions worth knowing on resume.**

- **The room on screen is explicit view state** (`ViewState.roomSceneId`), seeded
  at boot by `runtime.ts`, not a read of `currentSceneId()`. That derivation
  cannot work here: it advances the instant `completeScene` fires, while the
  Lamplighter's panel is still open, and it cannot express a revisit. This is what
  resolved the "needs the exit and the fade to exist first" comment in
  `WorldScene.activeSceneMap`.
- **The fade is DOM, not a Phaser camera fade.** The caption is readable text
  (ADR-0002), and a camera fade would darken the canvas while leaving the HUD
  bright on top of a black world.
- **The `playable` gate bug was a conflation, not a condition.** `DialogueBox`
  used `!scene.playable` as a stand-in for "the player has reached the end of the
  content", which only ever fired because completing scene 1 advanced onto an
  unplayable scene 2. Three questions were separated: which scene's dialogue
  (`roomSceneId`), is there an opening to play (render nothing if not), and has
  the chapter ended (`isGameComplete`, the end-state screen). The
  "End of the vertical slice" panel is gone.
- **`transitionCaption` is authored per scene** in `content/daniel-1.dialogue.json`,
  optional in the schema so test fixtures need not invent one, and required of the
  real nine by `loadContent.test.ts`.
- **A revisited scene replays no forced opening**, and the transition path never
  calls `completeScene`, so re-entry cannot re-award.
- **Five defaults taken on unanswered open questions** (3, 4, 6, 7, 9); each is
  argued in the doc comment of the file that implements it. Cheap for the operator
  to overrule.
- `src/core/` verified untouched.

All five gates green after the work: 565 passing / 4 skipped (up from 544),
coverage exit 0 with `src/core/**` at 98.03%, build ✓, lint clean, `pnpm e2e`
15/15 (up from 13, and the walkthrough now crosses a transition into scene 2 and
back into scene 1 through the chapter map).
