# GlooYouVersionChallenge — Project & Agent Ruleset

This document is binding for all AI agents working in this repo. The PRD loop and
its workers read it on every task.

## 1. Project Overview

Tyndale Digital Product's entry for the **Scripture in New Frontiers** challenge
run by Gloo and YouVersion (summer 2026). The project is a Scripture engagement
game built around the book of Daniel, using a curated set of cross-references to
connect scenes in the text to the wider biblical canon.

- **Language / Framework:** NOT YET CHOSEN
- **Package manager / runner:** NOT YET CHOSEN
- **Testing:** NOT YET CHOSEN
- **Environment wrapper:** none

> Sections 1 and 3 must be completed before the first code PRD is implemented.
> Record the stack decision as an ADR in `docs/decisions/` and then update this
> file in the same PRD.

## 2. Repository layout

| Path | What goes here |
|---|---|
| `AGENTS.md` | this ruleset — the single source of truth for agents |
| `CLAUDE.md` | pointer to this file; do not duplicate rules there |
| `README.md` | human-facing project summary |
| `THIRD_PARTY.md` | upstream data provenance and licence terms |
| `docs/prds/` | PRDs, numbered `NN_short_name.md`; `completed/` holds finished ones |
| `docs/decisions/` | ADRs, `NNNN-short-title.md`. **Human-authored — see §6.** |
| `docs/research/` | external material: the challenge brief, Gloo/YouVersion API docs, prior art |
| `docs/notes/` | working scratch: meeting notes, debugging trails |
| `Data/` | datasets + provenance. **Gitignored — see below.** |

`docs/README.md` has the full conventions. When in doubt between `research/` and
`notes/`: research came from outside and stays useful, notes are what you thought
while working.

**`Data/` is gitignored and local to the operator's machine.** Consequences every
agent must respect:

- The datasets have **no remote backup**. Never delete or overwrite anything
  under `Data/` destructively — move it, or ask the operator first. There is
  nothing to recover it from.
- A fresh clone, a cloud agent, or a teammate will **not** have `Data/`. Never
  assume a path under it exists; check first, and fail loudly rather than
  silently skipping.
- `docs/` is tracked and pushed normally — it is safe to reference publicly.

## 3. Mandatory Quality Gates

> **NOT YET ACTIVE.** No application source exists, so there is nothing to test,
> build, or lint. These gates activate with the first PRD that adds code, and
> that PRD must fill in the commands below as part of its own scope.

Once active, code is not "done" until ALL pass:

1. **Tests green:** `TBD — set with the first code PRD`
2. **Coverage:** global `> TBD%`
3. **Build:** `TBD — set with the first code PRD` succeeds.
4. **Lint:** `TBD — set with the first code PRD` clean.

Until then, a PRD is done when its acceptance criteria are met and the operator
confirms. **Do not invent gate commands** and do not report a build or test pass
that did not happen.

## 4. PRD Lifecycle

1. **Draft:** create `docs/prds/NN_short_name.md`. Implementation needs approval.
2. **Branch:** create a feature branch off latest `main`. **Never** push to `main`.
3. **Test-first:** write failing tests for the PRD's acceptance criteria.
4. **Implement:** make them pass.
5. **Verify:** run the full suite + build + lint (section 3).
6. **Finalize:** move the PRD to `docs/prds/completed/`.
7. **PR:** push the branch and open a PR — only after explicit operator approval.

## 5. Conventions

- **Commits:** natural-language summary, prefixed with the PRD number
  (e.g. "PRD-03: add login form"). No conventional-commit prefixes.
- **No AI attribution in commits.** Do not add `Co-Authored-By: Claude` or any
  similar trailer. The operator adds disclosure himself.
- **Scripture references:** the curated datasets use YouVersion/USFM book codes
  (`DAN`, `GEN`, `MAT`). Match that convention in code; do not introduce a
  second reference format without an ADR.
- **Data provenance:** any new dataset gets a `sources.md` alongside it,
  recording origin, licence, retrieval date, and how to reproduce the extraction.
  Follow the pattern in `Data/DanielCREFs/sources.md`.

## 6. Agent Constraints

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
  This includes deleting anything under `Data/`, which is unbacked.
- **NEVER** build or run Docker images. Make the fix, hand it to the operator.
- **Stop on blocked workflows:** if a tool needs interactive input or is blocked,
  do NOT hack around it. Stop, explain, and ask for guidance.

## 7. Definition of Done

Once section 3 is active, success for any PRD is strictly bound to those Quality
Gates. Do not signal completion until every gate is met. Report failures with
the actual output; never describe an unrun check as passing.
