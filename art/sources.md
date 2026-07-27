# Art sources

Provenance record for every third-party art or audio asset used in this
project. An asset may not be used until it has a row here recording where it
came from and under what licence — see `AGENTS.md` §6.

| Asset | Origin | Author | Licence | URL | Retrieval date |
| ----- | ------ | ------ | ------- | --- | --------------- |
| `art/characters/**` (432 files, 16 characters) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| `art/incoming/extras/**` (351 files) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED |

## Unresolved provenance

The two rows above are **blockers, not placeholders.** Both trees were relocated out
of `Data/` during PRD-02 (commit `9385bad` had placed them there). Neither tree carried
a licence file, readme, or any other provenance marker, so the agent that moved them
could not name an origin and did not guess one.

Per `AGENTS.md` §6 an asset may not be *used* until its row here is filled in. Moving
files that were already committed is not use, so nothing is violated yet. But the first
PRD that loads any of this art into the game is blocked until the operator completes
both rows. If any of it is third-party, that also has to reach
[`THIRD_PARTY.md`](../THIRD_PARTY.md), where these two rows are carried as the one
remaining open licence question.

If these are bespoke or operator-generated, say so explicitly in the rows. "Created for
this project" is a complete and valid answer; an empty cell is not.
