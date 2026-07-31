# PRD-14: The Lamplighter's scene passage card

## Goal

Every scene's authored opening (docs/notes/authoring/scene-NN.md) places a
mandatory Scripture card inside the Lamplighter's opening beats, marked
**[SCRIPTURE CARD: …]**: the scene's full passage, read before free movement
begins (authoring-guide.md, "Where the Scripture cards display", step 1;
storyboard-v2.md §4 step 1). The dialogue document and the runtime have no
representation of it, so the card is silently skipped: the Lamplighter says
"see for yourself" and then never shows the player anything to see. This is a
change request against shipped behavior, not a new feature: the authored
content already specifies the card, and the code does not deliver it.

## The change

**Authoring format.** A `lamplighterOpening` beat in
`content/daniel-1.dialogue.json` may now be either `{ "text": … }` (a spoken
line, unchanged) or `{ "scriptureCard": true }` (the scene passage card opens
here). The card's reference is deliberately not authored in the dialogue
document: it is the scene's own `verses` from `content/daniel-1.refs.json`,
joined by the loader, so the two files cannot drift.

**Loader.** `SceneContent.lamplighterOpening` becomes a list of typed steps:
a spoken line or the passage card (carrying the scene's `verses` reference).
Following the `transitionCaption` precedent, the schema does not force the
card's presence (synthetic test scenes must not have to invent one); the
suite requires it of the real content files: every playable scene's opening
carries exactly one.

**DialogueBox.** The card step renders inside the forced opening sequence
with the same deliberate-read discipline as the encounter passages
(PRD-08 phase 3): the passage is collapsed behind an explicit "Read" action,
and Continue unlocks only once it has been opened. Text comes from the
runtime `ScriptureProvider` (bundled WEB today, YouVersion when PRD-10
lands) and degrades to the provider's `unavailable` reason, never a blank.

**Content.** The card marker is inserted into all nine scenes of
`daniel-1.dialogue.json` at the position each scene-NN.md authored it
(after the second opening beat everywhere except scene 3, where it follows
the third).

## Acceptance criteria

- [ ] The dialogue schema accepts `{ "scriptureCard": true }` as a
      Lamplighter opening beat and rejects a beat that is neither a line nor
      a card.
- [ ] The loader joins the card step to the scene's `verses` reference, and
      the suite fails if any playable scene in the real content files does
      not carry exactly one card step in its opening.
- [ ] DialogueBox presents the card at its authored position: passage
      collapsed behind a "Read" action, Continue gated until it is opened,
      beat counter including the step.
- [ ] The passage text comes from the runtime ScriptureProvider and shows
      the provider's unavailable reason on failure.
- [ ] All nine scenes in `content/daniel-1.dialogue.json` carry the card at
      the position their scene-NN.md authored.
- [ ] The e2e walkthrough reads the scene passage as part of the opening.
- [ ] All five quality gates pass.

## Out of scope

- The "Highlight verse" button on Scripture cards (PRD-10, on its branch).
- Encounter passage cards (PRD-08, unchanged).
- Any change to save format or src/core.
