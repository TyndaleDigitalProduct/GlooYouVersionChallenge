# 0002. Frontend and runtime stack

Date: 2026-07-27

## Status

Accepted, 2026-07-27. **Partly superseded by
[ADR-0003](./0003-card-selection-encounters.md), 2026-07-28**, which replaces
three things below: the section "Rewards: two-tier, never punitive", the section
"AI guides: grounded in our own notes", and the streaming justification inside
"Hosting: Vercel, static SPA plus two serverless routes". Everything else in
this ADR still stands. This note is the only edit made after acceptance, and it
is the one ADR-0001 requires.

Accepted by the operator as written. The decisions below are binding: they are
the authority for `AGENTS.md` §1 and §3, and PRD-02 implements them.

Two notes on how this document came to be, kept because they matter to anyone
reading the decision history. It was drafted by an agent at the operator's
explicit request, waiving the agents-do-not-write-ADRs rule in ADR-0001 and
`AGENTS.md` §7 for this one file; that waiver does not extend to any other ADR.
And per ADR-0001 this ADR is now immutable. A decision that changes here gets a
new ADR that supersedes it, with a note added to both.

## Context

`AGENTS.md` §1 and §3 have carried "NOT YET CHOSEN" and "TBD" since the repo was
scaffolded, and they block the first code PRD. This ADR settles them.

The product we are building (see `docs/notes/Verse & Vale - Daniel 1 Experience
PRD.md`) is a 2D pixel-art web game covering Daniel 1 in nine narrative scenes,
with twenty-four curated cross-references delivered by six AI guide personas, and
optional YouVersion sign-in for saving highlights.

Two properties of that product drive almost every choice below:

1. **By volume, it is a text application.** Dialogue, Scripture passages, an AI
   chat, and a currency readout. The free-roaming tile world is real but is a
   minority of the work.
2. **It is a Scripture engagement product from a Bible publisher.** Scripture
   text must be selectable, screen-readable, zoomable, and translatable by
   assistive technology. Theological claims must be traceable to vetted content.

A third constraint is procedural: `AGENTS.md` §4 mandates test-first development.
Any architecture that puts game rules somewhere untestable is in conflict with
the ruleset, not merely inconvenient.

## Decision

### Rendering: a game engine for the world, the DOM for everything readable

The player moves freely across a tiled map with collision, camera follow, and
zone triggers. That is engine work and we do not hand-roll it.

We use **Phaser 4.2.x**, the arcade build (313 KB gzipped, excluding Matter
physics, which we do not use). Not Phaser 3: 3.90.0 shipped 2025-05-23 and is the
final v3 release, so choosing it would mean starting a new public repository on a
dead major version. The v3 to v4 breaking changes concentrate in custom render
pipelines, masks, shaders, and Spine, none of which we touch. Phaser 4 also ships
twenty-eight agent skill documents (about 13,600 lines) inside the npm package,
which makes it a materially more reliable target for AI-assisted development than
a version whose documentation exists only in ten-year-old blog posts.

**Phaser renders no readable text.** The canvas and a DOM overlay are siblings,
communicating over a typed event bus:

```
#app
├── #game-container   Phaser only. Scale.FIT + CENTER_BOTH.
│   └── <canvas>      world, avatar, NPCs, fog
└── #ui-layer         React only. position:absolute; inset:0
    ├── DialogueBox   real <p>, selectable
    ├── ScriptureCard real <p>, screen-readable, zoomable
    ├── GuideChat     real <input>, mobile keyboard + IME work
    └── ValeStones
```

We rejected rendering UI inside the canvas, and we rejected Phaser's
`DOMElement` game objects (which survive in v4). Both put text inside a
Phaser-scaled, CSS-transformed container, which produces non-integer text
scaling, makes media queries inert, and orders the accessibility tree by display
list rather than reading order. No amount of later effort fixes that; it is an
architectural ceiling, so it is decided here rather than deferred.

### UI layer: React 19 and TypeScript

The overlay is **React 19 with TypeScript**. The deciding factor is not
familiarity but accessibility primitives: the hard part of the promise above is
focus traps, correct dialog semantics, and ARIA live regions for streaming AI
text, and `react-aria-components` solves those correctly. Two secondary reasons:
YouVersion publishes official React packages (below), and React has the widest
contributor pool for an open-source entry.

Svelte's bundle advantage was considered and rejected as immaterial: roughly 45 KB
against 313 KB of engine plus tilesets and character art.

**Discipline rule:** React renders discrete narrative state only. Per-frame state
(position, animation frame, camera) never crosses into React.

### State: an engine-agnostic core

All persisted state and every game rule live in `src/core/`, which imports
neither Phaser nor React. Phaser and React are both adapters onto it.

- `zustand/vanilla` for the store, because the same store is readable from a
  Phaser scene and from React via `useSyncExternalStore`.
- `zod` for the save schema, so a stale or corrupt `localStorage` blob migrates
  or is rejected cleanly instead of white-screening the game.

This follows directly from the test-first mandate. A Phaser scene needs WebGL, a
canvas, and a running game loop to exercise; a pure reducer needs nothing. Putting
rules in Phaser's `DataManager` (the idiomatic-Phaser answer) would make "is
scene 4 unlocked?" untestable without booting a browser. Coverage is therefore
gated where it is meaningful: `src/core/**` at 90%, with global coverage reported
but not gated, because a global gate over canvas and DOM glue buys ceremonial
tests rather than confidence.

### Hosting: Vercel, static SPA plus two serverless routes

Gloo AI Studio is OpenAI-compatible, which means an API key, which means a
secret, which means a server. This is forced, not preferred.

The server tier is deliberately tiny and stateless: one route streaming Gloo
completions, one route for the YouVersion token exchange. **No database.**
Progress lives in `localStorage` and optionally syncs to YouVersion.

**Vercel** hosts both the static Vite bundle and the `/api` routes: one deploy
target, a Node runtime so the OpenAI-compatible SDK works untouched, and
first-class response streaming for the AI guide.

### Content: `Data/` is upstream, `content/` is authored

`Data/` holds material that could be regenerated if this laptop died: the raw
upstream dataset (re-downloadable) and the normalized intermediate (its transform
is documented step by step in `Data/DanielCREFs/normalized/README.md`).

`content/` is tracked, authored game content that could not be regenerated: the
curated cross-references and their notes, the scene dialogue, the six guide
personas and their prompt templates.

The test is "could I reproduce this from a documented process?" If yes it is data;
if it is original writing it is content. A build on Vercel must work from a clean
clone, which is a second reason runtime content cannot live behind a path that
was documented as machine-local.

Note: `AGENTS.md` §2, `README.md`, and a `.gitattributes` comment all currently
state that `Data/` is gitignored. It is not; it is tracked and committed.
PRD-02 corrects that drift.

### Scripture text: YouVersion first, bundled public-domain fallback

Passages come from the **YouVersion Platform API** (launched April 2026), using
`format=text`, with `app_key` sent as `X-YVP-App-Key`. `app_key` is a public
OAuth client identifier and is safe in the browser bundle. Sign-in is OAuth 2.0
with PKCE and no client secret.

We use the official typed packages rather than hand-rolling a client:
`@youversion/platform-core`, `@youversion/platform-react-hooks`, and
`@youversion/usfm-references` for parsing the USFM references that `AGENTS.md` §5
mandates.

We **also bundle the World English Bible text** for the roughly 200 verses the
game touches (Daniel 1 plus the twenty-four cross-referenced passages). WEB is
public domain, so redistributing it is compatible with GPL-3.0, unlike any modern
copyrighted translation.

WEB is the default translation on **both** paths, so degrading to offline causes
no visible translation switch. This keeps the product PRD's offline-fallback
promise honest (it is otherwise unkeepable, since Scripture text cannot legally be
vendored for a copyrighted translation), and it unblocks all development before
YouVersion credentials exist.

### AI guides: grounded in our own notes

The twenty-four curated notes total about 6.6 KB (mean 276 characters). **There is
no retrieval problem here.** Retrieval is a dictionary lookup by scene and
reference. We do not use embeddings, a vector store, or RAG; doing so would
demonstrate infrastructure rather than Scripture.

Each encounter runs in two phases:

1. **Scored beat, strictly grounded.** The prompt carries the Daniel passage, the
   cross-referenced passage, and our curated note as the authority. The model
   speaks in persona, evaluates the player's proposed connection, and reveals the
   note.
2. **Follow-up, fenced.** Genuine curiosity is allowed, bounded by a turn cap, an
   on-topic constraint, and an instruction to defer rather than speculate about
   anything outside the supplied text.

The reason is not cost or latency. An open-ended model would put unvetted
theological claims under a Bible publisher's name and would make the curation
ornamental. The six personas map exactly onto the `section` field already present
in the curated data: OT History (5 refs), Prophets (5), OT Poetry/Wisdom (5),
Torah (4), Gospels/Acts (3), NT Letters (2).

Transport is the Vercel AI SDK (`ai` with `@ai-sdk/openai-compatible`) pointed at
Gloo's base URL: `streamText` for conversation, `generateObject` with a zod schema
for the verdict.

### Rewards: two-tier, never punitive

The product PRD forbids quizzes ("the focus is narrative, not Bible quizzes") and
simultaneously asks for stones awarded for "correct/meaningful connections". Those
are reconcilable only if insight is *recognized in conversation* rather than
*marked as an answer*, which rules out multiple choice.

Engaging with a cross-reference conversation always earns the base stone. A
recognized insight earns a bonus. Nothing is ever deducted and nothing is ever
gated, so an unlucky model verdict costs a bonus rather than progress, which also
satisfies the requirement that side content never blocks the main path.

### Toolchain

| Gate | Command |
|---|---|
| Tests | `pnpm test` (`vitest run`) |
| Coverage | `pnpm test:coverage`, `src/core/**` ≥ 90% gated, global reported |
| Build | `pnpm build` (`tsc --noEmit && vite build`) |
| Lint | `pnpm lint` (`biome check .`) |
| Smoke | `pnpm e2e` (Playwright: game boots, overlay renders) |

pnpm as package manager. Vitest because Phaser itself tests with Vitest. Biome
rather than ESLint plus Prettier, for one tool and one config.

## Consequences

- `AGENTS.md` §1 and §3 can be filled in, unblocking the first code PRD.
- Scripture text is real, selectable, screen-readable DOM. This is the decision
  that would have been unrecoverable if made the other way.
- Game rules are unit-testable in Node with no browser, satisfying §4 test-first
  rather than fighting it.
- Development is not blocked on YouVersion or Gloo credentials. The bundled WEB
  text and a stubbed guide route cover PRDs 02 through 06.
- Two coordinate systems must be bridged when a UI element anchors to a world
  position (a speech bubble over an NPC). This is the accepted cost of the
  overlay architecture; the camera transform makes it tractable.
- No third-party Phaser plugins. `phaser3-rex-plugins` is the richest v3 plugin
  set and is v4-incompatible, but its main draw is dialogue and UI widgets that
  the DOM overlay makes unnecessary.
- Phaser 4 is WebGL-first (the Canvas renderer is deprecated), which sets a floor
  on very old devices.
- Phaser 4 has been stable only since 2026-04-10, so third-party tutorials are
  thin. Mitigated by the in-package skill documents, which are authoritative.
- Two unresolved licence questions are surfaced, not settled, by this ADR:
  1. The upstream cross-reference dataset is **GPL-2.0** and this repo is
     **GPL-3.0**. GPL-2.0-only is incompatible with GPL-3.0; only
     "or later" can be upgraded. The dataset is already committed.
  2. Third-party art must be licence-checked per asset. CC-BY-SA and some
     OpenGameArt licences do not combine cleanly with GPL-3.0.
  Both belong in `THIRD_PARTY.md`, which is referenced by `AGENTS.md` §2 and
  `README.md` but does not exist.

## Deferred

Not decided here, deliberately, to be settled by the PRD that needs each:

- **Dialogue authoring format** (typed TS modules vs JSON with a zod schema vs
  Ink and `inkjs`). Blocks PRD-04. Note that the main narrative is required and
  sequential, so Ink's branching, its main draw, is largely unused, and its
  runtime would own story state that this ADR assigns to `src/core/`.
- **Map authoring pipeline**, Tiled vs LDtk. Blocks PRD-05.
- **Audio approach.**
