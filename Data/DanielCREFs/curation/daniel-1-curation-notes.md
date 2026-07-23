# Daniel 1 Cross-Reference Curation — Notes & Decisions

How the curated set in [`../curated/daniel-1.json`](../curated/daniel-1.json) was built,
the principles behind it, and what was deliberately cut and why — so Daniel 2–12
(and any other book) can be curated the same way. The JSON is the source of truth
for the actual selections; this file is the reasoning around them.

## Context

The game walks players through Daniel 1 in progress-gated **cut-scenes**. At each
scene, optional AI **cross-reference characters** — grouped by biblical section
(Torah, OT History, OT Poetry/Wisdom, Prophets, Gospels/Acts, NT Letters) — discuss
how *other* passages illuminate the Daniel beat; players earn currency for getting
the connection. Curation feeds those encounters. References use YouVersion/USFM
format; caps are **≤3 per verse, ≤5 per scene** (fewer is fine).

## Curation principles (the playbook)

1. **Illumination first.** A pick must add something the Daniel verse doesn't already
   say. Bare single verses that merely restate the beat get cut or widened.
2. **Scope to passages, not fragments.** Use USFM ranges (`2KI.24.1-4`) big enough to
   carry the illuminating content.
3. **Translation-robust.** The connection must survive modern translations (the game
   shows YouVersion translations). Drop links that only work on a KJV word — e.g. the
   "Shinar ↔ Babel" tie in 1:2.
4. **Comprehension-safe.** Avoid connections that need subtle theological distinctions
   a lay reader can't parse, or that could mislead. (Acts 10 and Romans 14 were cut at
   1:8 for this.)
5. **Principle over coincidence.** Anchor on a genuine shared principle, not a matching
   word or number. (Revelation 2:10's "ten days" was cut as number-coincidence.)
6. **No decontextualized promises.** Don't lift a promise God made to a specific people
   in a specific situation and reapply it. (Exodus 23:25's wilderness promise was cut.)
7. **Set aside internal Daniel refs** (`DAN.*`) — same book, forward-chapter spoilers,
   and there's no Daniel/apocalyptic host character anyway.
8. **Section variety within a scene** — aim for different characters, without sacrificing
   a clearly stronger pick.
9. **Not limited to the source dataset.** When a better reference exists outside the
   `josephilipraja` cross-refs, use it (flag it as a fresh pick).
10. **Plain-language notes.** The `note` field is for a general audience — no KJV
    quotations or archaic phrasing.
11. **Verify every pick against actual KJV text** before committing (the dataset is
    KJV-versified).
12. **It's fine to leave a verse uncovered** rather than force a weak or confusing ref.

## Final selections (24 refs, from 207)

| Scene | Verse(s) | Cross-references (character) |
|-------|----------|------------------------------|
| 1 | 1:1     | 2 Kings 24:1-4 *(History)* · Jeremiah 25:2-11 *(Prophets)* |
| 2 | 1:2     | Psalm 106:40-42 *(Poetry)* · Isaiah 42:21-25 *(Prophets)* |
| 3 | 1:3-5   | Isaiah 39:1-7 *(Prophets)* · Acts 7:20-22 *(Gospels/Acts)* · 2 Kings 25:27-30 *(History)* |
| 4 | 1:6-7   | Ezekiel 14:13-14 *(Prophets)* · Genesis 41:39-45 *(Torah)* · 2 Kings 24:15-17 *(History)* |
| 5 | 1:8-10  | Genesis 39:20-23 *(Torah)* · Proverbs 29:25 *(Wisdom)* |
| 6 | 1:11-16 | Deuteronomy 8:2-4 *(Torah)* · Hebrews 11:24-26 *(NT Letters)* · Matthew 4:1-4 *(Gospels/Acts)* |
| 7 | 1:17    | James 1:5 *(NT Letters)* · Proverbs 2:6 *(Wisdom)* · Genesis 41:15-16 *(Torah)* |
| 8 | 1:18-19 | Proverbs 22:29 *(Wisdom)* · 1 Samuel 2:1-10 *(History)* · Luke 21:12-15 *(Gospels/Acts)* |
| 9 | 1:20-21 | Isaiah 47:12-15 *(Prophets)* · Psalm 119:98-100 *(Wisdom)* · Esther 10:2-3 *(History)* |

Section balance: Prophets 5 · History 5 · Poetry/Wisdom 5 · Torah 4 · Gospels/Acts 3 · NT Letters 2.

## Notable cuts (instructive examples of the principles)

- **Exodus 23:25** (1:15) — decontextualized wilderness food/health promise → principle 6.
- **Revelation 2:10** (1:14) — "ten days" number-coincidence → principle 5.
- **Acts 10 / Romans 14** (1:8) — the food-law parallels invert on closer reading and
  would mislead a lay reader → principle 4. (1:8 left uncovered as a result.)
- **1 Kings 3 / Solomon** (1:17) — Solomon squandered the wisdom God gave; a discordant
  model next to Daniel's faithful stewardship.
- **Genesis 11 / Babel** (1:2) — the tie leans on the KJV word "Shinar" → principle 3.
- **Ezra 1:1-4** (1:21) — return-from-exile reads more into a verse that's really about
  Daniel's longevity in the court.
- **Joseph** — a genuinely strong parallel, used deliberately **three** times (Gen 39, Gen 41
  twice) and then held back to avoid over-reliance on one figure.
- **Internal `DAN.*` refs** — excluded throughout → principle 7.

## Intentionally left uncovered

- **1:8** (Daniel's resolve not to defile himself) — no honest, non-misleading fit survived.
- **1:13** — the source dataset has no cross-references here.

## Deferred to later chapters

- **Matthew 24:15** (Jesus citing "Daniel the prophet" / the abomination of desolation) —
  not illuminating for Daniel 1; revisit when curating **Daniel 9 / 11 / 12**.
