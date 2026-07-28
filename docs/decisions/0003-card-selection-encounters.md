# 0003. Card-selection encounters, generated at runtime

Date: 2026-07-28

## Status

Accepted, 2026-07-28.

Accepted by the operator. The decisions below are binding.

Partly supersedes [ADR-0002](./0002-frontend-and-runtime-stack.md): the sections
"Rewards: two-tier, never punitive", "AI guides: grounded in our own notes", and
the streaming justification in "Hosting: Vercel, static SPA plus two serverless
routes". Everything else in ADR-0002 stands.

Two procedural notes, following the precedent ADR-0002 set for itself. This
document was drafted by an agent at the operator's explicit request, waiving the
agents-do-not-write-ADRs rule in ADR-0001 and `AGENTS.md` §7 for this one file;
that waiver does not extend to any other ADR. And per ADR-0001 this ADR is now
immutable. A decision that changes here gets a new ADR that supersedes it, with
a note added to both.

The design this record follows is
[`storyboard-v2.md`](../notes/storyboard-v2.md) and
[`scene-01-flow.md`](../notes/scene-01-flow.md), which are self-contained and do
not depend on this file.

## Context

ADR-0002 resolved the tension between the product PRD's "no Bible quizzes"
non-goal and its request for stones awarded for meaningful connections by making
insight something *recognised in conversation* rather than *marked as an answer*,
which explicitly ruled out multiple choice.

Three things have changed since.

**The deadline is 2026-07-31 23:59, and today is 2026-07-28.** A free-text
conversational interface needs input UI, streaming presentation, turn-cap
fencing, and an eval loop to know whether the model's verdicts are defensible.
That does not fit, and a half-calibrated verdict model is worse than no verdict
model.

**The goals are not competitive.** This project exists to produce a game that is
fun and to build hands-on familiarity with the YouVersion Platform API and Gloo
AI Studio. It is not optimising for judge scores, concurrent-user ceilings, or
repository popularity. Where ADR-0002 traded interest for safety on the
assumption that a broken demo was the worst outcome, that trade no longer holds.

**A capped selection is not a quiz in the sense the product PRD forbids.**
The non-goal exists to prevent trivia and skill gates. Asking a player to choose
the *three most important* connections out of six, where nothing is deducted and
nothing is gated, tests discernment rather than recall, and cannot block or
punish. The letter of "no multiple choice" is overturned here. The intent behind
it (never punitive, never gated, narrative first) is kept and restated below.

## Decision

### Encounters are card selection. There is no free-text input anywhere.

A cross-reference encounter runs: persona intro, both Scripture cards read, six
insight cards presented, player locks up to three, all six values revealed with
the curated note, persona closing line, character goes inactive with a summary
card.

No keyboard input, no streamed model response, no follow-up conversation. This
is a rejection, not a deferral: the conversational interface is out of the
design, not queued behind it.

### Rewards: weighted, capped, never punitive, never gated

Each of the six cards carries an integer value from 0 to 5. Incorrect cards are
worth 0. Correct cards range 3–5 by the weighted importance of the connection.
Nothing is ever negative and nothing is ever deducted, so the append-only ledger
invariant in `src/core/ledger.ts` stands unchanged.

**The player may select at most three cards.** Without a cap, and with no
penalty for a wrong pick, selecting all six would be strictly optimal and the
choice would be meaningless. The cap makes an incorrect pick cost an
opportunity rather than points, which restores the decision without introducing
punishment.

Correct cards stay in a narrow 3–5 band deliberately. Importance is a curatorial
judgment and players will disagree in good faith; a correct pick worth 1 against
another worth 5 reads as punishment by another name.

Card values are hidden until selections are locked.

### The reveal is the teaching beat

Once locked, all six values are shown, including the cards the player did not
pick, alongside the curated note from `content/daniel-1.refs.json`, which is
the authoritative explanation of the connection.

- Value is rendered as a **number**. Colour distinguishes selected from
  unselected cards only, and must be paired with a non-colour cue (checkmark or
  border weight) so the distinction survives colour blindness.
- No possible-total or "9 of 13" is displayed. Per-card values teach; a score
  against a maximum grades, and invites regret over a choice the cap made
  exclusive.
- Copy for a high-value unselected card frames it as *what else was worth
  seeing*, never as a miss. "Never punitive" constrains the UI here, not just
  the ledger.

### Cards are generated at runtime by Gloo, grounded in the curated note

Generation is a server-side call per encounter. The prompt carries the Daniel
passage, the cross-referenced passage, and the curated note **as the authority**.
Correct cards must be entailed by the note; the model is distributing a
human-written claim across several statements, not deciding what is true of
Scripture.

This accepts that the model owns the scoring key, which ADR-0002 declined to
allow. The mitigation is prompt calibration plus the two constraints below, and
the residual risk is accepted knowingly: exercising this pipeline is one of the
two learning goals of the project.

**Distractors must be clearly wrong.** They contradict the passage, or import a
claim absent from it. They must never be statements that are true of the
passage but merely absent from the note: those score 0 and would punish a player
for reading well, which is the failure mode most likely to survive casual
testing.

**Output is schema-validated and hard-failed**: exactly six cards, integer
values 0–5, at least one card at 0, at least three above 0, no duplicate text.
One retry on violation, then the development fallback set.

A single reviewed six-card set per encounter ships in `content/`. Its purpose is
development: building and iterating the card UI without spending a Gloo call on
every reload. It is also what a failed generation falls back to.

Cards are generated **once per encounter per save** and persisted. This prevents
re-rolling for an easier set after a reload, and is what makes the summary card
renderable on revisit.

### Retained from ADR-0002, unchanged

The no-RAG reasoning (24 notes, ~6.6 KB, retrieval is a dictionary lookup) and
the six personas mapping onto the `section` field both survive. So does the
two-route server tier: Gloo's API key still means a secret still means a server.
Only the streaming justification for that route falls away, since generation is
a single non-streamed structured call.

## Consequences

- `LedgerCause` needs values for scene completion and the all-references bonus,
  and `LedgerEntry.reference` must become optional, since a scene-scoped award
  has no reference. Today's `BASE_STONE_AWARD = 1` / `BONUS_STONE_AWARD = 2`
  no longer describe the scale and need replacing.
- The all-references bonus requires reading encounter state and progression
  together. `src/core/encounters.ts` and `src/core/progression.ts` must still not
  read each other; the bonus is computed by an orchestrator above both.
- `EncountersState` currently stores a bare state string per encounter. It must
  now carry the generated cards and the player's selections, which is a change
  to the versioned save format and needs a migration.
- The product PRD's non-goal on trivia and skill gates was partly contradicted
  by this decision and has been reworded alongside it. "No skill gates" is kept:
  encounters still never block progress.
- The product PRD's Success Metrics (judge ratings, uptime at judging, 1,000+
  concurrent users, repo stars) no longer described what this project optimises
  for and have been replaced alongside this decision.
- A Gloo outage degrades encounters to the fallback set rather than breaking
  them, and the bundled WEB text keeps Scripture available regardless.

## Deferred

- Per-card rationale: why one connection outranks another. The reveal currently
  shows values and the encounter's single note; per-card explanation is the
  natural next layer.
- A deeper-investigation branch off the reveal, for players who want to pursue
  why a connection carries the weight it does.

## Rejected

- Free-text conversational encounters with model-generated verdicts, in any
  form. Removed from the design rather than deferred.
- Build-time generation of a card pool sampled at runtime. It would have bought
  reviewability and offline determinism at the cost of moving the Gloo pipeline
  out of the shipped product, which is the opposite of a learning goal.
