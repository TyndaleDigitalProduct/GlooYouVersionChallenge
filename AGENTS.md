# GlooYouVersionChallenge — Project & Agent Ruleset

This document is binding for all AI agents working in this repo. The PRD loop and
its workers read it on every task.

It is a **map, not a manual.** It says what the process is and where decisions
live. It does not restate them. If detail here ever conflicts with the file it
points to, the pointed-to file wins.

## 1. Project Overview

Tyndale Digital Product's entry for the **Scripture in New Frontiers** challenge
run by Gloo and YouVersion (summer 2026). The project is a Scripture engagement
game built around the book of Daniel, using a curated set of cross-references to
connect scenes in the text to the wider biblical canon.

**Stack:** TypeScript, Phaser 4, React 19, Vite 8, pnpm, Vitest, Playwright,
hosted on Vercel. The choices, the reasoning, the rejected alternatives, and the
three binding architecture invariants are all in
[ADR-0002](./docs/decisions/0002-frontend-and-runtime-stack.md). **Read it before writing code or proposing a stack change.**

## 2. Where decisions live

| Question                                       | Authority                                              |
| ---------------------------------------------- | ------------------------------------------------------ |
| Stack, architecture, invariants, licence risks | `docs/decisions/0002-frontend-and-runtime-stack.md`    |
| Encounter format, rewards, card generation     | `docs/decisions/0003-card-selection-encounters.md`     |
| Why we keep ADRs, and their rules              | `docs/decisions/0001-record-architecture-decisions.md` |
| What we are building, and why                  | `docs/notes/Verse & Vale - Daniel 1 Experience PRD.md` |
| Scene breakdown and cross-reference design     | `docs/notes/scenes and cross refrences.md`             |
| Current and queued work                        | `docs/prds/`                                           |
| Docs conventions, `research/` vs `notes/`      | `docs/README.md`                                       |
| Dataset origin, licence, reproduction          | `Data/DanielCREFs/sources.md`                          |
| Reference normalization to USFM                | `Data/DanielCREFs/normalized/README.md`                |
| Third-party licence terms and open questions   | `THIRD_PARTY.md`                                       |
| Art and audio provenance, per asset            | `art/sources.md`                                       |

## 3. Repository layout

| Path              | What goes here                                                      |
| ----------------- | ------------------------------------------------------------------- |
| `AGENTS.md`       | this ruleset — the single source of truth for agents                |
| `CLAUDE.md`       | pointer to this file; do not duplicate rules there                  |
| `README.md`       | human-facing project summary                                        |
| `docs/prds/`      | PRDs, numbered `NN_short_name.md`; `completed/` holds finished ones |
| `docs/decisions/` | ADRs, `NNNN-short-title.md`. **Human-authored — see §6.**           |
| `docs/research/`  | external material: challenge brief, platform API docs, prior art    |
| `docs/notes/`     | working scratch: meeting notes, debugging trails                    |
| `Data/`           | upstream and machine-derived datasets                               |
| `content/`        | authored game content: curated refs, dialogue, guide personas       |
| `art/`            | art masters and their provenance                                    |
| `public/assets/`  | runtime assets, loaded by Phaser via URL                            |
| `src/core/`       | pure TypeScript rules and persisted state                           |

Everything is tracked, `Data/` included. The `Data/` versus `content/` boundary,
and the rule that nothing shipped may read from `Data/`, are defined in ADR-0002.

## 4. Mandatory Quality Gates

Code is not "done" until ALL pass:

1. `pnpm test`
2. `pnpm test:coverage` — `src/core/**` ≥ 90%, gated. Global reported only
   (rationale in ADR-0002).
3. `pnpm build`
4. `pnpm lint`
5. `pnpm e2e`

**Do not invent gate commands.** If one does not work, stop and report it.

## 5. PRD Lifecycle

1. **Draft:** create `docs/prds/NN_short_name.md`. Implementation needs approval.
2. **Branch:** create a feature branch off latest `main`. **Never** push to `main`.
3. **Test-first:** write failing tests for the PRD's acceptance criteria.
4. **Implement:** make them pass.
5. **Verify:** run the full suite + build + lint (section 4).
6. **Finalize:** move the PRD to `docs/prds/completed/`.
7. **PR:** push the branch and open a PR — only after explicit operator approval.

## 6. Conventions

- **Commits:** natural-language summary, prefixed with the PRD number
  (e.g. "PRD-03: add login form"). No conventional-commit prefixes.
- **No AI attribution in commits.** Do not add `Co-Authored-By: Claude` or any
  similar trailer. The operator adds disclosure himself.
- **Scripture references:** USFM book codes (`DAN`, `GEN`, `MAT`). No second
  reference format without an ADR.
- **Provenance:** every dataset and every third-party asset is recorded before
  use, per the files in §2. **Never add an asset whose licence you cannot name.**
- **Secrets:** the YouVersion `app_key` is the only credential allowed in the
  browser bundle. Everything else is server-side only. Never commit one.

## 7. Agent Constraints

- **NEVER** bypass quality gates or coverage requirements.
- **NEVER** commit or push without explicit operator approval.
- **NEVER** modify application source without an established failing test
  (once a test framework exists).
- **NEVER** write an ADR in `docs/decisions/`. Those are the operator's to
  author. If you make a call during a PRD that deserves recording — a stack
  choice, a data model, a boundary — surface it in your summary and let the
  operator decide. Do not create the file.
- **NEVER** rewrite git history or force-push. The remote is a shared org repo.
- **NEVER** run destructive or irreversible commands without explicit approval.
  This includes anything under `Data/` or `content/`.
- **NEVER** build or run Docker images. Make the fix, hand it to the operator.
- **NEVER** violate the architecture invariants in ADR-0002. If one blocks you,
  stop and ask; do not work around it.
- **Stop on blocked workflows:** if a tool needs interactive input or is blocked,
  do NOT hack around it. Stop, explain, and ask for guidance.

## 8. Definition of Done

Once section 4 is active, success for any PRD is strictly bound to those Quality
Gates. Do not signal completion until every gate is met. Report failures with
the actual output; never describe an unrun check as passing.
