# GlooYouVersionChallenge — Project & Agent Ruleset

This document is binding for all AI agents working in this repo. The PRD loop and
its workers read it on every task.

## 1. Project Overview

Tyndale Digital Product's entry for the **Scripture in New Frontiers** challenge
run by Gloo and YouVersion (summer 2026). The project is a Scripture engagement
game built around the book of Daniel, using a curated set of cross-references to
connect scenes in the text to the wider biblical canon.

- **Language:** TypeScript, `strict: true`.
- **Framework:** Phaser 4 (arcade build) renders the tiled world. React 19
  renders every piece of readable text, as a DOM overlay that is a *sibling* of
  the canvas, not inside it. Vite 8 builds and serves.
- **Package manager / runner:** pnpm.
- **Testing:** Vitest for unit tests (node environment), Playwright for a browser
  smoke test.
- **Hosting:** Vercel. Static SPA plus two thin serverless routes. No database.
- **Environment wrapper:** none

Recorded in [ADR-0002](./docs/decisions/0002-frontend-and-runtime-stack.md),
which is the source of truth for **why** each choice was made and what was
rejected. Read it before proposing a change to any of them.

Three rules from that ADR are binding on day-to-day work and are easy to violate
by accident:

1. **Phaser never renders readable text.** Scripture, dialogue, and AI replies
   are real DOM so they stay selectable, screen-readable, and zoomable. Do not
   draw text into the canvas and do not use Phaser `DOMElement` game objects.
2. **`src/core/` imports neither Phaser nor React.** All game rules and all
   persisted state live there in pure TypeScript so they are testable in node.
   An automated import-graph test enforces this.
3. **React renders discrete narrative state only.** Per-frame state (position,
   animation frame, camera) never crosses into React.

> **ADR-0002 is still `Proposed`.** PRD-02 implements it. Until PRD-02 lands
> there is no `package.json`, so the commands in §3 do not exist yet. See §3.

## 2. Repository layout

| Path | What goes here |
|---|---|
| `AGENTS.md` | this ruleset — the single source of truth for agents |
| `CLAUDE.md` | pointer to this file; do not duplicate rules there |
| `README.md` | human-facing project summary |
| `THIRD_PARTY.md` | upstream provenance and licence terms. **Created by PRD-02; does not exist yet.** |
| `docs/prds/` | PRDs, numbered `NN_short_name.md`; `completed/` holds finished ones |
| `docs/decisions/` | ADRs, `NNNN-short-title.md`. **Human-authored — see §6.** |
| `docs/research/` | external material: the challenge brief, Gloo/YouVersion API docs, prior art |
| `docs/notes/` | working scratch: meeting notes, debugging trails |
| `Data/` | upstream and machine-derived datasets. Tracked. See below. |
| `content/` | authored game content. Tracked. Created by PRD-02. See below. |
| `art/` | art masters (`.aseprite`, Tiled/LDtk projects) + `sources.md`. Created by PRD-02. |
| `public/assets/` | runtime assets exactly as Phaser loads them by URL. Created by PRD-02. |
| `src/core/` | pure TypeScript game rules and persisted state. No Phaser, no React. |

`docs/README.md` has the full conventions. When in doubt between `research/` and
`notes/`: research came from outside and stays useful, notes are what you thought
while working.

### `Data/` versus `content/`

Everything in this repository is **tracked**, including `Data/`. A fresh clone
gets all of it. (Earlier versions of this file claimed `Data/` was gitignored and
absent from clones. That was never true; `git ls-files` shows it committed.)

The split between the two directories is about **reproducibility**, not about
what is in git:

- **`Data/`** holds material that could be regenerated if the operator's machine
  died: the raw upstream dataset (re-downloadable) and normalized intermediates
  (their transform is documented step by step in
  `Data/DanielCREFs/normalized/README.md`).
- **`content/`** holds authored work that could **not** be regenerated: the
  curated cross-references and their notes, scene dialogue, and the six guide
  personas with their prompt templates.

The test when adding a file: *could I reproduce this from a documented process?*
If yes it is `Data/`. If it is original writing it is `content/`.

Consequences every agent must respect:

- **Only `content/` and `public/assets/` may be read at runtime or at build
  time.** A Vercel build must succeed from a clean clone, and nothing in the
  shipped application may import from `Data/`.
- Never delete or overwrite anything under `Data/` or `content/` destructively.
  Move it, or ask the operator first.
- Moving curated material between these directories uses `git mv`, never a copy
  followed by a delete, so history survives.
- `docs/` is tracked and pushed normally, so it is safe to reference publicly.

### Scripture text

Bible text for a modern copyrighted translation is **never** vendored into this
repository. It is fetched from the YouVersion Platform API at runtime. The one
bundled translation is the World English Bible, which is public domain and
therefore redistributable under GPL-3.0; it exists as the offline fallback and as
the default so that degrading offline causes no visible translation switch.

## 3. Mandatory Quality Gates

> **PENDING, not yet runnable.** The commands are settled (below) but no
> `package.json` exists yet, so none of them execute. **Activation trigger:**
> PRD-02 creates `package.json` and wires these five scripts. From the moment
> that PRD merges, these gates are mandatory and this notice must be deleted.
>
> Until then, a PRD is done when its acceptance criteria are met and the operator
> confirms. Do not report a build, test, or lint pass that did not happen, and do
> not substitute a different command because these do not run yet.

Once active, code is not "done" until ALL pass:

1. **Tests green:** `pnpm test` (`vitest run`)
2. **Coverage:** `pnpm test:coverage`. **`src/core/**` must be ≥ 90% and is
   gated.** Global coverage is reported but not gated.
3. **Build:** `pnpm build` (`tsc --noEmit && vite build`) succeeds.
4. **Lint:** `pnpm lint` (`biome check .`) clean.
5. **Smoke:** `pnpm e2e` (Playwright: the game boots, the overlay renders, no
   console errors).

**Why coverage is scoped rather than global.** Roughly half this codebase is
Phaser scene code and React glue that needs WebGL or a DOM to exercise. A global
threshold over that buys ceremonial tests that assert nothing, or a permanently
red build. So the gate sits on `src/core/`, which is pure TypeScript where every
game rule lives and where tests are cheap and meaningful. This is deliberate; it
is not a lowered bar. If reaching 90% in `src/core/` ever requires tests that
assert nothing, that is a signal something belongs in an adapter, **not** a
signal to lower the number.

**Do not invent gate commands.** If a command above does not work, stop and
report it rather than substituting your own.

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
  second reference format without an ADR. Parse and validate with
  `@youversion/usfm-references` rather than hand-rolling a parser.
- **Data provenance:** any new dataset gets a `sources.md` alongside it,
  recording origin, licence, retrieval date, and how to reproduce the extraction.
  Follow the pattern in `Data/DanielCREFs/sources.md`.
- **Asset provenance:** the same rule covers art and audio. Every third-party
  asset gets a row in `art/sources.md` recording origin, author, licence, URL,
  and retrieval date. **Do not add an asset whose licence you cannot name.**
  CC-BY-SA and some OpenGameArt licences do not combine cleanly with GPL-3.0, so
  an unlicensed-in-practice asset is a release blocker, not a detail.
- **Secrets:** exactly one credential is safe in the browser bundle, the
  YouVersion `app_key`, which is a public OAuth client identifier sent as the
  `X-YVP-App-Key` header. Everything else, the Gloo AI Studio key above all, is
  server-side only and lives in a Vercel environment variable read by an `/api`
  route. Never import a secret into anything under `src/`, and never commit one.
- **Accessibility is a gate, not a polish item.** Scripture and dialogue are real
  DOM text. New UI keeps keyboard operability, visible focus, and correct dialog
  semantics; use `react-aria-components` primitives rather than reimplementing
  focus traps or live regions.

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
