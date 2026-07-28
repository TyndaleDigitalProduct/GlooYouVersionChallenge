# PRD-04: Playable vertical slice (scene 1)

## Goal

Get one scene of Verse & Vale running end to end in a browser, so that every
remaining design decision is made against something real instead of in the
abstract.

Scope is deliberately one scene deep and the full stack wide: Phaser renders a
world, React renders the readable UI over it, both driven by the `src/core`
store built in PRD-03, with save and reload working through the real save
format. The characters are the project's real art. Dialogue, AI, and scripture
text are stubbed. Everything that is stubbed sits behind a named interface so
the PRD that replaces it does not have to unpick this one.

## Status: provisional

This PRD is a spike. Its output is expected to be revised or thrown away by the
focused PRDs that follow, and it is written that way on purpose.

Two consequences, stated up front rather than discovered later:

1. **It is not test-first.** AGENTS.md §5 step 3 and §7's "no source without a
   failing test" are suspended for rendering and wiring code only. They still
   hold for anything pure (the content schema, the adapters' logic). The five
   quality gates in §4 are **not** suspended: all five must pass.
2. **It will force decisions that ADR-0002 deferred.** Those are listed in
   "Decisions this PRD forces" below. The PRD proposes an answer for each and
   implements it so the slice can exist. The operator writes or declines the
   ADR afterward, having seen it run. Agents still never author an ADR.

## Superseded in part by storyboard v2

**Read this before reviewing the code.** `docs/notes/storyboard-v2.md` and
`docs/notes/scene-01-flow.md` were written after this PRD was built and are now
the design authority. Several things this PRD implemented are not what the game
is going to do:

| This PRD built | Storyboard v2 says |
| --- | --- |
| Keyboard movement (arrows and WASD) | Click to move, click to talk |
| Encounter panel with a "recognise the connection" button | Read both Scripture cards, then pick at most three of six generated cards, then all six values revealed |
| No home screen; boots straight into scene 1 | Home screen with Continue / New game, required name entry, skippable and reopenable intro |
| Free-text-adjacent conversational stub | No free-text input anywhere. Rejected, not deferred |
| Stand-in archetypes per biblical section | Six named personas: Chronicler, Watchman, Songkeeper, Elder, Witness, Courier |
| Stones: engagement 1, insight 2 | Four causes: engagement 1, insight 0 to 15, scene complete 5, all-references bonus 10 |
| One scene as a slice | All nine scenes ship |
| No Lamplighter | A Lamplighter opens and closes every scene |

What this PRD built that storyboard v2 keeps: the domain core and its rules, the
versioned save format, the content loader and manifest, the sibling-overlay
architecture, the stub seams, fog of war driven off the completion set, and the
character art pipeline.

Two of those deltas need `src/core` changes, which is code behind the 90%
coverage gate, and both are recorded as blockers in storyboard v2: the ledger has
no cause for a scene-completion or all-references award and requires a verse
reference a scene-scoped award does not have, and encounter state is a bare
string that cannot carry generated cards and selections.

This PRD is not edited to match. It is the record of the spike that made the
storyboard possible to write against something real, which was its stated
purpose.

## Prerequisites

- PRD-03 merged. `src/core` is complete, covered, and boundary-tested.
- **`art/sources.md` provenance rows filled in**, before any art is loaded. See
  "Character art" below. This was a hard blocker, not bookkeeping.

## Numbering note

Earlier documents forward-reference PRD-04 as "real Daniel 1 content", PRD-05 as
world wiring, and PRD-06 as UI. This spike takes the number 04, so that planned
work shifts to 05, 06, and 07. ADR-0002 is immutable and PRD-03 is completed
history, so neither is edited; this note is the record that their forward
references are now off by one.

## Design constraints

These are the guardrails that keep the spike from costing more than it earns.

- **`src/core` is read-only.** The slice consumes the store; it does not edit
  it. If the renderer needs something core does not expose, that is reported as
  a finding, not patched in. A green `architecture.test.ts` is necessary but not
  sufficient: the PR must show a zero-line diff under `src/core/`, excluding
  `fixtures.ts` if it moves.
- **No rules outside core.** No component or scene may decide what is unlocked,
  what is revealed, or what a stone is worth. Those are all reads off the store.
- **The map pipeline decision stays open.** ADR-0002 defers Tiled vs LDtk. The
  slice therefore draws its *ground* programmatically (rectangles, no tilemap),
  so that shipping it commits to neither. Characters are real art; the map is
  not.
- **No scripture text and no invented scripture.** See "Content and text" below.
- **Art direction lives in content, not code.** Which character stands in for
  which biblical section is a product decision, so it goes in a content file
  with a schema, never in a `switch` in a scene.
- **No asset is loaded before its provenance is recorded.** AGENTS.md §6.
- **Sibling overlay, per ADR-0002.** Phaser owns the canvas, React owns a DOM
  layer above it, and they talk only over the event bus and the store.

## Content and text

The slice needs words on screen and has no authored dialogue. The rules for the
filler:

- Dialogue lives in `content/`, as JSON validated by zod on load. The curated
  `content/daniel-1.refs.json` already establishes JSON as the content format.
- Every placeholder string is visibly marked as placeholder in the UI itself,
  not only in the file. A reader looking at a screenshot must be able to tell
  that the words are not final copy.
- The content file carries `"status": "placeholder"` and the loader refuses to
  treat it as final.
- **No scripture is quoted, paraphrased, or generated.** Not Daniel, not the
  cross-references. Where passage text would appear, the slice shows the USFM
  reference plus the curated plain-language `note` already in
  `content/daniel-1.refs.json`, and an explicit "passage text arrives in PRD-07"
  placeholder. This also sidesteps translation licensing entirely for now.

Scene 1 is DAN.1.1, "Jerusalem under siege", with two curated cross-references:
`2KI.24.1-4` (OT History) and `JER.25.2-11` (Prophets).

## Character art

The art has been in the repo since PRD-02. Using it was blocked, and the block
had to be cleared before a single sprite was loaded.

### The provenance blocker

`AGENTS.md` §6: never add an asset whose licence you cannot name, and no asset
may be used until it has a provenance row. `art/sources.md` recorded both art
trees as UNRESOLVED and said in terms that the first PRD to load any of this art
was blocked until the operator completed the rows.

Resolved 2026-07-28: the operator attests both trees were created for this
project. `art/sources.md` and `THIRD_PARTY.md` are updated, and the latter now
records that there is no third-party art in the repository at all. Nothing here
could start until that was written down.

### What the art is

Established empirically, because the two trees do not follow the same convention
and neither carried a readme. The authoritative record is the header comment of
`src/game/spriteDirections.ts`, next to the code that depends on it, so the next
PRD does not have to work it out again.

- Walk sheets are 96x256: 4 columns by 8 rows of 24x32 frames.
- Rows are one direction each, running **clockwise from front**: front,
  down-left, left, up-left, back, up-right, right, down-right.
- Columns are a four-frame walk cycle. Columns 0 and 2 are the same neutral
  pose; 1 and 3 are the opposite steps. Column 0 doubles as the idle frame.
- Dialogue portraits are 24x24 busts numbered **counter-clockwise**
  (`1-S, 2-SE, 3-E, …`), the reverse of the sheet row order. Deriving one from
  the other would have rendered characters walking backwards.
- Three skin tones per character, identical geometry, palette only.

The row order was confirmed by matching each character's own labelled
per-direction crop against the sheet frames pixel by pixel.

### The stand-in cast

ADR-0002 calls for six designed guide personas with names and voices. None are
designed. So `content/characters.json` assigns a stand-in archetype and a skin
tone to each of the six biblical sections, names the player's character, and is
marked provisional. Changing any row is a one-line content edit, because this is
the one judgement call in this PRD that is really a product decision.

## Acceptance criteria

Written as observable behaviour, since this PRD is not test-first. Each is
verifiable by hand in a browser and, where marked, by an e2e test.

### Boot and world

- [ ] `pnpm dev` serves an app that boots to scene 1 with no console errors.
- [ ] Phaser renders a programmatically-drawn scene-1 ground plane with a
      player-controlled character and two distinct cross-reference guides
      placed in it.
- [ ] The player moves under keyboard input (arrows or WASD) and cannot leave
      the world bounds.
- [ ] The React overlay renders above the canvas and does not intercept pointer
      events except on its own controls.

### Sprites and animation

- [ ] The player is `daniel_judean`, animated, not a coloured rectangle.
- [ ] Walking in any of the eight directions plays that direction's walk cycle;
      releasing the keys settles on that direction's idle frame, keeping the
      facing rather than snapping back to front.
- [ ] Direction-to-row mapping is a pure function, unit tested against all eight
      directions plus the stationary case.
- [ ] The two scene-1 guides are animated character sprites.
- [ ] Guides turn to face the player when the player is near them.
- [ ] Each guide keeps a section-coloured marker at their feet, so the biblical
      section stays readable at a glance, and that marker carries the encounter
      state.

### Art direction as content

- [ ] A content file maps each of ADR-0002's six biblical sections to a
      character and a skin tone, and names the player's character.
- [ ] It is validated by zod on load, like the other content files.
- [ ] Loading fails with a visible, defined error if a section present in the
      curated cross-references has no character mapped to it. A missing guide
      must not be discovered as a broken sprite at runtime.
- [ ] A test asserts every sprite and portrait key names a file that actually
      exists, so a typo fails in unit tests rather than as a 404 in e2e.
- [ ] The mapping is marked provisional in the file.

### Content loading

- [ ] A zod schema validates the scene-1 content file on load. A malformed or
      schema-violating file produces a defined, visible error state, not a white
      screen. Unit-tested, since this part is pure.
- [ ] The loader builds a real `GameManifest` from content and passes it to
      `createGameStore`. The fixture manifest is not used by the running app.
- [ ] The manifest contains all nine scenes and their region ids, so progression
      and fog behave correctly, even though only scene 1 is playable. Scenes 2
      to 9 carry no dialogue and are marked unplayable in content.

### Dialogue

- [ ] Scene 1's narrative beats advance one at a time in a DOM dialogue box,
      under player input, and the sequence can be read start to finish.
- [ ] Reaching the last beat completes the scene through
      `store.completeScene("scene-1")` and nothing else.
- [ ] Dialogue text is unmistakably marked as placeholder on screen.

### Fog of war

- [ ] A fog overlay renders regions beyond the current one as obscured, driven
      by `store.revealedRegionIds()` and nothing else.
- [ ] Completing scene 1 reveals scene 2's region visibly, in response to the
      `region:revealed` event, with no manual redraw call in the completion
      path.

### Cross-reference encounters

- [ ] Interacting with a guide opens an encounter panel showing the USFM
      reference, its section (OT History, Prophets), and the curated note.
- [ ] The panel shows the guide's dialogue portrait, rendered crisp rather than
      smoothed. A missing portrait degrades to the panel without one, not to a
      broken image icon.
- [ ] Opening the encounter calls `store.engageEncounter(...)` once and awards
      the base stone. Re-opening it awards nothing further and the panel shows
      it as already engaged.
- [ ] The panel offers a stubbed "recognise the connection" action backed by a
      `VerdictProvider` interface with a deterministic stub implementation. It
      calls `store.recogniseInsight(...)` and awards the bonus stone once.
- [ ] The stub is obviously a stub in the UI. It must not read as a working AI
      guide.
- [ ] Skipping both encounters entirely still allows scene 1 to complete.

### Vale Stones

- [ ] A HUD shows the current balance, updated from the `stones:awarded` event
      rather than by polling the store each frame.
- [ ] The HUD's number always equals `store.balance()`.

### Persistence

- [ ] State is saved through the real `src/core/save.ts` with an adapter that
      injects `window.localStorage`, satisfying the `Storage` interface. No
      `localStorage` reference appears in `src/core`.
- [ ] Reloading the browser restores completion, encounter states, and stone
      balance, and the world reflects the restored state on boot.
- [ ] A corrupt save in `localStorage` boots to a fresh game and surfaces a
      visible, dismissible recoverable-error notice rather than white-screening.

### Stub boundaries

- [ ] `ScriptureProvider`, `VerdictProvider`, and the YouVersion session are
      each a named interface with a stub implementation, wired through one
      composition point. Replacing a stub in PRD-07 through PRD-09 touches the
      composition point and the new implementation only.

### Gates and boundary

- [ ] `src/core/**` coverage still ≥ 90%, gated, and `src/core/` has a zero-line
      diff.
- [ ] `architecture.test.ts` still passes: no Phaser, no React, no browser API
      in `src/core`.
- [ ] The e2e suite grows a walkthrough: boot, read dialogue to the end, engage
      one encounter, see the balance rise, complete the scene, reload, and see
      the state persist.
- [ ] No asset 404s. The e2e zero-console-errors check covers this, so a wrong
      asset path fails the gate rather than shipping quietly.
- [ ] All five gates in AGENTS.md §4 pass.

## Decisions this PRD forces

Recorded for the operator per AGENTS.md §7. Each is implemented as proposed so
the slice can run; each is reversible afterward.

1. **Dialogue authoring format.** ADR-0002 deferred this and named it a blocker.
   Proposed: **JSON validated by zod at load**, not typed TS modules and not
   Ink. Reasons: `content/daniel-1.refs.json` already sets the precedent, zod is
   already a dependency and already used by the save format, the narrative is
   sequential so Ink's branching is unused, and `inkjs` would own story state
   that ADR-0002 assigns to `src/core`. The cost is that content errors surface
   at runtime rather than at compile time, which the schema plus a test
   mitigates.
2. **Map authoring pipeline.** Not forced. The slice draws its ground
   programmatically precisely so Tiled vs LDtk stays open for the world PRD.
   Loading character sprites does not touch this: characters are not a map.
3. **Placeholder content policy.** Proposed: filler is allowed for narrative
   dialogue when marked in both the file and the UI, and is never allowed for
   scripture text or scripture paraphrase.
4. **Art provenance.** Not an engineering call and not made here. The operator's
   attestation that the art was created for this project is what unblocked
   loading it, and it is recorded in `art/sources.md` and `THIRD_PARTY.md`
   rather than in this PRD.
5. **Section-to-character mapping.** Proposed: stand-in archetypes assigned to
   each of ADR-0002's six biblical sections, in `content/characters.json`,
   marked provisional. This is a product decision standing in for the six
   designed guide personas that ADR-0002 calls for and that do not exist yet.
   It is in content, not code, so the operator can overrule it cheaply.

## Out of scope

- Scenes 2 through 9 as playable content. They exist in the manifest so
  progression and fog are real; they have no dialogue.
- Tiles, scenery, and audio. Characters are real art; the world they stand on is
  not.
- A tilemap of any kind, per the design constraint above.
- The other 14 characters and 11 archetypes in `art/`. Only the seven sheets the
  cast names ship in `public/assets/`.
- Animation beyond walk and idle. No talk, sit, carry, or gesture states.
- Guides for scenes 2 through 9. Those scenes have no dialogue to stand in.
- The six guide personas as designed characters, with names and voices. This
  PRD assigns stand-in art to a section; it does not invent a persona.
- Real AI guide calls, prompts, personas, and verdict scoring. PRD-08.
- Real scripture text, YouVersion or bundled WEB. PRD-07.
- YouVersion sign-in and highlight sync. PRD-09.
- The full twenty-four typed cross-references as game content. Scene 1's two are
  used; the rest stay data.
- Highlights UI. The core model exists; nothing in the slice surfaces it.
- CI. Still unbuilt, still worth doing, still not this PRD.

## Notes

The failure mode to watch for is the spike quietly becoming the architecture.
The mitigations are the read-only core, the stub interfaces, the untouched map
decision, and this file saying "provisional" at the top.

The second failure mode is placeholder text escaping into a demo and being read
as authored content. That is why the marking requirement is in the acceptance
criteria twice, and why scripture is excluded from filler entirely.

The third arrives with the art: characters standing on a plain rectangle field
look unfinished, and the temptation will be to start drawing scenery to
compensate. That is the world PRD's job and it needs the map pipeline decided
first.

Where the content comes from:

- Scene list, settings, and progression: `docs/notes/scenes and cross refrences.md`.
- Scene 1's two cross-references, their sections, and their plain-language
  notes: `content/daniel-1.refs.json`.
- Overlay architecture, state ownership, and the deferred decisions:
  ADR-0002.
- Art provenance and licence position: `art/sources.md` and `THIRD_PARTY.md`.
- Sprite sheet geometry and row order: the header comment of
  `src/game/spriteDirections.ts`.
