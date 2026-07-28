# Verse & Vale: Daniel 1 Experience PRD

### TL;DR

Verse & Vale is a 2D pixel-art narrative web game designed for the “Scripture in New Frontiers” hackathon. Players journey through Daniel 1, progressing via story-driven map exploration, engaging Scripture scenes, and optional persona-driven AI biblical cross-references—blending interactive discovery and storytelling with deep scriptural insights. The MVP targets a public, demo-ready, open-source launch that demonstrates technical and theological excellence.

## Goals

### Business Goals

- Launch a public, playable Daniel 1 demo web app ahead of the July 2026 hackathon deadline
- Deliver a compelling 3-minute video pitch highlighting vision, gameplay, and impact
- Demonstrate creative and technical proficiency using open-source code, art, and narrative assets
- Collect player feedback and analytics to inform possible future expansions

### User Goals

- Experience Daniel 1 as an immersive, narrative-driven journey
- Explore and engage with cross-scriptural insights optionally, at their own pace
- Save highlights and progression to YouVersion (with clear opt-in upsell)
- Enjoy a seamless game-centric, not study-centric, biblical experience

### Non-Goals

- No skill gates. Nothing a player does inside a cross-reference encounter can block progress, deduct stones, or fail them. Side content is always skippable.
- No trivia. Encounters ask which connections matter most, which is a judgment call, not a recall test on Bible facts. Cross-reference encounters use a capped card selection; why that is not the quiz this rules out is in [ADR-0003](../decisions/0003-card-selection-encounters.md).
- Not intended as a digital workbook or study guide
- No support for multiplayer or books outside Daniel 1 in the MVP

## User Stories

**Core Player (Spiritually Curious Explorer):**

- As a player, I want to travel through Daniel 1’s story map, so that I can discover Scripture in a new, interactive way.
- As a player, I want to choose whether to interact with AI guides, so that I explore biblical connections only when interested.
- As a player, I want my highlights and progress to optionally sync with YouVersion, so that my spiritual journey persists beyond the game.

**Returning User:**

- As a returning user, I want to pick up where I left off, so that I’m not forced to replay discovered scenes.

**Power User (Bible Enthusiast):**

- As a power user, I want to explore deeper cross-references and optional content, so that I can gain expanded insight and earn more in-game rewards.

## Functional Requirements

- **Core Gameplay & Progression (Priority: Critical):**
  - Fog-of-war map reveals as story advances
  - Required sequential narrative scenes (Daniel 1:1–21) delivered via dialogue and interaction
  - Save progress and highlights locally, with YouVersion sync if opted in
- **AI Cross-Reference Guides (Priority: High):**
  - Optional AI NPCs representing major biblical themes
  - Reward curiosity via “Vale Stones” for correct/meaningful connections
  - All side content skippable—never blocks main progression
- **YouVersion Integration (Priority: High):**
  - Scripture cards display in narrative/AI dialogue
  - Save highlights/verses to YouVersion with color-coded in-game highlights
  - Optional login with upsell benefits but never required for play
- **Vale Stone Currency (Priority: Medium):**
  - Earned for scriptural insight and milestones
  - Used to unlock bonus content or alternative narrative paths
- **Open Source & Compliance (Priority: Essential):**
  - All code, data, art, and dialogue public (GPL-3.0)
  - Public GitHub repo for assets, code, and tracking progress

## User Experience

**Entry Point & First-Time User Experience**

- User accesses Verse & Vale via public web URL; no install needed
- Immediately dropped into the Daniel 1 map—onboarding is narrative context + movement tutorial (overlay, unobtrusive tips)
- Upsell for YouVersion sync shown at start and when highlight/save features accessed

**Core Experience**

- **Step 1:** Player moves through fog-of-war map; encounters first narrative event (Daniel 1:1)
  - Minimal UI friction, focus on immersion
  - Error handling for API/sync failures with retry prompts
- **Step 2:** Dialogue and interaction present narrative chunks; Scripture cards appear inline
- **Step 3:** Optional engagement with cross-reference AI guide(s)
  - Users can opt-in or skip at each encounter
  - Simple, inviting UI for guide personas
- **Step 4:** Progress and highlights save locally and optionally to YouVersion
- **Step 5:** Vale Stones earned at key milestones and for cross-ref insights
- **Step 6:** Map unlocks the next story area, repeat through all scenes until completed

**Advanced Features & Edge Cases**

- Players can entirely skip side/AI content without penalty
- If APIs are unavailable, offline/local-only fallback is shown
- Progress auto-saves each scene/step; failed saves provide a retry option

**UI/UX Highlights**

- Accessible contrast and readable font sizes throughout
- Responsive layout for mobile and desktop
- Persona-driven, approachable design for AI guides (no academic language)
- Onboarding and upsells are non-intrusive, always skippable

## Narrative

Verse & Vale follows a spiritually curious player who, tired of conventional approaches, desires to immerse themselves in Scripture through meaningful discovery. Entering a pixelated world, they traverse Daniel 1’s landscape—experiencing moments of tension, challenge, and revelation, revealed chunk by chunk. Along the way, wise and welcoming AI guides point out resonant passages throughout the Bible. Players choose which threads to follow, sometimes earning Vale Stones for their insight. By game’s end, even those least interested in “Bible study” find their curiosity and faith deepened, with story, scripture, and personal reflection intersecting in new ways—and all progress ready to revisit in YouVersion or future in-game journeys.

[https://docs.superhuman.com/d/_da-oOwXGSt_/_suAAow_C](https://docs.superhuman.com/d/_da-oOwXGSt_/_suAAow_C)
[[scenes and cross refrences]]

## Success Metrics

This project has two goals: produce a game that is fun, and build hands-on
familiarity with the YouVersion Platform API and Gloo AI Studio. It is not
optimising for judge scores, concurrent-user ceilings, or repository popularity.
The reasoning is in [ADR-0003](../decisions/0003-card-selection-encounters.md);
the earlier judge-and-adoption metrics were replaced with the list below.

### Did we build something fun?

- Playtesters reach the end of Daniel 1 without being prompted to keep going
- Players open cross-reference encounters even though they are optional
- Players can name something the reveal taught them that they did not already know
- Card selection reads as a judgment call rather than a guess

### Did we learn the platforms?

- Scripture cards render from the live YouVersion Platform API, not only from the bundled WEB fallback
- OAuth sign-in and highlight sync work end to end at least once against the real API
- Card generation runs against Gloo inside the shipped product, with schema validation and the fallback path both exercised
- The calibration pass over all 24 encounters has been read by a human and the distractor rule holds

### Health checks, not targets

Watched so failures are visible. None of these is a number to push up.

- Gloo generation: schema-violation rate, retry rate, fallback rate
- YouVersion: request success and error rates
- Save loads: no corrupt or white-screening restores after a schema migration

### Tracking Plan

- Player session and scene-completion events
- Scripture card displays, and whether the read gate was satisfied before selection unlocked
- Vale Stone earning and spending, by cause
- YouVersion login and highlight actions
- Encounter starts, locked selections, and cards left unselected

## Technical Considerations

### Technical Needs

- Web app: responsive for mobile/desktop; no installation
- Core components: map engine, dialogue UI, AI guide integration, API handling
- Public GitHub repository for all code/assets

### Integration Points

- YouVersion Platform API (scripture cards, login, highlights)
- Gloo AI Studio API (server-side generation of insight cards, one structured call per encounter)

### Data Storage & Privacy

- Player progress/highlights stored locally and optionally synced to YouVersion
- No sensitive data required; all data flows are privacy-first, transparent, and opt-in where persistent info is needed
- Open license compliance for all asset/data use

### Scalability & Performance

- No concurrent-user target. The deploy is a static bundle plus two stateless routes on Vercel, which scales without our help, and load is not something this project is trying to prove
- API fallback and local cache for robustness

### Potential Challenges

- Integration with two novel APIs (YouVersion, Gloo AI) and guardrails for AI NPCs
- Balancing narrative flow with openness to exploration
- Deadline-driven: nonessential features must be cuttable if schedule slips

## Milestones & Sequencing

### Project Estimate

Rationale: With a 9-day hard deadline and a zero-build start, we must compress scope to a tight, delivery-first MVP. Nonessential features (advanced art, extended cross-reference depth, multiplayer, extensive testing) are deprioritized or pushed to stretch goals. The plan below combines phases and specifies only critical deliverables and minimal durations to maximize the chance of a demo-ready submission.

Urgent: 9 days total from zero build (condensed, delivery-first timeline).

### Team Size & Composition

Minimal Team: 1 full-stack engineer (lead), 1 designer/2D artist (shared UI + essential assets), 1 product/game lead (narrative + integration). Optional contributor: dedicated QA/playtester if available. Roles overlap; keep coordination lean.

### Suggested Phases

Phase A (Days 1–3): Core Gameplay & Map Scaffold (1–3 days)

- Critical deliverable: Fog-of-war map scaffold, player movement, one locked sequence of Daniel 1 scenes, dialogue UI for scripted events.
- In-scope: minimal tileset and placeholder art, basic scene transitions, local save of progression.
- Out-of-scope: polish art, optional side content, full animation—deferred to stretch goals.

Phase B (Days 3–5): Scripture Cards & YouVersion Integration (1–2 days)

- Critical deliverable: Inline scripture card rendering and YouVersion highlight/save integration (basic auth flow or mocked OAuth if strict time limits require).
- In-scope: display of scripture cards in dialogue, one-way save highlight to YouVersion or recorded mock endpoint for demo if API access is delayed.

Phase C (Days 5–7): AI Guides (1–2 days)

- Critical deliverable: One optional AI guide persona integrated with a simple prompt template to provide cross-reference suggestions; lightweight guardrails and opt-out option.
- In-scope: curated prompts, minimal card-selection and reveal UI, demonstration of Vale Stone reward on meaningful interaction.
- Out-of-scope: multi-persona system, deep theological validation—deferred.

Phase D (Days 7–8): Polish, UX, and Performance (1–2 days)

- Critical deliverable: Fix major UX friction, ensure save/retry flows, accessibility basics, responsive layout, and stable demo build for judges.
- In-scope: audio and art polish limited to highest-impact assets, bug fixes, deploy pipeline to public URL.

Phase E (Day 9): Video & Final Submission (1 day)

- Critical deliverable: 2–3 minute demo video and submission bundle (GitHub repo, playable demo link, brief README).
- In-scope: scripted walkthrough capture, highlight key features (map progression, scripture card, AI guide, Vale Stone reward), and upload artifacts.

Scope Management: For each phase, freeze scope early—if any task risks late delivery, move it to a named stretch goal. Stretch goals include additional AI personas, deeper cross-reference datasets, advanced art/animation, multiplayer, and extended YouVersion features.

Summary Timeline (example): Day 1–3 Core gameplay; Day 3–5 YouVersion & scripture cards; Day 5–7 AI guide integration; Day 7–8 Polish & deploy; Day 9 Video & submit. Team stays intentionally small and focused to minimize coordination overhead and accelerate iteration.

## Vale Stones: Theme & Currency

Vale Stones are the game’s narrative-themed currency, awarded for key scriptural insights and milestones. They unlock bonus content and side paths, never block core progress, and reinforce curiosity-driven exploration.