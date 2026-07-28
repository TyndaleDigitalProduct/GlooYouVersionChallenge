# PRD-04: Playable vertical slice (scene 1)

## Goal

Get one scene of Verse & Vale running end to end in a browser, so that every
remaining design decision is made against something real instead of in the
abstract.

Scope is deliberately one scene deep and the full stack wide: Phaser renders a
world, React renders the readable UI over it, both driven by the `src/core`
store built in PRD-03, with save and reload working through the real save
format. Content, art, AI, and scripture text are stubbed. Everything that is
stubbed sits behind a named interface so the PRD that replaces it does not have
to unpick this one.

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

## Prerequisites

- PRD-03 merged. `src/core` is complete, covered, and boundary-tested.

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
  slice therefore draws its world programmatically (rectangles, no tilemap), so
  that shipping it commits to neither.
- **No scripture text and no invented scripture.** See "Content and text" below.
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

## Acceptance criteria

Written as observable behaviour, since this PRD is not test-first. Each is
verifiable by hand in a browser and, where marked, by an e2e test.

### Boot and world

- [ ] `pnpm dev` serves an app that boots to scene 1 with no console errors.
- [ ] Phaser renders a programmatically-drawn scene-1 world: a ground plane, a
      player-controlled marker, and two distinct cross-reference character
      markers placed in it.
- [ ] The player marker moves under keyboard input (arrows or WASD) and cannot
      leave the world bounds.
- [ ] The React overlay renders above the canvas and does not intercept pointer
      events except on its own controls.

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

- [ ] Interacting with a character marker opens an encounter panel showing the
      USFM reference, its section (OT History, Prophets), and the curated note.
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
2. **Map authoring pipeline.** Not forced. The slice draws programmatically
   precisely so Tiled vs LDtk stays open for the world PRD.
3. **Placeholder content policy.** Proposed: filler is allowed for narrative
   dialogue when marked in both the file and the UI, and is never allowed for
   scripture text or scripture paraphrase.

## Out of scope

- Scenes 2 through 9 as playable content. They exist in the manifest so
  progression and fog are real; they have no dialogue.
- Real art, tiles, sprites, and audio. `public/assets/` stays empty.
- A tilemap of any kind, per the design constraint above.
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

Where the content comes from:

- Scene list, settings, and progression: `docs/notes/scenes and cross refrences.md`.
- Scene 1's two cross-references, their sections, and their plain-language
  notes: `content/daniel-1.refs.json`.
- Overlay architecture, state ownership, and the deferred decisions:
  ADR-0002.
