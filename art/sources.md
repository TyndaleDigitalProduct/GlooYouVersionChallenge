# Art sources

Provenance record for every third-party art or audio asset used in this
project. An asset may not be used until it has a row here recording where it
came from and under what licence — see `AGENTS.md` §6.

| Asset | Origin | Author | Licence | URL | Retrieval date |
| ----- | ------ | ------ | ------- | --- | --------------- |
| `art/characters/**` (432 files, 16 characters) | Created for this project | Tyndale Digital Product | Project licence (GPL-3.0) | n/a, not third-party | n/a, not retrieved |
| `art/incoming/extras/**` (352 files) | Created for this project | Tyndale Digital Product | Project licence (GPL-3.0) | n/a, not third-party | n/a, not retrieved |

## Provenance

**Resolved 2026-07-28.** Both trees were created for this project, on the operator's
attestation. Neither is third-party, so neither carries an external licence and neither
needs reconciling against GPL-3.0; both are covered by the project's own licence.

This closes what had been recorded here as a blocker. For the history: both trees were
relocated out of `Data/` during PRD-02 (commit `9385bad` had placed them there), and
neither carried a licence file, readme, or any other provenance marker, so the agent
that moved them could not name an origin and correctly declined to guess one. PRD-05 is
the first PRD to load any of this art into the game, and it was blocked on this record
until the rows above were filled.

`AGENTS.md` §6 still applies to anything added later: never add an asset whose licence
you cannot name, and no asset may be used until it has a row here.

## Layout and conventions

Recorded because PRD-05 had to establish it empirically, and because the two trees do
not agree with each other.

**Walk sheets** (`art/characters/<name>/<name>_sheet_8dir_24x32_tone<N>.png` and
`art/incoming/extras/1B - Godot Sheets/skin-<N>-<tone>/<name>.png`) are 96x256: a grid
of 4 columns by 8 rows of 24x32 frames. Rows are one direction each and run
**clockwise from front**:

| Row | Direction |
| --- | --------- |
| 0 | front (south) |
| 1 | down-left (south-west) |
| 2 | left (west) |
| 3 | up-left (north-west) |
| 4 | back (north) |
| 5 | up-right (north-east) |
| 6 | right (east) |
| 7 | down-right (south-east) |

Columns are a four-frame walk cycle: 0 and 2 are the same neutral pose, 1 and 3 are the
two opposite steps. Column 0 doubles as the idle frame.

**Dialogue portraits** (`art/incoming/extras/3A - Dialogue Portraits/skin-<N>-<tone>/<name>/<n>-<DIR>.png`)
are 24x24 head-and-shoulders busts, one per direction, and are numbered
**counter-clockwise**: `1-S, 2-SE, 3-E, 4-NE, 5-N, 6-NW, 7-W, 8-SW`. This is the
reverse of the walk-sheet row order above, so one cannot be derived from the other.

The row order was established by matching each character's labelled per-direction
24x24 crop (`front/`, `left/`, `upleft/`, …) against the sheet frames pixel by pixel,
not by assuming the portrait numbering applied.

Three skin tones ship for every character: `tone1`/`skin-1-light`,
`tone2`/`skin-2-medium`, `tone3`/`skin-3-deep`. They are the same artwork with a
different palette, so any tone may be substituted for any other without changing
frame geometry.
