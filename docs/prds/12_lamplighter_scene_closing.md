# PRD-12: The Lamplighter and scene closing

## Goal

The Lamplighter, who is the only character who can end a scene and currently does
not exist anywhere. Currently absent from every content file and every line of
code, so as designed the scene has no exit.

Engine-cheap and content-blocked, which makes this the one PRD in the split where
the bottleneck is not engineering. Does not touch `src/core/` rules or the
encounter itself.

This used to share a document with the home screen and intro, as PRD-10 "shell and
scene framing." Splitting them out separately reflects that they were already
independent workstreams with no dependency on each other; this one is content-
blocked while the home screen (now [PRD-11](./11_home_screen_and_intro.md)) is not,
so bundling them under one PR timeline only slowed down the half that was ready to
ship.

Supersedes PRD-10 workstream B, unchanged in substance.

## Prerequisites

- [PRD-08](./08_playable_demo.md) phase 1 merged, for the `scene-complete` and
  `all-references` causes and the orchestrator that computes the bonus, which
  this PRD awards.
- One shared surface to expect conflicts in, and nowhere else: `runtime.ts`, the
  single composition point.

## Acceptance criteria

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
  [PRD-09](./09_gloo_card_generation.md),
  [PRD-10](./10_youversion_sign_in_and_highlight_sync.md).
- **Home screen, name entry, intro.** [PRD-11](./11_home_screen_and_intro.md).
- **CI.** PRD-07, complete.
- **Dialogue for scenes 2 through 9**, and authored copy for scene 1. Content.
- **The six designed personas.** Content, and it gates this PRD's Lamplighter
  copy along with the rest of the cast.
- **World art, tilemaps, audio.** Still empty directories.

## Notes

Where the rules come from:

- Lamplighter opening the scene with the full passage and closing it:
  `storyboard-v2.md` §4 steps 1 and 6.
- Reachability at exit and the three-way exit copy: item 8.

Citation convention, matching PRD-07: `§n` is a numbered section of the cited
document, `item n` is a row of the "What changed from v1" table in
`storyboard-v2.md`, and `line n` is a line reference. Note that the table items and
the §4 flow steps are separately numbered and both go up to 7, so say which.

One thing to surface rather than decide, per `AGENTS.md` §7:

1. **Scene revisit.** Open decision in `storyboard-v2.md`, and it interacts
   directly with this PRD: if the Lamplighter's exit is final, the exit copy must
   say so, and if revisit exists, the all-references bonus becomes reachable after
   completion. Resolve before writing the exit copy. PRD-08 declares it out of
   scope, so it lands here by default.

On ordering: this is a few hours of engine work sitting behind content that does
not exist. Start it only once someone is writing the Lamplighter's copy, or accept
shipping visible placeholder text.

On cutting: if this PRD is cut entirely, a scene has no way to close, so the game
cannot be called complete end to end even though every encounter in it works. This
is the one PRD in the split where cutting it is closer to "not finished" than
"a feature we chose not to build."
