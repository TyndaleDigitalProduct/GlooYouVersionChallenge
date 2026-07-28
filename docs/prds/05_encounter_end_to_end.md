# PRD-05: The encounter, end to end

## Goal

Make one cross-reference encounter work for real, from the save format up to the
card UI, as [ADR-0003](../decisions/0003-card-selection-encounters.md) specifies
it: persona intro, both Scripture passages read, six insight cards presented, the
player locks up to three, all six values revealed with the curated note, summary
card on the way out.

PRD-04 proved the architecture with three stubbed seams. This PRD replaces two of
them with real implementations, deletes the third because ADR-0003 removed the
mechanic it stood for, and grows `src/core/` to hold the state the new encounter
needs.

## Prerequisites

- PR #3 merged. All five gates verified passing on that branch.
- ADR-0003 accepted, and immutable per ADR-0001.

## Build in four layers, in this order

Each layer is independently mergeable and leaves the app in a working state.
Stop after any of them and nothing is half-built.

1. **Core state**: ledger causes, encounter card records, save v3.
2. **Scripture text**: the bundled fallback, which unlocks the read gate.
3. **Card UI**, built against the reviewed fallback card sets already in
   `content/daniel-1.cards.json`.
4. **Gloo generation**, replacing the fallback set at runtime.

The ordering is deliberate. Layer 3 against the committed fallback sets means the
card UI is buildable and demoable with no Gloo call working at all, so the API is
an enhancement rather than a dependency. `content/daniel-1.cards.json` already
carries reviewed six-card sets for both scene 1 encounters, which is exactly what
the current demo shows.

## Design constraints

Inherited, not invented here. Each has a test.

1. **`src/core/` stays pure.** No Phaser, no React, no browser API beyond the
   `Storage` interface. `architecture.test.ts` is the backstop.
2. **`encounters.ts` and `progression.ts` must still not read each other.**
   ADR-0003 requires the all-references bonus be computed above both. This is the
   one new boundary here and it needs its own assertion, because the lazy way to
   write that bonus is exactly the import that breaks it.
3. **The ledger stays append-only and never negative.** Every card value is 0 or
   above, so no path deducts.
4. **The balance stays a derivation**, never a stored field.
5. **The Gloo API key is server-side only.** `AGENTS.md` §6 allows exactly one
   credential in the browser bundle and it is the YouVersion `app_key`.
6. **Stubs stay honest.** Every seam carries `isStub: true` so the UI can label
   itself. A guide that looks real but is not is a worse failure in this product
   than a visibly missing one. Anything still stubbed after this PRD keeps saying
   so.

## Layer 1: core state

- [ ] `LedgerCause` has four values: `engagement`, `insight`, `scene-complete`,
      `all-references`.
- [ ] `LedgerEntry.reference` becomes optional, and presence is validated against
      the cause rather than left emergent: `engagement` and `insight` require one,
      `scene-complete` and `all-references` must not carry one. All four
      violations are rejected with a defined error.
- [ ] `BASE_STONE_AWARD` and `BONUS_STONE_AWARD` are replaced by the four
      magnitudes in `storyboard-v2.md` §11: engagement 1, insight the sum of the
      selected cards' values, scene-complete 5, all-references 10.
- [ ] The insight amount is derived from the persisted cards and selections, not
      passed in by a caller. A test reconstructs it from a save blob alone.
- [ ] The insight amount is bounded 0 to 15 by construction (at most three
      selections, each card at most 5) and a test asserts the ceiling.
- [ ] An insight award of 0 still appends an entry, so the ledger is a complete
      history rather than a partial one. See Notes: this one is worth a second
      opinion.
- [ ] Deterministic entry ids stay collision-free with an absent reference:
      encounter-scoped stay `sceneId:reference:cause`, scene-scoped become
      `sceneId:cause`.
- [ ] Idempotence per cause: encounter-scoped awards at most once per
      (scene, reference), scene-scoped at most once per scene.
- [ ] `EncountersState` becomes `Record<string, EncounterRecord>`, holding the
      state, the generated card set once it exists, and the locked selections once
      they exist. Absent keys still mean unvisited.
- [ ] The terminal state is renamed from `insight-recognised` to `resolved`, since
      ADR-0003 deleted the mechanic the old name describes. The migration maps it.
      See Notes: veto-able.
- [ ] A card set is exactly six cards, each with a stable id, text, and an integer
      value 0 to 5, with at least one card at 0, at least three above 0, and no
      duplicate text. Each of those five constraints is rejected individually.
- [ ] Cards are written once per encounter per save. A second generation for an
      encounter that already has cards is rejected, not overwritten, which is what
      stops a reload from re-rolling an easier set.
- [ ] Selections are at most three, must name cards in that encounter's own set,
      and may not repeat.
- [ ] Selections lock once. Locking is what moves an encounter to `resolved`, and
      it is rejected for an encounter with no cards yet.
- [ ] The all-references bonus lives in a new module above `encounters.ts` and
      `progression.ts`, fires when every cross-reference the manifest assigns to a
      scene is `resolved`, once per scene, and does not fire when one is merely
      `engaged`.
- [ ] The scene-complete award fires only on the incomplete to complete
      transition and never re-awards.
- [ ] Encounter state still never affects `isUnlocked`. The PRD-03 test that
      completing every scene with zero encounters yields a complete game passes.
- [ ] `CURRENT_SAVE_VERSION` goes to 3, with a v3 schema and a `migrateV2ToV3`
      that converts bare encounter strings into records and maps the renamed
      state.
- [ ] The v3 schema carries an **optional player-name field that this PRD does not
      read or write**. It exists only so PRD-06 workstream B can fill it without a
      second migration; a required name is settled design (`storyboard-v2.md`
      "Settled") and it has to be persisted somewhere. Optional at the schema level
      because a v2 save being migrated has no name to supply, so `migrateV2ToV3`
      leaves it absent and a test asserts absent is legal. Cheaper than the v4
      migration the alternative forces on PRD-06.
- [ ] A v2 encounter resolved under the old model has no cards, so its summary
      card cannot show per-card values. The migration produces a record that
      renders as resolved with the curated note only, and a test asserts the
      absent card set is a legal state.
- [ ] The full v1 to v2 to v3 chain runs on a v1 blob, not just one hop.
- [ ] Round trip at v3 is deep-equal, including cards and selections.
- [ ] Every existing load outcome still holds: malformed JSON, missing version,
      non-integer version, future version, invalid schema, storage unavailable.
- [ ] Event payloads widen to match: `stones:awarded` takes the four causes and an
      optional reference, `encounter:stateChanged` uses the renamed states, and
      resolving an encounter emits the selections and amount awarded. Data only,
      no sprite or DOM node or pixel coordinate.
- [ ] All specs against the **real manifest** loaded from `content/`, not fixture
      manifests. All 9 scenes and 24 cross-references already load today, so
      fixtures are no longer the honest test. Keep the fixture-based specs that
      prove the rules are not Daniel-specific.

## Layer 2: Scripture text

- [ ] The bundled public-domain WEB text for the 9 scene anchors and 24
      cross-referenced passages is committed, and the real `ScriptureProvider`
      replaces `createStubScriptureProvider`.
- [ ] Its edition and source are recorded in `THIRD_PARTY.md` under "Scripture
      text", which already says that is required if the fallback is ever
      committed, and in `art/sources.md` terms this is a provenance row before
      use per `AGENTS.md` §6. **Do not commit verse text whose edition you cannot
      name.**
- [ ] A reference the bundle does not cover returns a defined `unavailable`
      outcome rather than throwing or rendering blank.
- [ ] USFM ranges resolve correctly, including multi-verse (`2KI.24.1-4`) and
      cross-chapter ranges if any exist in the curated set.
- [ ] The provider is async and the UI handles the pending state, so swapping in a
      YouVersion fetch later is not a signature change.
- [ ] The bundle's size is reported in the PR, since it ships in the client.

## Layer 3: card UI

- [ ] The read gate: the card grid stays locked until both Scripture passages have
      been opened, per `storyboard-v2.md` line 21.
- [ ] Six cards render with their text and no values visible before lock.
- [ ] Selection is capped at three, with the cap communicated before the player
      hits it rather than by a failed click.
- [ ] Locking reveals all six values as numbers, including unselected cards,
      alongside the curated note from `daniel-1.refs.json`.
- [ ] Selected versus unselected is distinguished by colour **and** a non-colour
      cue (checkmark or border weight), so it survives colour blindness.
- [ ] No possible-total and no "9 of 13" anywhere. Per-card values teach; a score
      against a maximum grades.
- [ ] Copy for a high-value unselected card frames it as what else was worth
      seeing, never as a miss.
- [ ] The summary card renders on revisit from the persisted cards and selections,
      with no regeneration.
- [ ] Built and tested against the fallback sets in `content/daniel-1.cards.json`,
      with no Gloo call in the path.
- [ ] An e2e test drives a full encounter: walk up, read both passages, pick
      three, lock, see the reveal, see the balance move.

## Layer 4: Gloo generation

- [ ] A Vercel serverless route generates a six-card set per encounter, with the
      Daniel passage, the cross-referenced passage, and the curated note carried
      as the authority.
- [ ] The API key is read server-side only and never reaches the bundle. A test or
      a build assertion proves it is absent from `dist/`.
- [ ] Output is schema-validated against the same six-card constraints from layer
      1, hard-failed on violation, retried exactly once, then degraded to the
      reviewed fallback set for that encounter.
- [ ] A degraded encounter is still fully playable and the UI does not pretend the
      cards came from the model.
- [ ] The generated set is persisted on first generation and never regenerated for
      that encounter in that save.
- [ ] `createStubVerdictProvider` and the whole `VerdictProvider` seam are
      **deleted**, not implemented. ADR-0003 rejected free-text verdicts outright,
      so that seam stands for a mechanic that no longer exists. Leaving it would
      be a stub for something deliberately removed.
- [ ] A card-generation seam replaces it, stubbable for tests, carrying `isStub`
      honestly.

## Out of scope

- **Click-to-move, home screen, name entry, intro, and the Lamplighter.** PRD-06.
  Name *entry* is PRD-06's; this PRD only reserves the optional v3 schema slot it
  lands in, so that PRD-06 does not need a v4 migration of its own.
- **YouVersion sign-in and highlight sync.** PRD-06. One seam to agree rather than
  assume: PRD-06 captures a highlight for every reference read, and the read gate in
  layer 3 here is what defines "read". Settle which side fires it before either
  starts.
- **CI.** PRD-07.
- **Dialogue for scenes 2 through 9.** Zero beats exist and scene 1's are
  placeholders. Authoring work, not engineering, and it gates "all nine scenes
  ship" rather than this PRD.
- **The six designed personas.** Only "the Chronicler" and "the Watchman" exist
  anywhere, both in `daniel-1.cards.json`, and `characters.json` still maps
  sections to provisional stand-in archetypes. Flagged below as an inconsistency.
- **The 22 remaining fallback card sets.** Runtime generation covers the live
  path; the fallback only matters for offline and outage play.
- **World art, tilemaps, and audio.** `maps/`, `tiles/`, and `audio/` are empty.
- **Scene revisit** and the **highlight colour scheme**. Both still open
  decisions in `storyboard-v2.md`, both untouched here.

## Notes

Where the rules come from:

- Encounter flow, the at-most-three cap, the 0 to 5 band, the reveal rules, and
  the six-card constraints: ADR-0003, "Decision".
- The orchestrator requirement for the all-references bonus: ADR-0003,
  "Consequences".
- Reward magnitudes: `storyboard-v2.md` §11.
- The read gate: `storyboard-v2.md` line 21.
- Append-only ledger and never-negative: ADR-0002 "Rewards", confirmed as
  surviving by ADR-0003.
- The Scripture text position, including that a committed fallback needs its
  edition recorded: `THIRD_PARTY.md`, "Scripture text".

Four things to surface rather than decide, per `AGENTS.md` §7:

1. **Whether a zero-amount insight entry belongs in the ledger.** Written as yes
   above, on the grounds that the ledger should record every resolved encounter
   and the balance is a derivation either way. One line and one test to reverse.
2. **The `insight-recognised` to `resolved` rename.** Worth doing while a
   migration is being written anyway, but it touches the save format, the event
   payloads, and the app-layer encounter controller. Keeping the old string is
   uglier and cheaper.
3. **Whether the read gate persists across a reload.** If it must survive, it is
   encounter state and belongs in the record; if re-reading is acceptable, it is
   view state and belongs in `viewStore`. Written as the latter, because nothing
   in ADR-0003 says the gate is persistent and that is the reversible choice.
4. **`characters.json` and `daniel-1.cards.json` disagree about the cast.** The
   cards file already uses two real persona names, the characters file still maps
   sections to generic archetypes, and four personas have no name anywhere. The
   card UI shows a persona name, so this PRD will hit the disagreement. Either
   name the six now or accept that layer 3 renders two real names and four
   stand-ins.

On reward magnitudes: open decision 2 in `storyboard-v2.md` asks for a sanity
check on the scale before it is baked into the ledger, and layer 1 is where it
gets baked in. Nothing spends stones yet so the scale is unanchored, and changing
a constant later is trivial while changing the causes is not. Worth thirty
seconds at approval.

On scope: this is four layers and the deadline is 2026-07-31. The layering is the
risk control. If time runs out mid-PRD, layers 1 through 3 give a working
encounter with reviewed cards and real Scripture text, which is a demo. Layer 4
is what makes it a Gloo integration, which is one of the two stated learning
goals of the project, so it should not be the first thing cut without saying so.
