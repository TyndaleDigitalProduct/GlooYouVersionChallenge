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

**There is no third-party art in this repository.**

**Resolved 2026-07-28.** The 784 image files across `art/characters/` and
`art/incoming/extras/` were created for this project, on the operator's
attestation. They are covered by the project's own GPL-3.0 licence and there is
no external licence to reconcile. This closes what this section previously
carried as the one remaining open licence question.

Per-asset provenance, and the sprite sheet layout conventions, are recorded in
[`art/sources.md`](./art/sources.md), which remains the working record.

ADR-0002's warning about CC-BY-SA and some OpenGameArt terms not combining
cleanly with GPL-3.0 is therefore moot for the current asset set. It still
applies to anything added later: `AGENTS.md` §6 requires a provenance row before
an asset is used, and no asset may be added whose licence cannot be named.

No audio ships yet. ADR-0002 defers the audio approach.

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
