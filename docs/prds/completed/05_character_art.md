# PRD-05: Character art in the vertical slice

## Goal

Replace the coloured rectangles in the PRD-04 slice with the project's actual
character art: an animated eight-direction Daniel the player drives, animated
guides standing in the world, and a portrait in the encounter panel.

Narrow on purpose. This is the art that already exists being loaded and animated
correctly. It adds no rules, no content, and no new game surface.

## Prerequisites

- PRD-04 merged or in review. This branch stacks on `prd-04-vertical-slice`.
- **`art/sources.md` provenance rows filled in.** This was a hard blocker and is
  the reason no earlier PRD touched this art. See below.

## The blocker this PRD had to clear first

`AGENTS.md` §6: never add an asset whose licence you cannot name, and no asset
may be used until it has a provenance row. `art/sources.md` recorded both art
trees as UNRESOLVED and said in terms that the first PRD to load any of it was
blocked until the operator completed the rows.

Resolved 2026-07-28: the operator attests both trees were created for this
project. `art/sources.md` and `THIRD_PARTY.md` are updated, and the latter now
records that there is no third-party art in the repository at all.

Nothing else in this PRD could start until that was written down.

## What the art actually is

Established empirically, because the two trees do not follow the same
convention and neither carried a readme. Recorded in `art/sources.md` so the
next PRD does not have to work it out again.

- Walk sheets are 96x256: 4 columns by 8 rows of 24x32 frames.
- Rows are one direction each, running **clockwise from front**: front,
  down-left, left, up-left, back, up-right, right, down-right.
- Columns are a four-frame walk cycle. Columns 0 and 2 are the same neutral
  pose; 1 and 3 are the opposite steps. Column 0 doubles as the idle frame.
- Dialogue portraits are 24x24 busts numbered **counter-clockwise**
  (`1-S, 2-SE, 3-E, …`), the reverse of the sheet row order. Deriving one from
  the other would have produced wrong facings.
- Three skin tones per character, identical geometry, palette only.

The row order was confirmed by matching each character's own labelled
per-direction crop against the sheet frames pixel by pixel.

## Design constraints

- **`src/core` stays read-only.** Same as PRD-04: zero-line diff. Art is
  presentation and nothing about it reaches the domain.
- **No tilemap.** Still rectangles for the ground, so ADR-0002's Tiled versus
  LDtk decision stays open. This PRD adds characters, not a map.
- **Art direction lives in content, not code.** Which character stands in for
  which biblical section is a product decision, so it goes in a content file
  with a schema, not in a `switch` in a scene.
- **Phaser still renders no text.** Portraits are DOM `<img>`, in the overlay.
- **`public/assets/` holds only what the slice loads.** Copying all 784 files
  into the bundle to use eight of them would be waste.

## Acceptance criteria

### Sprites and animation

- [ ] The player is `daniel_judean`, animated, replacing the yellow rectangle.
- [ ] Walking in any of the eight directions plays that direction's walk cycle;
      releasing the keys settles on that direction's idle frame, keeping the
      facing rather than snapping back to front.
- [ ] Direction-to-row mapping is a pure function, unit tested against all eight
      directions plus the stationary case.
- [ ] The two scene-1 guides are animated character sprites, not rectangles.
- [ ] Guides turn to face the player when the player is near them.
- [ ] Each guide keeps a section-coloured marker at their feet, so the biblical
      section is still readable at a glance.

### Art direction as content

- [ ] A new content file maps each of ADR-0002's six biblical sections to a
      character and a skin tone, and names the player's character.
- [ ] It is validated by zod on load, like the other content files.
- [ ] Loading fails with a visible, defined error if a section present in the
      curated cross-references has no character mapped to it. A missing guide
      must not be discovered as a broken sprite at runtime.
- [ ] The mapping is marked provisional in the file: the six guide personas are
      not designed yet, so these stand-ins are a placeholder for that work.

### Encounter panel

- [ ] The panel shows the guide's dialogue portrait, rendered crisp rather than
      smoothed.
- [ ] A missing portrait degrades to the panel without one, not to a broken
      image icon.

### Gates and boundary

- [ ] `src/core/**` coverage still >= 90%, gated, and `src/core/` has a
      zero-line diff.
- [ ] No asset 404s. The existing e2e zero-console-errors check covers this, so
      a wrong path fails the build rather than shipping quietly.
- [ ] The PRD-04 walkthrough e2e still passes unchanged: swapping art must not
      change behaviour.
- [ ] All five gates in AGENTS.md §4 pass.

## Out of scope

- A tilemap, tilesets, and the Tiled versus LDtk decision. Still ADR territory.
- The other 14 characters and the other 11 archetypes. They stay in `art/` until
  a PRD needs them.
- Scenes 2 to 9 getting guides. They have no dialogue yet.
- The six guide personas as designed characters, with names and voices. This PRD
  assigns stand-in art to a section; it does not invent a persona.
- Audio. Still deferred by ADR-0002.
- Portraits for the narrator or for Daniel. The dialogue box stays text-only.
- Animation beyond walk and idle. No talk, sit, carry, or gesture states.

## Notes

The thing to watch is scope creep into world-building. Characters on a plain
rectangle field will look unfinished, and the temptation will be to start
drawing scenery to compensate. That is the world PRD's job and it needs the map
pipeline decided first.

The section-to-character mapping is the one judgement call here that is really a
product decision. It is in content, flagged provisional, and changing it is a
one-line edit precisely so the operator can overrule it cheaply.
