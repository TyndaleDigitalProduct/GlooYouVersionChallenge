# Storyboard v2 — home screen through Scene 1

Supersedes the original storyboard. Same structure, reworked against the
decisions taken 2026-07-28. Every decision is stated here — the change table
below is the record of what moved and why. Scene 1 beats are **not** restated
here; they live in [`scene-01-flow.md`](./scene-01-flow.md), which is
authoritative for anything inside a scene.

Deadline: **2026-07-31 23:59.**

## What changed from v1

| # | v1 | v2 | Why |
| --- | --- | --- | --- |
| 1 | "Scholar", "Prophet" | Six named personas mapped 1:1 onto the `section` field: **Chronicler, Watchman, Songkeeper, Elder, Witness, Courier** | The mapping already existed in the curated data and ADR-0002; "Scholar" reads academic, which the product PRD rules out |
| 2 | Card values **+5 to −5** | **0 to 5**; incorrect cards are 0 | Never punitive. The append-only ledger has no deduction path at all |
| 3 | "Select all options you believe are correct" | **Select at most three** | With no penalty, selecting all six was strictly optimal — the cap is what makes it a decision |
| 4 | — | **Reveal beat**: after lock, all six values shown, selected vs unselected distinguished | Turns scoring into teaching; this is where the curated note pays off |
| 5 | "Generate 6 cards from Gloo AI Studio" | Runtime generation, **grounded in the curated note as authority**, schema-validated, dev fallback set in `content/` | Note-grounding shrinks the model's job from deciding truth to redistributing a human-written claim |
| 6 | (ADR-0002 specified conversational encounters) | **No free-text input anywhere.** Rejected, not deferred | Doesn't fit the deadline; a half-calibrated verdict model is worse than none |
| 7 | "Read them both and then pick" | **Read gate** — card UI unlocks only after both Scripture cards are opened | Nothing enforced it. (PRD-10 revises this row's own rationale: the read gate still unlocks the cards, but no longer implies a highlight — see item 10 and §4 step 7) |
| 8 | Lamplighter leaves the screen | Must be **reachable** at scene exit; exit copy for engaged-all / some / none | As written, the only character who can end the scene was unfindable |
| 9 | — | **Personas carry a lantern** | Doubles as the interaction affordance, which touch devices need and hover can't provide |
| 10 | Highlights if user opted in | Recorded **locally always**; YouVersion opt-in controls *sync*, not capture | `highlights.ts` takes no session parameter by design |
| 11 | "Stones for completion plus bonus" | Four causes: engagement 1, insight 0–15, scene complete 5, all-refs 10 | v1's causes aren't representable in the current ledger — see gaps |
| 12 | — | Save persists **generated cards + selections** | Cards exist nowhere else; without this the summary card can't render on revisit |
| 13 | Single way in | Home screen has **two entry states** — Continue / New game when a save exists | PRD-03 shipped a versioned save format, so returning players are the normal case |
| 14 | "Ask the user for a name" | **Name is required**; the player cannot continue without entering one | Every `{name}` line works unconditionally — no fallback form of address to write |

Unchanged from v1: home screen, name entry, optional YouVersion sign-in,
skippable intro, the three character tiers, click-to-move, Lamplighter opening a
scene with the full passage, characters going inactive with a summary card,
scene-completion and all-references bonuses, highlights on every reference read.

## 1. Home screen

Game name, tagline, and the way in. **Two entry states, decided by whether a
readable save exists.**

### No save — first-time player

Title, tagline, single *Enter* → setup (§2).

### Save exists — returning player

Two actions:

- **Continue** — the primary action. Shows where they left off: scene number and
  title (e.g. *Scene 4 of 9 — Daniel 1:6–7*) and the Vale Stone balance, so the
  button carries state rather than just a label. Skips setup and the intro
  entirely and drops the player into their current scene. Name comes from the
  save; never re-asked.
- **New game** — secondary, and destructive. Requires a confirm.

### New game wipes game progress

Starting over discards all game state: the completion set, the ledger, encounter
state, and local highlights. The confirm says that and nothing more.

Highlights written to a player's YouVersion account are **an outcome of play, not
game state.** They are not the game's to reclaim, and their existence has no
bearing on whether a player can start again from the beginning. Nothing in the
confirm copy needs to mention them.

### Failure state

If a save exists but cannot be read or migrated, the home screen degrades to the
first-time state with a short explanation — never a silent wipe, and never a
dead-end error. A player who lost progress should at least be told.

### Connection state on Continue

The YouVersion token lives in the save. If it has expired, Continue still works —
the player enters the scene and highlights record locally, with an unobtrusive
prompt to reconnect. Losing a token must never block play.

Copy needed: title, tagline, both button labels, the Continue state line, the
New-game confirm, the unreadable-save message, the reconnect prompt.

## 2. Game setup

**Character name — required.** The player cannot continue without entering one.
Used throughout dialogue as `{name}`, unconditionally; no fallback form of
address is needed anywhere.

- *Continue* is disabled until the field is non-empty. Whitespace-only does not
  count.
- Length cap sized to the dialogue box, enforced at input rather than on submit.
- Validation message for the empty case.
- Decide whether any filtering applies beyond length.
- Fixed at creation, or changeable later from the menu? Not blocking, but it
  determines whether the name is written once or is mutable save state.

**YouVersion sign-in — optional, and this is the trust moment of the product.**
Copy has to answer three things plainly: what gets written to their account
(highlights on verses they read), what happens if they decline (the full game,
nothing withheld), and that they can play now and connect later. Sign-in is
OAuth 2.0 with PKCE through the one serverless route.

Declining must be a first-class path, not a dead end — `highlights.ts` records
locally with no session, so nothing about the game degrades.

## 3. Intro to Daniel — skippable

Introduces cast and mechanics. Now that mechanics are settled, this can be
written.

**Cast:** Self, the Lamplighter, cross-reference characters (lantern-carrying),
story characters, NPCs.

**Mechanics to teach:** click to move; click a character to talk; **a lit lantern
means that character has something for you**; Scripture cards; read both before
choosing; pick at most three; all six values are revealed afterward; stones.

**Must be reopenable mid-game.** v1 made it skippable with no way back — a player
who skips has no route to the rules. Put it behind the HUD menu.

## 4. Game flow — the loop for every scene

1. **Enter scene.** Lamplighter presents the full passage for the scene, then
   moves to a fixed off-screen position. **Both encounters' cards are prefetched
   here, in the background** — generation is a server round-trip and the
   alternative is a spinner on every character click.
2. **Free movement.** Click to move, click to talk. Interaction radius must be
   explicit, and a click inside it must not also move the player. Lantern
   provides the affordance on touch.
3. **NPCs** — one bland line, no interaction.
4. **Story characters** — 1–3 scene-appropriate lines, no interaction.
5. **Cross-reference characters** — intro → Scripture cards for anchor and
   cross-reference → read gate → six cards → lock up to three → reveal all six
   values with the curated note → stones → closing line → inactive, showing a
   summary card. Scripture cards stay re-openable; no re-scoring (forward-only
   transitions plus deterministic ledger ids make it structurally impossible).
6. **Scene exit.** Lamplighter asks whether the player is ready to move on.
   Leaving early is allowed — encounters never gate progress. Stones for
   completion, plus the bonus if every reference in the scene was engaged.
7. **Highlights.** Revised by PRD-10: a Scripture card's "Highlight verse"
   button, tapped deliberately, records a highlight in the game colour —
   never an automatic consequence of opening the card or clearing the read
   gate. Recorded locally always; synced to YouVersion if connected.

## 5. Scene 1 — Daniel 1:1, Jerusalem under siege

Full beats, cast, sprite assignments, dialogue, and the card-generation
contract: **[`scene-01-flow.md`](./scene-01-flow.md)**. The two fallback card
sets themselves live in `content/daniel-1.cards.json`.

In brief: the Lamplighter opens with `DAN.1.1`; the **Chronicler**
(`2KI.24.1-4`) and the **Watchman** (`JER.25.2-11`) are the two encounters, in
either order; both anchor to `DAN.1.1`; the Lamplighter closes.

## Open decisions

Ordered by how much they cost to resolve late.

1. **Scene revisit.** `progression.ts` cannot re-enter a completed scene, so a
   skipped encounter is lost permanently. Either add revisit (safe by
   construction — the ledger already blocks re-awarding) or make the exit copy
   explicit that leaving is final. Scene 1's draft dialogue assumes the latter.
2. **Reward magnitudes.** Nothing spends stones yet, so the scale is unanchored.
   Sanity-check the four causes before they're baked into the ledger.
3. **Highlight colour scheme.** One game colour, or two (anchor vs
   cross-reference)? `highlights.ts` stores one colour per reference, and
   `DAN.1.1` is the anchor for both Scene 1 encounters, so without a decision the
   anchor flips colour depending on interaction order.
4. **Self sprite** — `youth_a` or `youth_b`; the other becomes an NPC.
5. **Story characters reacting to engaged cross-references.** The cheap
   mitigation for 24 identically-shaped encounters, and content rather than
   engine work. Still unscoped.
6. **Is the character name mutable after creation?** Determines whether it is
   written once at setup or is editable save state.

### Settled

- **Name is required.** No skip, no fallback address in dialogue.
- **All nine scenes ship.** Scope is the full chapter, not a vertical slice.
- **Home screen has two entry states.** Specified in §1.

## Blocking work, not decisions

- ~~**For Ben:** several of these decisions reverse choices recorded in
  ADR-0002.~~ Settled 2026-07-28. They are recorded in
  [ADR-0003](../decisions/0003-card-selection-encounters.md), which partly
  supersedes ADR-0002 and is the authority for the reward scale, the encounter
  format, and the shape of the Gloo integration.
- **`LedgerCause` has no value for scene-complete or all-refs-bonus, and
  `LedgerEntry.reference` is required** — a scene-scoped award has no reference.
  Hard blocker on rewards, in already-tested code behind a 90% coverage gate.
- **`EncountersState` is a bare string per encounter** and must carry generated
  cards plus selections. Save-format migration.
- ~~**Product PRD** needs two edits: the non-goal wording, and the Success
  Metrics section.~~ Done 2026-07-28, alongside ADR-0003.
- **Environment art** — `public/assets/{maps,tiles}` empty; masters not staged
  into `public/assets/sprites/`.
- **Lamplighter and persona sprites** — ~8 sheets, or 5 plus recolours.
- **Bundled WEB text** for the ~200 verses ADR-0002 promises.
- **Out-of-scene copy** — setup, intro, HUD, stone-award microcopy, scene
  transitions, error and empty states, highlight-sync confirmation, alt text.
- **Scenes 2–9** — cast, NPC roster, blocking, dialogue. Scene 1 is about a
  ninth of it.
