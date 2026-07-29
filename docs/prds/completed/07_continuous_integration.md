# PRD-07: Continuous integration

## Goal

Run the five mandatory quality gates in `AGENTS.md` §4 on every push and every
pull request, and make `main` refuse a merge that fails them.

Not part of the game. This is the only PRD in the current set that ships no
player-facing behaviour, which is why it is separated from PRD-06 rather than
bundled into it.

## Why this is worth a PRD

Every gate result claimed in every PR so far has been produced on one machine, by
hand. `AGENTS.md` §8 binds "done" to those five gates, and §4 forbids inventing
gate commands, but nothing currently enforces either. The gates are good and they
genuinely pass; the problem is that nobody can verify that without checking out
the branch.

`main` also has **no branch protection at all** today. The GitHub API returns 404
for it, so a failing branch can be merged, and force-pushes to `main` are
technically possible despite `AGENTS.md` §7 forbidding them.

## Prerequisites

- PR #3 merged. Deliberately after, so CI lands on a `main` that already passes
  and the first run is green rather than a wall of pre-existing findings.

## Acceptance criteria

### The workflow

- [ ] A GitHub Actions workflow runs on pull requests targeting `main` and on
      pushes to `main`. `.github/` does not exist yet, so this creates it.
- [ ] No `paths` or `paths-ignore` filters on either trigger. Every commit runs
      every gate. See Notes for why, including the `Data/` case that looks
      skippable and the required-check-never-reports trap that rules it out.
- [ ] All five gates run, using the **exact** package scripts, with no
      reimplementation of what they do: `pnpm test`, `pnpm test:coverage`,
      `pnpm build`, `pnpm lint`, `pnpm e2e`.
- [ ] The coverage gate's own exit code is what passes or fails the step. The
      threshold lives in `vitest.config.ts` (`src/core/**` at 90% across all four
      metrics) and must not be duplicated into the workflow, where it would drift.
- [ ] pnpm is pinned to the `packageManager` field, currently `pnpm@10.28.0`, and
      Node satisfies `engines.node`, currently `>=20.19.0`. Pin an explicit Node
      version rather than `latest`, so a Node release cannot turn a green branch
      red on its own.
- [ ] `pnpm install --frozen-lockfile`, so a lockfile that disagrees with
      `package.json` fails rather than silently resolving.
- [ ] Playwright browsers are installed with the version the lockfile resolves,
      via `pnpm exec playwright install --with-deps chromium`. Only chromium is
      configured in `playwright.config.ts`.
- [ ] The e2e step lets Playwright start its own server, as configured
      (`webServer` running `vite --port=4173 --strictPort`). Do not add a second
      server start in the workflow.
- [ ] The pnpm store and the Playwright browser cache are cached, keyed on the
      lockfile. Installing a browser on every run is most of the wall clock.
- [ ] On failure, the Playwright report and any traces upload as artifacts, so a
      red run is diagnosable without reproducing locally.
- [ ] No secrets are required. All five gates run against stubs and committed
      fallback content, and nothing in them calls Gloo or YouVersion. If that ever
      stops being true, the gate that needs a secret is the wrong gate.

### Branch protection

**Deferred 2026-07-29.** Setting these requires repo **admin**; the operator
only has `maintain` on this repo, and getting admin granted was not going to
happen inside this project's time limit. Rather than block PR #7 (and every
PR after it) on an access request, the operator is merging #7 with these
criteria unmet and will configure protection later if/when admin access comes
through. Until then, `main` has no technical enforcement of any of the three
items below — the workflow runs and reports on every push/PR, but nothing
stops a merge on red, a force-push, or a deletion. `AGENTS.md` §7's rule
against force-pushing or rewriting history is a standing instruction to
agents working in this repo, not a GitHub-enforced control, and remains the
only thing covering that gap in the meantime.

- [ ] `main` requires the workflow to pass before merge.
- [ ] `main` blocks force-pushes and deletion, matching what `AGENTS.md` §7
      already says agents must never do.
- [ ] `main` does **not** require pull-request approvals. Decided 2026-07-28: the
      status check is the gate, reviews are not. GitHub will not let you approve
      your own PR, so on a solo repo requiring an approval means bypassing the
      rule on every merge, and a routinely bypassed rule stops meaning anything.
      Revisit when there is a second maintainer.

### Honesty

- [ ] The workflow does not use `continue-on-error` on any gate, and no step is
      allowed to report success on a skipped run.
- [ ] A red build is red. No gate is downgraded to a warning to get the first run
      green; if something fails, fix it or say so in the PR.

## Out of scope

- **Deploy to Vercel.** Vercel's own GitHub integration already builds previews
  from pushes, and duplicating that here would mean two build pipelines to keep
  in sync. If deploys should be gated on this workflow, that is a Vercel project
  setting rather than a workflow step.
- **Coverage reporting to a third-party service.** The v8 text reporter and the
  gated threshold are enough; adding an external service means an account, a
  token, and a second place for the number to live.
- **Matrix builds across Node versions or browsers.** One Node version and
  chromium. `playwright.config.ts` configures only chromium, and a matrix would
  triple the run time to test something nobody has asked for.
- **Dependency update automation.** Separate concern, separate PRD if wanted.
- **Anything player-facing.** PRD-05 and PRD-06.

## Notes

Where the rules come from:

- The five gates and the rule against inventing gate commands: `AGENTS.md` §4.
- Done being strictly bound to those gates, and never reporting an unrun check as
  passing: `AGENTS.md` §8.
- Never force-pushing or rewriting history on a shared org repo:
  `AGENTS.md` §7.
- `src/core/**` gated at 90% while global coverage is reported only, and the
  reasoning for that split: ADR-0002, echoed in the comment in
  `vitest.config.ts`.

**Why no path filters** (decided 2026-07-28). The two directories that looked
skippable are not the same case:

- `content/` is compiled into the app. `src/app/runtime.ts` imports
  `characters.json`, `daniel-1.dialogue.json`, and `daniel-1.refs.json` directly;
  `src/content/loadContent.test.ts` and `src/content/cast.test.ts` import them
  too; `e2e/vertical-slice.spec.ts` reads the dialogue file; and
  `src/content/schema.ts` validates them. A change there can break build, unit
  tests, and e2e. It is exactly the edit that looks like "just data" and is not.
- `Data/` has no references anywhere in the source. A commit touching only
  `Data/DanielCREFs` would run all five gates against a tree the app sees as
  identical to `main`.

So filtering `Data/` would genuinely save time, and it is still not worth it. With
`paths-ignore` on a `pull_request` trigger, an excluded commit means the workflow
does not run, so a *required* status check never reports, and GitHub holds that as
pending rather than passing. The PR becomes unmergeable instead of fast. The usual
fix is a duplicate job with the same check name reporting success on filtered
paths, which is two jobs to keep in sync plus a check name that can lie, to save a
few minutes on a directory that is rarely touched.

If dataset commits ever do get noisy, use `[skip ci]` in the commit message.
Actions honours it natively, and it is visible in the history rather than hidden
in workflow config.

One expectation to set: the first run will likely fail once on something
environmental rather than on the code, usually a Playwright system dependency or
a Node version difference. The gates all pass locally as of 2026-07-28 (175 unit
tests, 8 e2e, coverage exit 0, clean build and lint), so a red first run is a
workflow bug to fix in the workflow, not a signal to weaken a gate.
