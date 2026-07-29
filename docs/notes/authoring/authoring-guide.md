# Scene authoring files

Human-readable source of record for the authored game content: one file per
scene (`scene-NN.md`) plus `guide-personas.md`. Keith authors here in markdown;
the machine-readable JSON under `content/` is derived from these files by an
agent, validated against the schemas in `src/content/schema.ts`, and reviewed
in a PR like any other change.

Pre-filled facts (verses, settings, encounter lists, curated notes) come from
`content/daniel-1.refs.json`, which is already-final curated content — do not
edit those here; edit refs.json and regenerate if one is wrong.

## What goes where at conversion time

| Section in a scene file | Lands in |
| ----------------------- | -------- |
| Dialogue / Lamplighter copy | `content/daniel-1.dialogue.json` (format evolves with PRD-06 workstreams A & C) |
| Story character and NPC lines | new content, needs PRD-06 workstream A |
| Encounter cards | `content/daniel-1.cards.json` |
| Personas | new content file, shape decided during PRD-05/06 |

Two known code-side gaps, flagged in PRD-06: the dialogue schema currently only
accepts `status: "placeholder"`, and there is no interaction machinery for
story characters or NPCs yet. Author the full design shape anyway; the schema
catches up during PRD-06.

## Copy register (applies to ALL game copy and Gloo AI Studio prompts)

Language should reflect the basic register of the **NLT**: plain, warm,
contemporary English. Not formal or archaic "biblical" language — no thee/thou,
no King-James cadence, no elevated liturgical phrasing. A guide should sound
like a person explaining something they love to a friend, not like a lectern.
This rule also belongs verbatim in any Gloo AI Studio prompt that generates
cards or copy, so generated output matches the authored voice.

**Em-dashes follow the Chicago Manual of Style.** Em-dashes are allowed, but
always closed (no spaces on either side—like this), never open ( — like
this). Use them sparingly: where a parenthetical is more natural, use actual
parentheses, and don't let em-dashes stand in for commas, colons, or periods.
This applies to all game copy (dialogue, cards, summaries) and belongs in the
Gloo prompts alongside the register rule.

## Card rules (enforced by the runtime validator, from `daniel-1.cards.json`)

- Exactly **6 cards** per encounter, values **0–5**, no duplicate text.
- Incorrect cards are worth **0**; correct cards range **3–5, weighted by the
  importance of the connection** (ADR-0003). The validator requires at least
  1 zero-value card and at least 3 nonzero. Within that, the mix is the
  author's call per encounter — a rich note may carry four or five correct
  cards, a one-line proverb may carry three. **There is no fixed
  5-4-3-0-0-0 template**; repeated values (two 4s, two 3s) are fine.
- **Every scoring card must be a connection.** The point of the game is what
  the cross-reference passage *illuminates about the anchor scene in Daniel*.
  A card stating a fact about the cross-reference passage alone — however true
  — is not doing the job. Test each 3–5 card by asking: does this say
  something about the Daniel scene that you only see because of the
  cross-reference?
- A **0-value card must contradict the passage or import a claim absent from
  it**. A statement that is true of the passage but merely absent from the
  curated note is never a valid distractor — it would punish a player for
  reading well.
- Cards are grounded in the **curated note** (quoted in each encounter block).
  These fallback sets are what a failed Gloo generation degrades to, and what
  the card UI is built against.

## Where the Scripture cards display (encounter flow, per ADR-0003)

Each scene file marks these points explicitly, but the flow is fixed:

1. **Scene open** — the Lamplighter presents the scene's full passage
   (marked **[SCRIPTURE CARD: …]** in each scene's opening).
2. **Per encounter** — guide intro (from `guide-personas.md`), then
   **both Scripture cards open: the anchor and the cross-reference**. The six
   insight cards stay locked until both have been read (the read gate).
   Each guide's intro and closing line are deliberately reused across all
   their encounters — a signature line, by design. Do not add per-encounter
   variants.
3. Player locks up to three cards → all six values revealed with the curated
   note → stones awarded → guide closing line → summary card.

## Character tiers (from `storyboard-v2.md` §4)

- **Lamplighter** — opens the scene with the full passage, closes it. Exit copy
  branches three ways (all / some / no encounters engaged); none punitive.
  Exit copy must not assume the outcome of a later scene.
  **The Lamplighter is a narrator-guide, not a teacher.** He talks like a
  regular person helping people unveil the story of Scripture for
  themselves. No classroom or librarian phrasing ("read the passage," "the
  last verses of the chapter"); the hand-off is natural: "see for
  yourself." Openings may recall what happened in previous scenes, but
  never reveal or preview what happens in the scene being introduced; the
  Scripture card comes early and the passage speaks first. Beats after the
  read may echo fact, not meaning; interpretation belongs to the
  encounters. Exits reinforce only what the player has already uncovered,
  and the no-encounters exit stays neutral rather than delivering the
  conclusion anyway.
- **Cross-reference guides** — run the card encounters; copy comes from
  `guide-personas.md` plus the per-encounter cards.
- **Story characters** — 1–3 scene-appropriate lines, no interaction. Story
  characters are the ones that get sprites: **Daniel, Hananiah, Mishael, and
  Azariah are persistent story characters in every scene**, joined by others
  where the text puts them there (Nebuchadnezzar, Ashpenaz, …).
- **NPCs** — one bland line, no interaction, no dedicated sprite. Anyone
  invented for flavor is an NPC, not a story character.
