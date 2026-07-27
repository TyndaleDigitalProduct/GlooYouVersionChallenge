# PRD-03: Core domain, progression rules, and save format

## Goal

Build `src/core/`: the engine-agnostic heart of the game. Every rule about what
is unlocked, what has been revealed, what a player has earned, and what persists
across sessions lives here, in pure TypeScript, with no import of Phaser, React,
or any browser API beyond a `Storage` interface that tests substitute.

This is the first PRD where test-first is natural rather than strained, and it is
deliberately the first real work: it needs no art, no credentials, no engine, and
no unresolved decisions.

## Prerequisites

- PRD-02 complete: gates active, `src/core/` boundary test in place.

## Design constraint

`src/core/` must not hard-code the nine scenes or twenty-four cross-references.
The rules are parameterised by a scene manifest supplied at construction; PRD-04
supplies the real typed content, and this PRD's tests supply fixtures.

The practical test: every spec here must pass with a three-scene fixture manifest
and no reference to Daniel.

## Acceptance criteria

Every item is written as a failing test before implementation.

### Progression rules

- [ ] Scene 1 is unlocked on a fresh save.
- [ ] Scene N (N > 1) is unlocked if and only if scene N-1 is complete. The main
      narrative is sequential and nothing in it may be skipped.
- [ ] Completing a scene out of order is rejected, not silently accepted.
- [ ] Completing an already-complete scene is idempotent and does not re-award.
- [ ] `isUnlocked`, `isComplete`, and `currentScene` are pure derivations of the
      completion set, never independently stored fields that could disagree.
- [ ] The final scene completing marks the experience complete without requiring
      any cross-reference encounter, since all side content is optional.

### Fog of war

- [ ] Revealed regions are **derived** from the completion set, not stored.
      A test asserts that hand-mutating completion changes the revealed set with
      no separate update call.
- [ ] The region for the current unlocked scene is revealed; regions beyond it are
      not.
- [ ] Reveal is monotonic: no sequence of legal operations ever un-reveals a
      region.

### Cross-reference encounters

- [ ] An encounter is keyed by (scene id, reference) and has exactly three
      states: unvisited, engaged, insight-recognised.
- [ ] Transitions only move forward. Re-engaging an encounter does not reset it.
- [ ] Encounters attach only to their own scene; attaching a reference to the
      wrong scene is rejected.
- [ ] Encounter state never affects `isUnlocked` for any scene. A test asserts
      that completing every scene with zero encounters yields a complete game.

### Vale Stone ledger

- [ ] Engaging an encounter awards the base stone exactly once per encounter.
- [ ] A recognised insight awards the bonus stone exactly once per encounter,
      and is additive to the base rather than replacing it.
- [ ] Re-engaging or re-scoring an encounter is idempotent: the balance does not
      move.
- [ ] The balance is never negative and no operation deducts. There is no
      spend-below-zero path; spending more than the balance is rejected.
- [ ] The balance is the sum of the ledger, and a test asserts it cannot be set
      directly. The ledger is the record; the balance is a derivation.
- [ ] Each ledger entry records what earned it, so the UI can show a history.

### Highlights

- [ ] A highlight is a USFM reference plus a colour, and can be added and removed.
- [ ] Adding the same reference and colour twice is a no-op, not a duplicate.
- [ ] The same reference may carry different colours only if the product rule
      allows it. Pick one behaviour, encode it in a test, and note the choice in
      the PR. Do not leave it emergent.
- [ ] Highlights survive a save round trip.
- [ ] Highlights are storable with no YouVersion session present, since sign-in is
      never required to play.

### Save format

- [ ] The save has an explicit integer `version` field from the first commit.
- [ ] Round trip: serialise then deserialise yields a deep-equal state.
- [ ] A zod schema validates on load. Malformed JSON, a missing `version`, a
      wrong-typed field, and an unknown future `version` each produce a defined
      outcome rather than a throw that reaches the UI.
- [ ] A corrupt or unreadable save falls back to a fresh state and surfaces a
      recoverable error. It never white-screens and never silently discards a
      valid save.
- [ ] At least one migration path exists and is tested, even if it is version 1 to
      version 2 with a trivial transform, so the mechanism is proven before it is
      needed under pressure.
- [ ] Persistence goes through a `Storage`-shaped interface that tests replace with
      an in-memory double. `src/core/` never touches `window.localStorage`
      directly.
- [ ] A save write failure (quota exceeded, storage disabled) is caught and
      reported as a retryable outcome, per the product PRD's retry requirement.

### Store and event bus

- [ ] The store is `zustand/vanilla`, readable and subscribable without React.
- [ ] Subscribers fire on change and do not fire when a no-op operation leaves
      state unchanged.
- [ ] Domain events are emitted on the PRD-02 event bus for the transitions the
      UI and the engine will need: scene completed, region revealed, stones
      awarded, encounter state changed.
- [ ] Events carry data, not rendering instructions. No event references a sprite,
      a DOM node, or a pixel coordinate.

### Coverage and boundary

- [ ] `src/core/**` coverage ≥ 90%, gated.
- [ ] The PRD-02 import-graph test still passes: no Phaser, no React, no direct
      browser API in `src/core/`.
- [ ] Every spec in this PRD runs in Vitest's node environment. None requires
      jsdom, a canvas, or a browser.

## Out of scope

- The real Daniel 1 scene manifest and the twenty-four typed cross-references.
  Fixtures only here; PRD-04 supplies real content.
- Dialogue text, dialogue sequencing, and the authoring format for it. Still
  deferred by ADR-0002.
- Any rendering: no Phaser scene reads this store yet, no React component
  subscribes to it yet. Wiring is PRD-05 and PRD-06.
- Scripture text fetching and the bundled WEB fallback. PRD-07.
- AI guide calls, prompts, personas, and verdict scoring. The encounter state
  machine is built here; what *decides* insight is PRD-08.
- YouVersion sign-in and highlight sync. The local highlight model is built here;
  syncing it is PRD-09.

## Notes

Read ADR-0002's "State" section first. The whole point of this PRD is that these
rules are testable in Node, and the temptation to reach for a Phaser or React
convenience will show up somewhere. The import-graph test is the backstop.

Where the rules come from, so they are not invented here:

- Sequential and unskippable main narrative, and fully optional side content:
  `docs/notes/scenes and cross refrences.md`.
- Side content never blocking progression, and stones for meaningful connections:
  the Functional Requirements in
  `docs/notes/Verse & Vale - Daniel 1 Experience PRD.md`.
- Two-tier award structure and the never-deduct rule: ADR-0002, "Rewards".
- Save-and-retry on failure: the product PRD's "Advanced Features & Edge Cases".

Two things to surface rather than decide:

1. **Where YouVersion tokens live.** This PRD models a session as present or
   absent and stores `yvp_id` only. It deliberately does **not** decide whether a
   refresh token belongs in `localStorage`, `sessionStorage`, or memory only.
   That is a security decision for PRD-09 and it may warrant its own ADR. Do not
   quietly put a refresh token in the save blob.
2. **Same-reference multiple-colour highlights.** Flagged above. Pick a
   behaviour, test it, and report it; if it feels like a product decision rather
   than an implementation detail, stop and ask.

A note on the coverage gate: 90% on `src/core/**` is achievable honestly here
because this code is pure. If reaching it starts requiring tests that assert
nothing, that is a signal the module has grown something that belongs in an
adapter, not a signal to lower the gate.
