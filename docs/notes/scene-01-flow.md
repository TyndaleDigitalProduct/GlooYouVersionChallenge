# Scene 1 flow — Daniel 1:1

Design input for PRD scoping. Beat-by-beat for Scene 1, plus the rules that
generalise to all nine scenes. The reward and card-generation decisions are
recorded in [ADR-0003](../decisions/0003-card-selection-encounters.md), which is
the authority where this file and it disagree; the design they follow from is
[`storyboard-v2.md`](./storyboard-v2.md).

Content authority: `content/daniel-1.refs.json`, scene `id: 1`.

## The six personas

Cross-reference characters map one-to-one onto the `section` field already in the
curated data — the mapping ADR-0002 established. Names below replace the
placeholder "Scholar" and "Prophet"; "Scholar" in particular reads academic,
which the product PRD's "no academic language" line rules out.

| `section` | Persona | Refs | Scenes |
| --- | --- | --- | --- |
| OT History | the Chronicler | 5 | 1, 3, 4, 8, 9 |
| Prophets | the Watchman | 5 | 1, 2, 3, 4, 9 |
| OT Poetry/Wisdom | the Songkeeper | 5 | 2, 5, 7, 8, 9 |
| Torah (Gen–Deut) | the Elder | 4 | 4, 5, 6, 7 |
| Gospels/Acts | the Witness | 3 | 3, 6, 8 |
| NT Letters | the Courier | 2 | 6, 7 |

No persona ever appears twice in one scene, so one instance per persona per scene
is sufficient and no disambiguation UI is needed. All six are met by Scene 6; the
Courier arrives last.

**Scene 1 cross-reference characters:** the Chronicler (`2KI.24.1-4`) and the
Watchman (`JER.25.2-11`). Both anchor to `DAN.1.1`.

## Cast

- **Self** — the player, named at setup, addressed by that name in dialogue.
- **Lamplighter** — the guide. Opens and closes every scene.
- **Cross-reference characters** — the Chronicler, the Watchman.
- **Story characters** — Nebuchadnezzar, Jehoiakim, Daniel, Hananiah, Mishael,
  Azariah. 1–3 scene-appropriate lines, no interaction.
- **NPCs** — one bland line each, no interaction.

Story-character dialogue puts words in the mouths of named biblical figures.
Keep lines close to the text and route them through theological review before
they ship; this is a content-review gate, not a writing task.

## Beats

### 1. Scene entry

Lamplighter greets the player by name, presents `DAN.1.1` as a Scripture card,
then moves off to a fixed off-screen position on the scene map.

**Prefetch both encounters' cards here, in the background.** Generation is a
server round-trip; doing it on character click means the player waits on a
spinner twice per scene. The Lamplighter's opening beat is the cover.

### 2. Free movement

Click-to-move anywhere; click a character to talk. Two things need specifying
rather than left to implementation:

- **Hit resolution.** A click inside a character's interaction radius opens
  dialogue and must *not* also move the player. Define the radius explicitly.
- **Touch has no hover.** Desktop can use hover to show a character is
  interactive; mobile cannot. A visible affordance on approach is required, not
  optional — this is the input ambiguity that makes or breaks point-and-click.

### 3. Cross-reference encounter (the Chronicler, then the Watchman, in either order)

Identical shape for both. Using the Chronicler:

1. **Intro line**, in persona: *we can learn more about Daniel 1:1 by looking at
   2 Kings 24:1–4.*
2. **Both Scripture cards** — `DAN.1.1` and `2KI.24.1-4` — presented for reading.
3. **Read gate.** The card-selection UI unlocks only once both Scripture cards
   have been opened. Without this, a player can score without reading, and the
   YouVersion highlight would record verses they never saw.
4. **Six insight cards**, values hidden. Prompt: *pick the most important things
   you learn from this connection.*
5. **Selection, capped at three.** Selection is reversible until locked; locking
   is explicit and confirmed.
6. **Reveal.** All six values shown as numbers. Selected and unselected
   distinguished by colour *and* a non-colour cue. Curated note shown as the
   authoritative explanation. No possible-total displayed.
7. **Stones awarded** — see below.
8. **Closing line**, then the character goes inactive and displays a summary
   card of the completed interaction.

**Inactive characters.** The summary card shows the cards, which were selected,
their values, and the note. Scripture cards remain re-openable — re-reading
Scripture is never blocked. No re-scoring: `encounters.ts` transitions are
forward-only and the ledger id is deterministic on
`sceneId:reference:cause`, so this is already structurally impossible.

**Highlights.** Every reference the player reads in a Scripture card gets a
highlight in the game colour. `DAN.1.1` is the anchor for both encounters and
`highlights.ts` stores one colour per reference, so either use a single game
colour throughout or fix two colours (anchor, cross-reference) — otherwise the
anchor flips colour depending on interaction order. Record highlights locally
always; YouVersion opt-in controls *sync*, not capture (`highlights.ts` takes no
session parameter by design).

### 4. Scene exit

The Lamplighter asks whether the player has learned everything they want from
Daniel 1:1 and is ready to move on.

**The Lamplighter must be reachable.** They left the screen in beat 1. Either
they return once both encounters are inactive, or a persistent "ready to move on"
affordance appears. As written, the player has to hunt a blank map for the only
character who can end the scene.

**Leaving early is allowed by design** — encounters are optional and never gate
progress. So the exit needs copy for the case where the player has engaged one
encounter or none, not just the completed path.

## Rewards

Proposed magnitudes — sanity-check these, since nothing spends
stones yet and the current constants (`BASE_STONE_AWARD = 1`,
`BONUS_STONE_AWARD = 2`) no longer describe the scale:

| Cause | Amount | Notes |
| --- | --- | --- |
| Engagement | 1 | Locking a selection, once per encounter. Guarantees a player who picks only 0-value cards still earns something. |
| Insight | 0–15 | Sum of selected card values (max three at 5). |
| Scene complete | 5 | Once per scene. No `reference`. |
| All references engaged | 10 | Scene 1 = both encounters. Scales with scene ref count (2 or 3). No `reference`. |

Ceiling for Daniel 1 lands near 520 stones across 24 encounters and 9 scenes.

## Card generation contract

Server-side, one call per encounter, structured output.

**Prompt carries:** the Daniel passage text, the cross-referenced passage text,
and the `note` from `daniel-1.refs.json` **as the authority**.

**Rules:**
- Correct cards must be entailed by the note. Values 3–5 by weighted importance.
- Incorrect cards are worth 0 and must be *clearly* wrong — contradicting the
  passage, or importing a claim absent from it.
- Never produce a distractor that is true of the passage but merely absent from
  the note. It scores 0 and punishes a player for reading well; this is the
  failure most likely to pass casual review.
- Card text is one short sentence, plain language, no academic register.

**Schema validation, hard fail:** exactly 6 cards; integer values 0–5; at least
one card at 0; at least three cards above 0; no duplicate text. One retry, then
the fallback set.

**Persist the generated set to the save** on first generation. Cards exist
nowhere else, so the save is the only source for rendering the summary card on
revisit — and persisting also prevents re-rolling after a reload.

**Calibration:** a build-time script that runs all 24 encounters through the
prompt, generates a few sets each, and dumps them to markdown for review. At this
scale that is the eval. It does not ship.

## Development fallback sets

**Moved.** The reviewed Scene 1 fallback card sets now live in
**[`content/daniel-1.cards.json`](../../content/daniel-1.cards.json)**, keyed by
scene id then cross-reference, alongside a `constraints` block holding the same
rules the runtime schema validator enforces.

That file is the single source of truth for card values — do not restate them
here, or the two copies will drift.

Their purpose is unchanged: building and iterating the card UI without spending a
Gloo call on every reload, and the set a failed or schema-violating generation
degrades to. They are not the scoring key for a live encounter.

## Sprite assignments — Scene 1

Existing masters in `art/characters/` cover most of the cast. Note that several
characters ship in two costumes; Scene 1 is the siege, so it takes the pre-court
variants.

| Role | Sprite | Notes |
| --- | --- | --- |
| Nebuchadnezzar | `neb_war` | `neb_royal` is for the throne-room scenes |
| Jehoiakim | `jehoiakim` | |
| Daniel | `daniel_judean` | `daniel_court` from Scene 3 onward |
| Hananiah | `hananiah` | |
| Mishael | `mishael` | |
| Azariah | `azariah` | |
| Self | `youth_a` or `youth_b` | Decide; the other becomes an NPC |
| NPCs (6) | reuse + tone variants | Every sheet ships `tone1/2/3`, so six visually distinct NPCs are reachable from two or three sheets |
| **Lamplighter** | **missing** | Most-seen character in the game; worth one bespoke sheet |
| **6 personas** | **missing** | `mag_a/b/c` could cover three; the other three need recolours or new sheets |

`ashpenaz`, `melzar`, `cyrus`, and `mag_a/b/c` map to later scenes (Dan 1:3,
1:11, 1:21, 1:20) — the roster was built for the whole chapter.

**The lantern is the interaction affordance.** Personas carry a lamp like the
Lamplighter's. That solves the touch-affordance problem diegetically: a lit lamp
means "this character has something for you," and needs no hover. Story
characters and NPCs carry none.

## Dialogue — Scene 1

Draft copy, for review. Lines for named biblical figures are invented and must
clear theological review before shipping; they are deliberately kept to
observation and situation rather than any claim the text does not make.

### Lamplighter

**Opening** (name-aware): *"Ah — {name}. You came. Most people walk past a door
like this one."*

Presents `DAN.1.1`.

*"One line. A king came, and he laid siege. That's all Daniel gives you here —
and it took twenty years of warning to earn that line."*

*"I'll be nearby. Wander where you like, talk to anyone. The ones carrying a
lamp like mine have something to show you."*

**Exit, both encounters engaged:** *"You heard them both out. Have you learned
everything you want from this one line, {name} — ready to see what comes next?"*

**Exit, one engaged:** *"The {remaining persona} still has something for you.
We can go on if you'd rather — but this street won't be here to come back to."*

**Exit, none engaged:** *"Nothing caught you here? That's allowed. Not every
room asks something of you."*

**If the player declines:** *"Then take your time. I'm not going anywhere."*

### Story characters

**Jehoiakim** (`jehoiakim`)
1. *"Three years I sent Babylon its tribute. Three years. Their chariots are at
   my gate anyway."*
2. *"My fathers built these walls. I will not be the king who opens them."*

**Nebuchadnezzar** (`neb_war`)
1. *"The city will open. They always open."*
2. *"I did not come for their gold. I came for their best — the quickest of
   their young men."*

**Daniel** (`daniel_judean`)
1. *"The prophets warned us for years. I was too young to listen properly."*
2. *"If they take us, I'll still be who I am. They can rename a city. Not
   that."*

**Hananiah** (`hananiah`)
1. *"They finished the siege works this morning. Tomorrow, maybe the day
   after."*

**Mishael** (`mishael`)
1. *"Listen. The whole city has gone quiet. Even the dogs."*

**Azariah** (`azariah`)
1. *"I count how many days of food are left. Then I stop, and then I count
   again."*

### NPCs

Six, one line each, no interaction.

1. **Gate watchman** — *"Move along. The wall's no place to stand and stare."*
2. **Water carrier** — *"Two jars a household now. The cistern's dropping
   fast."*
3. **Temple servant** — *"The priests haven't stopped once. They sing like
   there's nothing outside the wall."*
4. **Grain seller** — *"Nothing to sell. Come back when the siege lifts. If it
   lifts."*
5. **Child** — *"My brother went up to look at the army. He hasn't come back
   down."*
6. **Elder** — *"I've lived through a siege before. It ends one of two ways, and
   only one of them is good."*

### the Chronicler

**Intro:** *"Daniel gives you one line — the king came, and he besieged. I keep
the longer record. Read what Kings says about that same year, then tell me what
matters."*

**Read-gate nudge:** *"Both scrolls first. I'll wait. I've waited longer."*

**On lock:** *"Chosen. Now let's see all six."*

**Reveal framing:** *"Every one of them, weighed. The ones you set aside were
worth seeing too."*

**Closing:** *"You read well, {name}. The record holds you now, as much as you
hold it."*

**Summary card header:** *The Chronicler's record — Daniel 1:1 and 2 Kings 24*

### the Watchman

**Intro:** *"I stood on a wall like this for twenty-three years, telling them
this day was coming. Read Jeremiah. Then read Daniel's one line again, and tell
me what you hear in it."*

**Read-gate nudge:** *"You haven't read them both. Look before you choose —
that's the whole job of a watchman."*

**On lock:** *"Locked in. Now look at all six."*

**Reveal framing:** *"Weighed and shown. What you passed over still had
something in it."*

**Closing:** *"Twenty-three years of warning, {name}, and one line in Daniel.
Now you know what stands behind it."*

**Summary card header:** *The Watchman's warning — Daniel 1:1 and Jeremiah 25*

## Content inventory — everything Scene 1 needs authored

Dialogue above covers one row of this. The rest is unwritten.

**Missing assets**
- Environment art: `public/assets/{maps,tiles}` are empty. Nine scenes need
  backgrounds; two or three reusable environments (besieged city, palace
  interior, throne room) is the realistic target.
- Runtime staging: masters are in `art/`, `public/assets/sprites` is empty.
- Lamplighter sprite; persona sprites (six, or three plus recolours).
- Bundled WEB text for the ~200 verses ADR-0002:156-159 promises. Scene 1 needs
  `DAN.1.1`, `2KI.24.1-4`, `JER.25.2-11`.
- Audio: `public/assets/audio` is empty. Decide whether any ships.
- Character blocking: where each of ~15 characters stands on the scene map, plus
  the Lamplighter's off-screen position.

**Missing copy, outside the scene**
- Home screen: title, tagline, enter label.
- Setup: name prompt, validation messages, and the YouVersion sign-in explainer
  — what syncing does, what happens if you decline. This is the trust moment in
  the whole product and deserves careful copy.
- Intro to Daniel: the skippable characters-and-mechanics explainer, plus where
  it can be reopened mid-game.
- Stone-award microcopy for four distinct causes.
- Scene transition / title card between scenes.
- HUD labels: stone balance, scene indicator, menu.
- Highlight-sync confirmation, and the opt-out path.
- Error and empty states: generation failed, YouVersion unreachable, offline,
  expired token, save migration failure.
- Alt text and screen-reader labels.

**Missing per-persona content**
- Voice guide and prompt template for each of the six personas. ADR-0002:132-133
  places these in `content/`; only the refs JSON is there today.
- Lamplighter character definition — voice, role, why the name.

**Missing scenes**
- Scenes 2–9. The rules in this file generalise, but each needs cast, NPC roster,
  blocking, and dialogue. Scene 1 is roughly a ninth of the authoring job.

## Known gaps for the PRD to close

1. `LedgerCause` has no value for scene completion or the all-references bonus,
   and `LedgerEntry.reference` is required — a scene-scoped award has no
   reference. Blocker.
2. `EncountersState` is `Record<string, EncounterStateValue>`, a bare string per
   encounter. It must carry generated cards and selections. Save-format
   migration.
3. The all-references bonus needs encounter state and progression together;
   compute it in an orchestrator above both modules so neither reads the other.
4. Interaction radius and the touch affordance for click-to-move vs click-to-talk.
5. Lamplighter reachability at scene exit, plus exit copy for the
   engaged-nothing and engaged-some paths.
6. Highlight colour scheme — one colour, or anchor vs cross-reference.
7. Where the intro's mechanics explainer can be reopened mid-game.
8. Save granularity: scene-level resume is probably sufficient, but the
   generated-cards persistence means mid-encounter state now exists. Decide
   whether a player can quit mid-encounter and return to the same cards.
9. **Completed scenes cannot be revisited.** `progression.ts` is sequential and
   append-only — `isSceneUnlocked` gates on the previous scene's completion and
   there is no API for returning to a finished scene. So skipping an encounter
   loses it permanently, which sits awkwardly beside "encounters are optional,
   never punitive": the player is not punished in stones, but they do forfeit
   content, possibly without realising. Either add scene revisit (an unlocked
   completed scene is re-enterable, with no re-awarding — the ledger already
   prevents that), or make the Lamplighter's exit copy explicit that leaving is
   final. The draft dialogue above assumes the second, which is the cheaper
   option but the worse experience.

## Repetition risk

Nine scenes, 24 encounters, one interaction shape. The personas carry some
variety but not 24 times. Cheapest mitigation that is content rather than engine
work: give the story characters a second line that unlocks once the player has
engaged a related cross-reference, so the world visibly registers what they have
learned. Right now those six characters are pure cost.
