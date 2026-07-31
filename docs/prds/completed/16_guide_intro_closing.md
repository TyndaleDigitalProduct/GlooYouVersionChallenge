# PRD-16: guide intro and closing dialogue

## Goal

ADR-0003's encounter flow opens with a persona intro and ends with a persona
closing line ("persona intro, both Scripture cards read, six insight cards
presented, … persona closing line, character goes inactive with a summary
card"). The copy for all six guides was authored and reviewed
(`docs/notes/authoring/guide-personas.md`, final 2026-07-29) and ships in
`content/personas.json` — but nothing renders it. Engaging a guide drops the
player straight into the encounter panel with no greeting, and resolving it
ends with no farewell.

## Design (operator decisions, 2026-07-31)

- **The stage.** The intro and closing are dialogue boxes in the
  Lamplighter's stage pattern: the guide's own sprite (all sheets share the
  Lamplighter's 96×256 geometry) looms behind the box with head and
  shoulders above its top edge, and the persona name is prominent in the
  header.
- **The frame is gold, not wood.** The boxes bracket the encounter, so they
  wear the encounter panel's gold frame; the Lamplighter keeps wood
  exclusively. The stage supplies the Lamplighter feel, the frame keeps the
  visual connection to the Scripture cards and insight cards between them.
- **Intro plays on every open until the encounter is resolved.** Once
  resolved, revisits go straight to the persisted summary: the guide has
  gone inactive. No seen-flag is persisted; this derives entirely from the
  encounter record already in the save.
- **Closing plays once, right after the reveal.** Closing the panel after
  locking in the same open hands off to the closing line; dismissing that
  returns to the world. A revisit never replays it.
- **Button copy:** "Open the scrolls" advances from the intro into the
  encounter; "Go well" dismisses the closing. Shared by all six guides.

## Boundaries

- `src/core` untouched: no save change, no rule change. The stage is
  component state, same judgment as the read gate and the card shuffle.
- `content/personas.json` untouched: the copy is final and already there.
- The personas document is validated at boot against the content, following
  `buildCast`: a curated section with no persona, or a guide persona with no
  intro or closing, fails the boot rather than rendering an empty box.

## Additions from playtesting (operator, 2026-07-31)

- **The encounter panel's bust now shows the guide's own sprite.** No
  dedicated bust art exists for the personas, so the panel had deliberately
  pointed at old `ex_*` stand-ins (characters.json's note) — a different
  character than the sprite now greeting the player, which read as a bug the
  moment the intro made the real art visible. The bust is a crop of the same
  walk sheet the stage uses. The `portrait` fields in characters.json are
  left untouched for the day dedicated bust art exists.
- **The Lamplighter's scene passage card carries the "Highlight verse"
  button**, same behavior as the encounter passages (PRD-10): a deliberate
  action, local always, session only controls sync, and it never gates the
  Continue button. Accepted as slightly out of scope by the operator.

## Acceptance criteria

- [ ] `personas.json` loads into the runtime, validated against the refs:
      every cross-referenced section resolves to a persona with non-empty
      intro and closing.
- [ ] Engaging an unresolved encounter shows the intro stage: gold frame,
      guide sprite above the box, persona name, authored intro line,
      "Open the scrolls" advancing into the existing encounter panel.
- [ ] Re-engaging before resolving shows the intro again; opening a resolved
      encounter goes straight to the summary with no intro.
- [ ] Closing the panel after locking in the same open shows the closing
      stage with the authored closing line and "Go well"; dismissing it
      returns to the world. Closing without locking skips it.
- [ ] The e2e suite drives the full flow: intro, passages, cards, lock,
      reveal, closing.
- [ ] All five quality gates pass.
