# GlooYouVersionChallenge

Tyndale Digital Product's entry for the **Scripture in New Frontiers** challenge
from Gloo and YouVersion, summer 2026.

A Scripture engagement game built around the book of Daniel. The game uses a
curated set of cross-references to connect scenes in Daniel to the wider
biblical canon.

## Status

Early. No application code yet — the work so far is dataset preparation and
project scaffolding. The tech stack has not been chosen.

## Repository layout

```
AGENTS.md        binding ruleset for AI agents working in this repo
CLAUDE.md        pointer to AGENTS.md
THIRD_PARTY.md   upstream data provenance and licence terms
LICENSE          GPL-3.0
docs/            PRDs, decisions, research, notes — see docs/README.md
```

One directory is **local to the maintainer's machine and not tracked here**:
`Data/`, which holds the Daniel cross-reference datasets and their provenance.
If you have cloned this repository it will be absent — that is expected, not a
broken checkout.

## Working on this project

Read [`AGENTS.md`](./AGENTS.md) first. It defines the PRD-driven workflow,
the quality gates, and the constraints that apply to both people and agents.

Work is organised as numbered PRDs. Each one gets a feature branch off `main`,
and nothing is pushed to `main` directly.

## Licence

GPL-3.0 — see [`LICENSE`](./LICENSE).

Third-party cross-reference data is used under separate terms; see
[`THIRD_PARTY.md`](./THIRD_PARTY.md), which also flags an unresolved licence
compatibility question to settle before public release.
