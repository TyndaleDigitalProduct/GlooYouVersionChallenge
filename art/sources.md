# Art sources

Provenance record for every third-party art or audio asset used in this
project. An asset may not be used until it has a row here recording where it
came from and under what licence — see `AGENTS.md` §6.

| Asset | Origin | Author | Licence | URL | Retrieval date |
| ----- | ------ | ------ | ------- | --- | --------------- |
| `art/characters/**` (432 files, 16 characters) | Created for this project | Tyndale Digital Product team | GPL-3.0, as part of this repository | n/a — not retrieved | n/a — original work |
| `art/incoming/extras/**` (351 files) | Created for this project | Tyndale Digital Product team | GPL-3.0, as part of this repository | n/a — not retrieved | n/a — original work |
| `art/environments/**`, `art/objects/**`, `art/tiles/**`, `art/plots/**`, `art/dialog_boxes/**`, `art/start_screen/**`, `art/fonts/**` (201 files) | Created for this project | Kevin Rose | GPL-3.0, as part of this repository | n/a — not retrieved | n/a — original work |
| `art/environments/Daniel 1 Environments/**` (66 files: 4 full-map 1920x1080 backdrops + 62 transparent environment elements) | Created for this project | Kevin Rose | GPL-3.0, as part of this repository | n/a — not retrieved | 2026-07-30 — original work |

## Provenance resolved

All three trees are **original work, created for this project by a member of the
operator's team.** No third party holds rights in them and no external licence terms
apply; they are covered by this repository's GPL-3.0 licence like any other file
authored here.

This closes the question left open when the first two trees were relocated out of
`Data/` during PRD-02 (commit `9385bad` had placed them there). Neither carried a
licence file or readme, so the agent that moved them could not name an origin and
correctly declined to guess one — the files were bespoke all along, which no marker in
the tree could show.

The third tree was added later, delivered by the operator directly from Kevin Rose, the
artist, and arrived staged under `art/incoming/OneDrive_1_7-29-2026/` before being sorted
into `art/environments/`, `art/objects/`, `art/tiles/`, `art/plots/`, `art/dialog_boxes/`,
`art/start_screen/`, and `art/fonts/`. Its author is credited by name below rather than
as "team".

The fourth row is a second delivery from Kevin Rose, received 2026-07-30: the four
finished Daniel 1 environments and the 62 individual props composited into them. Same
author and same terms as the row above it; it is listed separately only because it
arrived on a different date and because it is the delivery PRD-13 stages into
`public/assets/maps/`.

Nothing here blocks use. `AGENTS.md` §6 is satisfied: the licence is named.

## Staged names differ from master names

`public/assets/` is generated from `art/` by `pnpm stage:assets`
(`scripts/stage-assets.mjs`), which normalises file names on the way through. The
masters keep whatever the artist sent, including `Jerusalem Seige.png`, whose
misspelling is preserved here on purpose: the master is the delivered file, and
correcting it in `art/` would make the repository disagree with the artist's own
copy. The staging script writes it out as `jerusalem-siege.png`.
