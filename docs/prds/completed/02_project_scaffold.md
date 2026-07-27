# PRD-02: Project scaffold, quality gates, and documentation repair

## Goal

Stand up the application skeleton chosen in ADR-0002 so that every later PRD has
a working build, a real test harness, and enforced quality gates. Fill in the
`AGENTS.md` §1 and §3 placeholders that currently block all code work, and repair
four places where the repository's own documentation contradicts its actual state.

No game behaviour ships in this PRD. The deliverable is a repository in which
PRD-03 can be written test-first.

## Prerequisites

- ADR-0002 reviewed, rewritten in the operator's voice, and status flipped to
  Accepted. This PRD implements that ADR and must not be started while it is
  still Proposed.

## Acceptance criteria

### Test harness proves itself first

- [ ] A Playwright smoke spec exists and **fails** before the app is scaffolded,
      then passes: navigating to the dev server yields a `<canvas>` inside
      `#game-container` and a rendered `#ui-layer`, with no console errors.
- [ ] A Vitest spec exists and **fails** before path aliases are configured, then
      passes: it imports a trivial export through the `@/core` alias.
- [ ] Honest note: a scaffold PRD is mostly configuration, so test-first here is
      thinner than in PRD-03. These two specs are the genuine failing-first
      artifacts. Do not manufacture further ceremonial tests to pad this section.

### Toolchain and build

- [ ] pnpm workspace initialised at the repository root. Single package, no
      monorepo.
- [ ] Vite 8 + React 19 + TypeScript, with `@vitejs/plugin-react`.
- [ ] Phaser 4.2.x installed, importing the **arcade** build. Matter physics is
      never imported.
- [ ] Dependencies pinned to exact versions, not ranges. Record the resolved
      versions in the PR description.
- [ ] TypeScript 7 is the target. Verify it type-checks against Phaser's shipped
      `.d.ts`; if it does not, fall back to TypeScript 5.x and say so in the PR
      rather than working around it.
- [ ] `tsconfig` has `strict: true` and a `@/*` path alias to `src/*`, mirrored in
      the Vite config so both resolve identically.
- [ ] `pnpm build` runs `tsc --noEmit && vite build` and succeeds.
- [ ] `pnpm lint` runs `biome check .` and is clean.
- [ ] `pnpm test` runs `vitest run` and is green.
- [ ] `pnpm test:coverage` enforces **≥ 90% on `src/core/**`** and reports global
      coverage without gating it.
- [ ] `pnpm e2e` runs the Playwright smoke spec.

### Application skeleton

- [ ] The DOM structure from ADR-0002 exists and renders: `#app` containing
      `#game-container` (Phaser's `parent`) and a sibling `#ui-layer`.
- [ ] Phaser boots with `Scale.FIT` + `CENTER_BOTH` into `#game-container` and
      renders a placeholder scene. No tilemap, no player, no gameplay.
- [ ] `#ui-layer` is `position:absolute; inset:0` with `pointer-events:none`, and
      renders one placeholder React component with `pointer-events:auto`.
- [ ] A typed event bus module exists in `src/core/` with at least one event
      defined and a unit test covering subscribe, emit, and unsubscribe. No
      Phaser or React imports.
- [ ] `src/core/` contains no import of `phaser`, `react`, or `react-dom`, and a
      test asserts this architectural invariant by inspecting the import graph.
      This test must be able to fail.
- [ ] Page renders without horizontal scroll at 375px and at 1440px viewport
      widths.

### Repository restructuring

- [ ] `content/` created and tracked. `Data/DanielCREFs/curated/daniel-1.json`
      moved there via `git mv` (preserve history; do not copy and delete) as
      `content/daniel-1.refs.json`.
- [ ] `Data/` retains only the raw upstream dataset, the normalized intermediate,
      `sources.md`, and the curation notes.
- [ ] `art/` created and tracked, with `art/incoming/` for unsorted operator
      drops and `art/sources.md` recording origin, author, licence, URL, and
      retrieval date per third-party asset. The file exists with its table
      headers even while empty.
- [ ] `public/assets/` created with `tiles/`, `maps/`, `sprites/`, and `audio/`
      subdirectories, each holding a `.gitkeep`.
- [ ] `.gitattributes` gains binary entries for `*.aseprite`, `*.ogg`, `*.wav`,
      and text entries for `*.tmx` and `*.ldtk`.

### Documentation

Per the maintenance cadence in `docs/README.md`, **doc prose is a release task,
not part of this PRD.** `AGENTS.md` was already brought current ahead of this PRD.
Only the two items below are in scope, because both are factually false claims
about the repository rather than wording.

- [ ] `.gitattributes`: correct the comment claiming "Data/ is currently
      gitignored — see .gitignore". `Data/` is tracked. Keep the
      `linguist-vendored` rules, which are correct and now actually apply.
- [ ] `art/sources.md` created with its table headers (origin, author, licence,
      URL, retrieval date), even while empty, so no asset can land without a home
      for its provenance.

Deferred to the first release pass, tracked so they are not lost:

- `README.md` carries four false claims (no application code, stack not chosen,
  `Data/` untracked, absent from a fresh clone).
- `THIRD_PARTY.md` does not exist. It is a **release blocker**, not a nicety: it
  must record the GPL-2.0 upstream dataset and state the unresolved GPL-2.0
  versus GPL-3.0 compatibility question. Resolving that question is the
  operator's call, possibly with counsel, and cannot be done by a PRD worker.

### Gates genuinely active

`AGENTS.md` already describes the steady state and needs no editing by this PRD.
What this PRD must do is make that description true.

- [ ] All five commands in `AGENTS.md` §4 run and pass for real. Paste the actual
      output in the PR. This is the last criterion and cannot be ticked from a
      passing build on a dev machine alone.
- [ ] ADR-0002 is `Accepted` before this PRD starts. If it still reads `Proposed`,
      stop and ask; do not edit the ADR yourself (§7).
- [ ] The three architecture invariants in ADR-0002 hold in the scaffold. The
      import-graph test covers `src/core/` purity; the other two are satisfied by
      construction here and must not be broken to make the placeholder scene
      easier.

## Out of scope

- Any gameplay: tilemaps, player movement, collision, fog of war, dialogue.
- Any domain state, save format, or game rules. That is PRD-03.
- Scene or persona content authoring. The curated refs file is **moved**, not
  parsed or typed. That is PRD-04.
- Both API integrations. No YouVersion calls, no Gloo calls, no `/api` routes,
  no credentials. PRDs 07 through 09.
- Art and audio. `art/incoming/` is created but its contents are not processed.
- Deciding the dialogue authoring format or Tiled versus LDtk. Explicitly
  deferred by ADR-0002.
- CI configuration. The gates must run locally via pnpm scripts; wiring them to
  a CI provider is a later PRD.
- Deployment. No Vercel project, no deploy. PRD-10.

## Notes

Key references:

- ADR-0002 is the source of truth for every choice here. If implementation
  reveals that a choice in it is wrong, stop and surface it. Do not silently
  diverge, and do not edit the ADR (it is immutable once accepted; supersede it).
- Phaser 4 ships its own agent skill documents at
  `node_modules/phaser/skills/`, about 13,600 lines across 28 topics. Read
  `game-setup-and-config`, `scale-and-responsive`, and `scenes` for this PRD in
  preference to any external tutorial, which will almost certainly target v3.
- The official templates (`pnpm create @phaserjs/game@latest`) include React with
  Vite in TypeScript. Use it as a reference for the canvas mount and the
  `public/assets/` convention, but do not adopt its structure wholesale: it does
  not use the sibling-overlay architecture or the `src/core/` boundary.

Two gotchas worth knowing before they cost time:

- Assets must live in `public/assets/` rather than being imported from `src/`.
  Vite hashes imported filenames, and Phaser loads by literal string
  (`this.load.image('tiles', 'assets/tiles.png')`), so hashing breaks the loader.
- In Phaser 4, `DynamicTexture` drawing calls (`draw`, `erase`, `fill`, `clear`)
  are buffered and require an explicit `.render()` to flush. This does not matter
  in this PRD but will in PRD-05's fog of war, and it is the single most likely
  place for v3 muscle memory to produce a silently blank texture.

The `src/core/` import-graph test is worth more than it looks. It is the only
mechanical guard on the boundary that makes the whole architecture testable, and
without enforcement it will erode the first time something is convenient.
