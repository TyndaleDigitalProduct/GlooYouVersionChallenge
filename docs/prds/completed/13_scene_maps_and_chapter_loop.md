# PRD-13: Scene maps, room transitions, and the chapter loop

**Delivered 2026-07-30**, all eight delivery steps, on PR #14. All five quality
gates green: 565 tests, e2e 15/15, coverage exit 0, build and lint clean.
`src/core/` untouched, as ADR-0004 intended.

Two things were *not* closed by the gates, because no gate can close them, and
they are carried forward rather than claimed as done:

- **About a dozen of scene 1's ~38 city houses are not blocked.** A second art
  variant with no dark outline and per-instance noise, so neither outline
  detection nor template matching finds them. Needs eyes. The criterion as
  written names walls, pools, tents and the dais, all of which are blocked.
- **101 placements pass the validator but have not all been seen.** The validator
  proves nobody is walled off, overlapping, or out of bounds. It cannot prove
  anyone is standing somewhere sensible, and eight of the nine scenes were
  authored by workers that never saw the pictures.

One decision was superseded mid-flight: transitions were **walk-to-exit** for
part of the day, then became a **fade on an explicit control**. The text below
records the final decision; the walk-to-exit reasoning survives only in the
`Resolved by the operator` section and in PR #14's history.

## Goal

Turn nine coloured rectangles into nine places, and connect them into a game that
runs from Daniel 1:1 to Daniel 1:21 without the player ever seeing a placeholder.

This is the last structural PRD. Everything before it built systems that work
against a world drawn from `Phaser.GameObjects.Rectangle`; PRD-04 said so at the
time ("Everything in this file is expected to be replaced by real map data",
`src/game/worldLayout.ts`), and ADR-0002 left the map pipeline open, blocking it.
[ADR-0004](../decisions/0004-scene-rooms-and-map-authoring.md) closes that
question. This PRD implements it.

Three things land together because none of them is testable alone:

1. **Scene maps.** Each scene gets a real backdrop, real collision, and
   hand-placed cast, replacing the 3x3 region grid and the three arithmetic
   character rows.
2. **Room transitions.** The player moves between scenes. Today `completeScene`
   fires and nothing happens visually; the world is one map and there is
   nowhere to go.
3. **The chapter map.** Fog of war leaves the world canvas and becomes a
   progress screen for the nine scenes of Daniel 1.

Cut any one and the other two cannot be demonstrated: maps with no transitions
is a single room, transitions with no maps is nine identical grey grids, and a
chapter map with neither is a menu over a spike.

This PRD is dispatched differently from every one before it: an `opus` lead
builds the systems and proves one scene, then fans the remaining eight out to
`sonnet` workers. See [Delivery](#delivery) for the ordering, which is not
negotiable, and for what may and may not be fanned out.

## Prerequisites

- **[ADR-0004](../decisions/0004-scene-rooms-and-map-authoring.md) accepted.**
  Accepted by the operator 2026-07-30. Its "nine rooms, not one world" decision
  is the load-bearing one here and every acceptance criterion below assumes it.
- [PRD-12](./completed/12_lamplighter_scene_closing.md) merged. This PRD replaces
  its three arithmetic placement rows with authored coordinates, so it needs
  them to exist first.
- **Art landed 2026-07-30**, from Kevin Rose, in
  `art/environments/Daniel 1 Environments/`:
  - Four 1920x1080 backdrops: `Jerusalem Seige.png` (sic, misspelled at
    source), `Temple.png`, `Babylon Palace.png`, `Throne Room.png`.
  - `Environment Elements/`, 62 transparent PNGs across four subfolders, being
    the individual props composited into those four backdrops. This is what
    makes walk-behind solvable without new art (see phase 3).
- **Provenance blocks use.** `AGENTS.md` §6: never add an asset whose licence
  you cannot name. `art/sources.md` covers `art/environments/**` for the
  earlier delivery but has no row for the 2026-07-30 files. **Add the row
  before staging anything.** Same author, same terms, but it must be written
  down first.

## Acceptance criteria

### Phase 1: staging and provenance

- [ ] `art/sources.md` gains a row for the 2026-07-30 delivery (4 backdrops +
      62 elements), naming Kevin Rose and GPL-3.0, matching the existing rows.
- [ ] A staging script exists (`scripts/stage-assets.*`, wired to a `pnpm`
      script) that copies `art/` masters into `public/assets/` with the
      renaming rules applied. Today this is done by hand: the 32 sheets in
      `public/assets/sprites/` were copied and renamed manually, which is
      already unreproducible and gets worse with 66 more files.
- [ ] Backdrops land in `public/assets/maps/` with normalised names:
      `jerusalem-siege.png` (fixing the source misspelling), `temple.png`,
      `babylon-palace.png`, `throne-room.png`. **The typo is fixed at staging,
      not by renaming the master** — the master is what the artist sent.
- [ ] Elements land in `public/assets/maps/elements/<map>/<prop>.png`.
- [ ] `Temple.png` (2.0 MB) and `Throne Room.png` (1.9 MB) are reduced. They are
      flat-palette pixel art at the same dimensions as `Babylon Palace.png`
      (364 KB); the delta is fine noise texture, not content. Palette
      quantisation or WebP, whichever holds up visually. **Acceptance is a
      visual diff, not a byte count** — if reduction is visible at 1:1, ship the
      large file and say so.
- [ ] Total `public/assets/maps/` payload is recorded in the PR description.

### Phase 2: the map format, split by what the data belongs to

The format is **two kinds of file, not one**. This is the change that makes the
fan-out in [Delivery](#delivery) safe, and it is the reason phase 2 must be
settled before any scene is authored.

**Backdrop files, one per picture (4 total).** Collision rectangles and overlay
prop placements. These describe the *image*, so they are the same for every
scene that uses it. Authored once by the lead. If they lived in the scene file
instead, five separate workers would independently derive collision for
`babylon-palace` and produce five different answers, with nothing comparing
them.

**Scene files, one per story beat (9 total).** Backdrop key, player spawn point,
cast placement, exit placement. These describe the *beat*, differ genuinely
between scenes that share a picture, and are what gets fanned out.

- [ ] Both kinds are authored JSON in `content/`, loaded through
      `src/content/loadContent.ts` and validated in `src/content/schema.ts`,
      like every other authored content file (ADR-0002's `Data/` vs `content/`
      boundary: these are authored, not derived).
- [ ] Collision and overlay data appear **only** in backdrop files. A scene file
      carrying a collision rectangle is a schema error, not a merge: it means
      the split has been misunderstood and the fan-out is no longer safe.
- [ ] A scene naming a backdrop that is not staged, or a backdrop file that does
      not exist, **fails loudly at boot**, matching how `buildCast`
      (`src/content/cast.ts`) already fails for a speaker with no art. A missing
      map must never degrade to a grey rectangle, because that is exactly the
      placeholder this PRD removes and it would ship silently.
- [ ] Four backdrop files and nine scene files exist. Scenes 3-7 reference
      `babylon-palace`; scenes 8-9 reference `throne-room`.

### Phase 3: rendering, collision, and depth

- [ ] The backdrop draws at 1:1 in world space, below everything. One world
      pixel is one backdrop pixel (ADR-0004). `WORLD_WIDTH`/`WORLD_HEIGHT`
      (1920x1080) and the camera bounds already match; no geometry change is
      expected and any need for one is a signal something is wrong.
- [ ] The 3x3 region grid is **deleted**, not disabled: `regionRects`,
      `RegionRect`, `REGION_COLUMNS`, `REGION_ROWS`, `REGION_WIDTH`,
      `REGION_HEIGHT` from `src/game/worldLayout.ts`, and `drawRegions` from
      `src/game/WorldScene.ts`, along with the now-unused `PALETTE` ground/fog
      entries and `FOG_ALPHA`.
- [ ] `clampToWorld` grows into rectangle collision. The player cannot walk
      through walls, pools, tents, or the throne dais. Pure, in `src/game/`,
      unit-tested, under the 90% gate.
- [ ] Click-to-move handles a click on a blocked tile without wedging the
      player against a wall or freezing the walk loop. **This is the most
      likely regression:** `movePlayer` currently walks a straight line to the
      target and stops on `ARRIVAL_EPSILON`, which never arrives if a wall is in
      the way.
- [ ] Walk-behind works. Tall props from the element set are placed as a second
      copy at the same coordinates as the baked-in original, drawn above the
      player, so the player is hidden when behind them and unchanged otherwise.
      At minimum: `soldier_tent`, `command_tent`, `siege_tower`,
      `tower_limestone`, `temple_building`, `house_judean` (siege);
      `temple_building_burnt`, `burning_house` (temple); `palace_facade`,
      `ziggurat_etemenanki`, `tower_glazed`, `date_palm`, `garden_terrace`
      (palace); `throne`, `cedar_column_large`, `cedar_column_small`, `banner`
      (throne room).
- [ ] An overlay copy is **invisible when nothing is behind it.** If a seam,
      halo, or misalignment is visible against the baked original, the
      coordinates are wrong. This is a visual check, not a test.

### Phase 4: authored blocking

Coordinates are **hand-authored against the images, then corrected in a visual
review pass with the operator** (operator decision, 2026-07-30). No editor tool
is built. Sequence the work so the review burden stays sane: author **scene 1
only**, review it with the operator, write down what the corrections taught
(sprite foot-anchor offset, how much clearance a doorway needs, how far from a
wall a character must stand to be clickable), then batch the remaining eight
against those rules. Authoring all nine before the first review means making the
same mistake 101 times.

- [ ] `markerRowPlacements`, `GUIDE_ROW_FRACTION`, `LAMPLIGHTER_ROW_FRACTION`
      and `CHARACTER_ROW_FRACTION` are replaced by per-character coordinates
      from the scene map. Characters stand where the scene puts them: the
      Lamplighter near an entrance, Melzar by the food tables, the mother in
      the city rather than in the Babylonian camp.
- [ ] `resolveClick` and `nearestMarker` are **unchanged**. They already take a
      list of `{reference, x, y}` and do not care where the coordinates came
      from. Changing them is a signal the placement work leaked into the
      resolution path.
- [ ] Every placed character stands on walkable ground and is reachable. **101
      placements total**: 68 story characters/NPCs, 24 guides, 9 Lamplighters.
      A character standing inside a collision rectangle is unreachable and the
      scene cannot be completed through them.
- [ ] **A validator runs over every scene file and fails the build on any
      violation.** Four checks, all pure, all in `src/game/` under the 90% gate:

      1. Every placement sits outside all collision rectangles for its backdrop.
      2. No two placements in a scene sit closer than `CHARACTER_CLICK_RADIUS`
         (40) apart, or a click meant for one resolves to the other. Scene 1 has
         12 placements; scene 3 has 12.
      3. Every placement is inside world bounds with its sprite footprint
         accounted for, not just its anchor point.
      4. **Every placement is reachable from the scene's spawn point**, by flood
         fill across the collision grid.

      Check 4 is the one that matters and is worth building even if the others
      are skipped. It converts "is this character standing somewhere sensible"
      from a visual question into an automated one, and it catches the failure
      that actually kills a scene: a character walled off, so the scene cannot
      be completed through them and the player has no way to know why. It is
      also what makes fanning scenes 2-9 out to `sonnet` workers acceptable
      rather than reckless. Without it, do not fan out.

### Phase 5: room transitions and the chapter map

Transitions are a **fade on an explicit "ready to move on" control** (operator
decision, 2026-07-30, superseding the walk-to-exit decision taken earlier the
same day). The Lamplighter closing a scene offers the control; pressing it fades
out and fades back in on the next scene at its spawn point. Nobody walks
anywhere, and there is no exit rectangle, no exit marker, and no off-screen
indicator.

This keeps ADR-0004's "Deferred: room-to-room transitions" deferred in full,
rather than partially overriding it as walk-to-exit did.

**What this decision removed from the work:** the exit's visual vocabulary, the
findability problem on a 1920x1080 map with a 960x540 view, the Lamplighter's
walk to the door and its pathing, and the `exit` field itself, which is deleted
from the schema and from all nine scene files because nothing reads it.

- [ ] Completing a scene through the Lamplighter **offers a "ready to move on"
      control** rather than moving the player or opening a door. Today
      `completeScene` fires and the world does not change at all. The control is
      **not available until the Lamplighter has closed the scene** (operator,
      2026-07-30): the Lamplighter stays the gate and the existing
      scene-complete stone award is untouched.
- [ ] The control lives in the Lamplighter's exit panel that PRD-12 already
      built (`viewStore.ts`, the branch-tagged `all`/`some`/`none` copy), not as
      a new widget on the canvas. Everything readable is in the DOM (ADR-0002).
- [ ] Pressing it loads the next scene at that scene's own spawn point.
- [ ] The `exit` field is **deleted** from `src/content/schema.ts` and from all
      nine scene files. Nothing reads it, and leaving authored data that nothing
      consumes is the kind of placeholder this PRD exists to remove. This also
      makes the shared-doorway oddity moot: all four palace scenes had
      independently kept the same provisional rectangle at (938, 282).
- [ ] **Same-backdrop transitions read correctly.** Scenes 3-7 share
      `babylon-palace` and 8-9 share `throne-room`, so for five of the eight
      transitions the player walks out of a door and arrives back on the same
      picture. Walking out of the palace to arrive at the palace is the failure
      mode. Resolution (operator, 2026-07-30): **fade out, then fade back in
      with a caption naming the time change.** The picture repeating is fine
      once the text has said time passed. Applies to all eight transitions, not
      just the five same-backdrop ones, so the vocabulary stays consistent.
      With walk-to-exit gone, this fade is the *entire* transition, so it
      carries more weight than when it was one beat of three.
- [ ] A chapter map screen shows the nine scenes of Daniel 1 and which are
      unlocked, complete, and current, driven by `revealedRegionIds` and
      `isSceneRevisitable`.
- [ ] **`src/core/` is not modified.** `fogOfWar.ts` and `progression.ts`
      already return exactly what a chapter screen needs, and `regionId` is
      already a 1:1 alias of scene id (`regionIdFor`, `loadContent.ts`). If this
      PRD finds itself editing `src/core/`, stop and re-read ADR-0004: the
      decision was explicitly shaped so that reworking the world cannot reach
      the rules.
- [ ] A completed scene can be re-entered, consistent with `isSceneRevisitable`
      (PRD-12), and re-entering it does not re-award stones
      (`completeScene` already reports `changed: false`; verify the transition
      path honours it).
- [ ] Scenes 2-9 become playable. **Known trap, from PRD-12's out-of-scope
      note:** `DialogueBox`'s scene-complete screen is gated on
      `!scene.playable`, so flipping a second scene to playable stops it firing
      and broke `pnpm e2e` on 2026-07-29. Fix the gate; do not work around it.
- [ ] Finishing scene 9 reaches a defined end state rather than a dead world.
      `isGameComplete` already exists and is unused.

## Delivery

An `opus` lead builds the systems and proves one scene; eight `sonnet` workers
author the rest. This is the first PRD in the loop dispatched as anything other
than a single worker, and the split is deliberate: phases 1-3 and 5 are
system work with real coupling, while scene authoring is pattern-following once
a proven example and a written rule set exist.

Note that the model override cannot pin a version (`opus` resolves to whatever
Opus the session is on), so if a specific Opus version is wanted, set it on the
session before dispatching.

### Ordering. Not negotiable.

1. Lead: phases 1, 2, 3.
2. Lead: all four backdrop files (collision + overlays). Not fanned out, per
   phase 2.
3. Lead: scene 1's scene file, and the phase 4 validator.
4. **Operator reviews scene 1 in the running game.**
5. Lead: writes down what the corrections taught, as a rule set the workers get
   verbatim. Expect it to cover sprite foot-anchor offset, how much clearance a
   doorway needs, how far from a wall a character must stand to stay clickable,
   and how close to a collision edge a spawn point can sit.
6. Fan out: one `sonnet` worker per scene, scenes 2-9.
7. Lead: runs the validator on every returned file, rejects and re-dispatches
   failures, and reviews the accepted set as a whole before opening the PR.
8. Lead: phase 5.

Step 4 is the gate. Firing the workers before the operator has seen scene 1
produces eight scenes with the same mistake in them, which makes the review
burden worse rather than better, and is the specific failure this ordering
exists to prevent.

### What may be fanned out

Scene files only: backdrop key, spawn point, ~11 cast coordinates, exit
placement. Distinct files per worker, so no write conflicts and no worktree
isolation needed.

### What may not

- Phase 2, the format itself. Get it wrong and all thirteen files are wrong.
- Phase 3, collision and pathing and depth. `movePlayer` walks a straight line
  to its target and stops on `ARRIVAL_EPSILON`, which never arrives with a wall
  in the way; and overlay alignment a few pixels off shows as a halo. Both are
  easy to get subtly wrong in ways the suite will not catch.
- The four backdrop files.
- Phase 5, transitions.

### Honest caveat

Placing things accurately by eye in a 1920x1080 image is hard for any model,
Opus included, and errors are invisible until the game runs. The phase 4
validator is what makes this delivery model acceptable, not a nice-to-have. If
it proves awkward to build, that is an argument for the dev editor overlay the
operator passed on, not an argument for skipping the checks.

## Out of scope

- **Audio.** `public/assets/audio/` is still empty and no audio masters exist.
- **Portrait busts for the Lamplighter and the six personas.** Still missing,
  flagged as blocked in PRD-12. Encounters render `ex_*` stand-in portraits
  meanwhile. Asset request, not engineering, and it does not block any
  criterion here.
- **Room-to-room walking.** The palace and throne room have matching doorways
  drawn, which invites walking between them. Deferred in ADR-0004 and not
  picked up here.
- **Rebuilding any map from `art/tiles/` and `art/objects/`.** Rejected in
  ADR-0004. The 3/4 prop set (`objects/*_34`) is not used in Daniel 1.
- **Later chapters.** `furnace` and `lions` in the earlier 320x224 set are
  Daniel 3 and Daniel 6.
- **Gloo card generation and YouVersion sign-in.** PRD-09 and PRD-10.

## Resolved by the operator, 2026-07-30

- **Transitions are walk-to-exit.** Lamplighter opens an exit; the player walks
  to it. Not an automatic cut, not a return to the chapter map. Phase 5.
- **Scenes 3-7 roam the whole palace.** No per-scene camera or movement bounds.
  Only spawn point and cast placement differ between them. Accepted risk: the
  five scenes may read as one place visited five times, and the mitigation is
  entirely in spawn choice and blocking.
- **Coordinates are hand-authored with a visual review pass.** No editor tool.
  Phase 4, scene 1 first.
- **Scope is all nine scenes and the full loop.** Not a scene-1 slice.
- **ADR-0004 accepted.** Prerequisite cleared.
- **Transitions fade on a "ready to move on" control** in the Lamplighter's exit
  panel, available only once the Lamplighter has closed the scene. Nobody walks
  to a door. This supersedes the walk-to-exit decision taken earlier the same
  day, and with it the Lamplighter's walk, the exit marker, and the `exit` field.
  Phase 5.
- **Same-backdrop transitions fade out and fade back in with a caption naming
  the time change.** Phase 5.

## Open questions

Both blocking questions were answered by the operator on 2026-07-30 and are
recorded in the section above and in the phase 5 criteria. None remain blocking.

Non-blocking. Answers change details; the work can start without them.

3. Does the chapter map replace the home screen's Continue, sit beside it, or
   open from the HUD menu? Note that walk-to-exit leaves the chapter map with no
   role in the main loop, so it is now purely a progress view and a way back
   into completed scenes.
4. Does the chapter map need art? Nothing in `art/` looks like a chapter map,
   and a text list would be a placeholder in a PRD whose point is removing them.
5. WebP or quantised PNG for the two heavy backdrops?
6. On re-entering a completed scene, are its guides' encounters replayable, or
   shown resolved? PRD-12 left revisit as a surfaced open decision and it is
   still open. Walk-to-exit makes this sharper: a revisited scene's exit is
   presumably open from the start, which is a different rule from a first visit.
7. What does the end state after scene 9 look like: a screen, a return to the
   chapter map with everything complete, or a return to the home screen?
8. Should the fog colours in `PALETTE` be kept for the chapter map or deleted
   with the rest of the grid?
9. Do the four backdrops need an in-game credit for Kevin Rose beyond
   `art/sources.md`?

## Notes

Where the rules come from:

- Nine rooms rather than one world, full-map backdrops, authored JSON over
  Tiled/LDtk, and `src/core/` staying untouched: ADR-0004, all sections.
- The scene-to-setting mapping (siege → 1, temple → 2, palace → 3-7, throne
  room → 8-9) is ADR-0004's Context section, derived from the `setting` field in
  `content/daniel-1.refs.json`.
- Placement counts are from `content/daniel-1.dialogue.json` (68 characters
  across nine scenes) and `content/daniel-1.refs.json` (24 cross-references).

Two traps worth repeating because both have already cost a day:

- The `playable` gate in `DialogueBox` (PRD-12 out-of-scope note, `pnpm e2e`
  breakage 2026-07-29).
- Provenance before use (`AGENTS.md` §6). The 2026-07-30 delivery has no row in
  `art/sources.md` yet.

On cutting: if this PRD is cut, the game is nine grey rectangles with real
characters standing in rows on them, and the four finished maps sit unused in
`art/`. Every other system is done. This is the one that makes it look like a
game.
