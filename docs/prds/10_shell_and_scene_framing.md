# PRD-10: Shell and scene framing

## Goal

How the player gets into the game and how a scene opens and closes. Two things the
storyboard specifies in detail and PRD-04 either built the wrong way or never built:
the home screen with name entry and the intro, and the Lamplighter, who is the only
character who can end a scene and currently does not exist anywhere.

Small, self-contained, and the cheapest visible progress available. Neither
workstream touches `src/core/` rules or the encounter itself.

Supersedes PRD-06 workstreams B and C, unchanged in substance.

## Prerequisites

- [PRD-08](./08_playable_demo.md) phase 1 merged, for two things:
  - The optional player-name field in the v3 save schema, which workstream A fills.
    PRD-08 reserves it and does not read or write it, so no second migration is
    needed. **If PRD-08 phase 1 has already merged without that field, stop treating
    this as settled: workstream A owns `migrateV3ToV4` and says so in the PR.**
  - The `scene-complete` and `all-references` causes and the orchestrator that
    computes the bonus, which workstream B awards. Everything else in workstream B
    can be built and tested without it.
- One shared surface to expect conflicts in, and nowhere else: `runtime.ts`, the
  single composition point.

## Two workstreams

A and B are independent of each other. A is unblocked entirely. B is engine-cheap and
content-blocked, which makes it the one workstream here where the bottleneck is not
this team.

## Workstream A: home screen, name entry, intro

- [ ] Two entry states decided by whether a readable save exists: title, tagline,
      and a single *Enter* action when there is none, Continue plus New game when
      there is one. *Enter* is a button, not the Enter key. Worth saying now that
      PRD-08 phase 4 removes keyboard input.
- [ ] New game over an existing save confirms first, and the confirm says exactly
      what is lost: progress, encounter state, and local highlights. Nothing more.
- [ ] Name entry is **required**. The player cannot continue without entering one,
      because every `{name}` line in the dialogue works unconditionally and no
      fallback form of address has been written.
- [ ] The name is substituted into dialogue wherever `{name}` appears.
- [ ] The intro is skippable and reopenable, so a returning player is not trapped
      in it and a curious one can find it again. `storyboard-v2.md` §3 puts the way
      back behind the HUD menu, which means this workstream creates that menu. Note
      that an editable name (surfacing decision 1 below) would live on the same
      surface, so building it once covers both.
- [ ] The optional YouVersion sign-in offer appears here, and declining is a
      first-class path to the full game rather than a dead end. The provider it
      calls belongs to [PRD-09](./09_challenge_integrations.md) workstream B; if
      that has not landed, the offer runs against the stub and the UI says so.
- [ ] The name is persisted in the save, filling the optional field PRD-08 phase 1
      reserves. No new migration if that field exists. See Prerequisites.

## Workstream B: the Lamplighter

Currently absent from every content file and every line of code. It is the only
character who can end a scene, so as designed the scene has no exit.

- [ ] A Lamplighter opens every scene with the full passage and closes it.
- [ ] It is **reachable** at scene exit. PRD-04's scene ended when dialogue ran
      out; the storyboard's version requires a character the player can find and
      walk to, and item 8 flags that as written the only character who could end
      the scene was unfindable.
- [ ] Exit copy branches three ways: all encounters engaged, some, none. None of
      the three is punitive about the ones skipped.
- [ ] Completing the scene through the Lamplighter awards the scene-complete
      stones and, where earned, the all-references bonus. **Depends on PRD-08
      phase 1** for those two causes and the orchestrator that computes the bonus.
- [ ] **Blocked on content:** the Lamplighter has no dialogue, no art, and no
      persona definition. The engine work here is small; what it renders does not
      exist. Build against clearly labelled placeholder copy, per the existing
      placeholder policy in `daniel-1.dialogue.json`, and flag it in the PR.

## Out of scope

- **The encounter itself**: cards, Scripture text, the reveal, the read gate, and
  click-to-move. [PRD-08](./08_playable_demo.md).
- **Gloo generation and YouVersion sign-in, sync, and consent.**
  [PRD-09](./09_challenge_integrations.md). The sign-in *offer* on the home screen
  is workstream A's; the provider behind it is not.
- **CI.** PRD-07, complete.
- **Dialogue for scenes 2 through 9**, and authored copy for scene 1. Content.
- **The six designed personas.** Content, and it gates workstream B's Lamplighter
  copy along with the rest of the cast.
- **World art, tilemaps, audio.** Still empty directories.

## Notes

Where the rules come from:

- Two entry states: `storyboard-v2.md` item 13 and §1.
- Required name: item 14 and §2.
- Skippable and reopenable intro, with the way back behind the HUD menu: §3.
- Lamplighter opening the scene with the full passage and closing it: §4 steps 1
  and 6.
- Reachability at exit and the three-way exit copy: item 8.
- The optional sign-in offer, and declining being a first-class path:
  `storyboard-v2.md` §2, and ADR-0002 for sign-in never being required.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

Two things to surface rather than decide, per `AGENTS.md` §7:

1. **Whether the name is editable after creation.** Open decision 6 in
   `storyboard-v2.md`. Write-once is simpler; editable makes it save state with a
   settings surface to change it from, and workstream A is already building the HUD
   menu that surface would live on.
2. **Scene revisit.** Open decision in `storyboard-v2.md`, and it interacts directly
   with workstream B: if the Lamplighter's exit is final, the exit copy must say so,
   and if revisit exists, the all-references bonus becomes reachable after
   completion. Resolve before writing the exit copy. PRD-08 declares it out of
   scope, so it lands here by default.

One decision that is now closed and should stop being treated as open. The previous
cut (PRD-06, note 1) asked which save version carries the player name and warned that
fixing it "requires an edit to PRD-05, not just a note here". That edit exists:
[PRD-08](./08_playable_demo.md) phase 1 reserves an optional player-name field in v3
that it does not read or write. Workstream A fills it. There is no v4.

On ordering: workstream A depends on nothing outside this PRD once PRD-08 phase 1 has
landed, and it makes the game feel like a game, so it is the cheapest visible
progress available. Workstream B is a few hours of engine work sitting behind content
that does not exist, so start it only once someone is writing the Lamplighter's copy,
or accept shipping visible placeholder text.
