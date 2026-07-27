# Third-party material

Everything in this repository that was not authored for this project, and the
terms it arrived under. This file is the authority referenced by `AGENTS.md` §2
and `README.md`.

This project is licensed **GPL-3.0** (see [`LICENSE`](./LICENSE)). Each entry
below records what a component is licensed under, and whether that has been
reconciled with GPL-3.0.

| Component | What it is | Licence | Status |
| --------- | ---------- | ------- | ------ |
| Daniel cross-reference dataset | 357 verses of Daniel with 5,174 cross-references | GPL-2.0 | Cleared, see below |
| `art/characters/**` | 432 files, 16 characters | Not recorded | **Open** |
| `art/incoming/extras/**` | 351 files, unsorted | Not recorded | **Open** |

## Daniel cross-reference dataset

**Files:** `Data/DanielCREFs/daniel-cross-references_josephilipraja-bible-cross-reference-json.json`
(raw upstream) and `Data/DanielCREFs/normalized/daniel-1.json` (normalized
intermediate). The curated, game-facing selection derived from these lives at
`content/daniel-1.refs.json`.

| | |
|---|---|
| **Source repository** | [josephilipraja/bible-cross-reference-json](https://github.com/josephilipraja/bible-cross-reference-json) (GitHub, `master` branch) |
| **Upstream origin** | Cloned by its author from https://bitbucket.org/josephilipraja/bible-cross-reference-json/ |
| **Cross-reference data credit** | [SoulLiberty / MetaV](https://github.com/souliberty/MetaV), per the source repository's README |
| **Licence** | GNU General Public License v2.0 (GPL-2.0). The source README adds: "Free to use/modify, as long as it stays free." |
| **Source last updated** | 2014-01-20 |
| **Retrieved** | 2026-07-12 |

Full extraction method, format, and per-chapter counts are recorded in
[`Data/DanielCREFs/sources.md`](./Data/DanielCREFs/sources.md). That file is the
detail; this one is the licence position.

### Licence position

The upstream dataset is GPL-2.0 and this project is GPL-3.0. The two are not
automatically compatible: GPL-2.0 text without an "or later" clause cannot be
relicensed to GPL-3.0, and the upstream repository does not carry that clause.
ADR-0002 raised this and deliberately left it unsettled, because it was not an
engineering call.

**Resolved 2026-07-27.** The operator obtained legal advice and confirms the
combination is cleared for use and release. Recorded here on the operator's
attestation; the reasoning behind the advice is not captured in this repository.

If the specifics ever matter (a downstream redistributor asks, or the project
changes licence), the substance of that advice should be written into this
section. A bare clearance is enough to unblock work but is thin as a record.

## Art and audio

Per-asset provenance is tracked in [`art/sources.md`](./art/sources.md), which is
the working record. This section carries only what is third-party and therefore
licence-relevant.

**Status: open.** 783 image files across `art/characters/` and
`art/incoming/extras/` have no recorded origin, author, or licence. They were
committed in `9385bad` and relocated during PRD-02; neither tree carried a
licence file, readme, or any other marker, so no origin could be named.

This is a question of fact, not law, and legal advice does not answer it: either
these files were made for this project or they came from somewhere. If they are
bespoke or operator-generated, recording that in `art/sources.md` closes both
rows and this section becomes "no third-party art."

Until then, `AGENTS.md` §6 applies: **never add an asset whose licence you cannot
name**, and an asset may not be used until its row is filled. Files already
committed are not "used," so nothing is currently in breach, but the first PRD
that loads this art into the game is blocked.

Watch for CC-BY-SA and some OpenGameArt terms if any of it does turn out to be
third-party. ADR-0002 flags that these do not combine cleanly with GPL-3.0, and
that would be a second licence question rather than a repeat of the first.

## Runtime dependencies

npm dependencies are declared in `package.json` and resolved in `pnpm-lock.yaml`,
which together are the authoritative record of what is installed and at which
version. They are not duplicated here, because a hand-maintained copy would drift.

No third-party Phaser plugins are used; ADR-0002 records that decision.

## Scripture text

Passage text is fetched from the YouVersion Platform API at runtime and is not
redistributed in this repository. A bundled public-domain fallback (WEB) covers
development and API outages. Neither is licence-encumbered for this use. If the
fallback text is ever committed, its edition and source belong in this section.
