# Verse & Vale

Tyndale Digital Product's entry for the **Scripture in New Frontiers** challenge
from Gloo and YouVersion, summer 2026.

A Scripture engagement game built on Daniel 1. The player walks the chapter's
nine scenes — from the siege of Jerusalem to Daniel standing in the court of
Babylon — reading each scene's passage and meeting six guide personas who
connect the story to the wider biblical canon through twenty-four curated
cross-references. Each encounter presents insight cards generated live by Gloo
AI, grounded in a human-written curated note; the player picks the connections
they find most important and the reveal teaches the rest. Nothing is ever
punitive and no side content gates the story.

**Play it at [verse-vale.crevex.tech](https://verse-vale.crevex.tech).**

## Status

Feature-complete for submission: all nine scenes of Daniel 1 are playable end
to end, with both challenge integrations live in production.

- **Gloo AI** generates each encounter's six insight cards at runtime through
  a serverless route, validated against a strict schema and grounded in the
  curated note as the authority. A failed generation degrades to a reviewed
  fallback set, and the UI says so honestly.
- **YouVersion Platform** provides OAuth sign-in (PKCE, no client secret),
  live Scripture text (NIV, degrading to bundled public-domain WEB offline),
  and highlight sync. Highlights are captured locally always; signing in is
  never required to play and controls sync only.

Progress saves to `localStorage` — there is no database. The five mandatory
quality gates (test, coverage, build, lint, e2e) run locally and in GitHub
Actions on every PR.

## Stack

TypeScript, Phaser 4 (the world), React 19 (all readable text, as real DOM),
Vite, zustand + zod (engine-agnostic core rules in `src/core/`), Vitest,
Playwright, hosted on Vercel with two serverless routes. The reasoning behind
every choice is in [ADR-0002](./docs/decisions/0002-frontend-and-runtime-stack.md)
and [ADR-0003](./docs/decisions/0003-card-selection-encounters.md).

## Running it locally

```
pnpm install
pnpm dev
```

Node 20 (the version CI pins) is required for the test suite. With no
credentials configured the game runs fully: Scripture falls back to the
bundled WEB text, insight cards to the reviewed fallback sets, and sign-in
stays a labelled stub. To exercise the live integrations, copy `.env.example`
to `.env` and follow its comments.

The quality gates: `pnpm test`, `pnpm test:coverage`, `pnpm build`,
`pnpm lint`, `pnpm e2e`.

## Repository layout

```
AGENTS.md        binding ruleset for AI agents working in this repo
CLAUDE.md        pointer to AGENTS.md
THIRD_PARTY.md   upstream data provenance and licence terms
LICENSE          GPL-3.0
api/             the two Vercel serverless routes (Gloo, YouVersion)
docs/            PRDs, decisions, research, notes — see docs/README.md
src/             application source (core rules, game, UI, app shell)
content/         authored game content: refs, dialogue, personas, cards
Data/            upstream and machine-derived datasets (see ADR-0002)
art/             art masters and their provenance
public/assets/   runtime assets loaded by Phaser
e2e/             Playwright suite
```

## Working on this project

Read [`AGENTS.md`](./AGENTS.md) first. It defines the PRD-driven workflow,
the quality gates, and the constraints that apply to both people and agents.

Work is organised as numbered PRDs. Each one gets a feature branch off `main`,
and nothing is pushed to `main` directly.

## Licence

GPL-3.0 — see [`LICENSE`](./LICENSE).

Third-party cross-reference data is used under separate terms; see
[`THIRD_PARTY.md`](./THIRD_PARTY.md) for its provenance and for the record of
the GPL-2.0/GPL-3.0 compatibility question, resolved 2026-07-27 on legal
advice. There is no third-party art or audio in the project.
