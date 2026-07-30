# PRD-13 resume state, paused 2026-07-30

Working scratch. Delete when PRD-13 merges.

Paused at **delivery step 4 of 8: the operator review gate.** Nothing is
committed. Everything is in the working tree on branch
`prd-13/scene-maps-and-chapter-loop`.

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
