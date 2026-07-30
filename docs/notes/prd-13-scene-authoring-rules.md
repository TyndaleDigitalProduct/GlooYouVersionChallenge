# PRD-13 scene authoring rules

Working scratch. Delete when PRD-13 merges.

Delivery step 5. Every scene worker gets this verbatim. It is what authoring
scene 1 and the operator's review of it taught, restated as rules, so that eight
scenes do not each rediscover the same things.

## The one number that changed since scene 1 was authored

**The drawn sprite is 24x32, not 48x64.** The operator's review halved
`SPRITE_SCALE`, because at 2 a character stood 64 tall beside an 81-tall house
and the room read as cramped. Scene 1's coordinates were authored at the old size
and still validate, because the footprint check only got more permissive.

Every clearance figure below is stated at the **new** size. Do not scale scene
1's numbers; use these.

| Constant | Value | What it governs |
| --- | --- | --- |
| Drawn sprite | 24 x 32 | The figure the player sees. Origin is 0.5, 0.9 — **the anchor is at the feet**, so `y` is where the character stands, not their centre. |
| `PLAYER_SIZE` | 22 | The square collision body. Unchanged by the review. This is why a 23px gap is impassable. |
| `CHARACTER_CLICK_RADIUS` | 40 | **Minimum separation between any two placements in a scene.** Closer than this and a click meant for one resolves to the other. |
| `INTERACT_RADIUS` | 68 | How close the player must get to talk. Nothing to author, but it means a character 68px from a wall is still reachable. |
| World | 1920 x 1080 | Camera shows 960x540 and follows the player. |

## Clearance rules

1. **Stand clear of collision by at least 16px on the side the player approaches
   from.** The body is 22 wide, so it needs 11px of clear ground to occupy plus
   margin. A character flush against a wall validates but is awkward to reach.
2. **A doorway or gap must be at least 32px wide to route through.** 22 is the
   theoretical minimum and it fails in practice: the palace bridge was authored
   at 23px and the reachability check cut the precinct in two. If a character is
   behind a gap, check the gap, not the character.
3. **Keep placements 48px apart, not 40.** 40 is where the validator fails. The
   extra 8px is because clicks land imprecisely on touch, and scene 1's Judean
   four at 40-50px apart were flagged in review as reading like a row.
4. **Do not place a character on the same y within 24px of another** unless they
   are meant to read as a pair. Equal y across three or more characters is what
   made PRD-12's arithmetic rows look mechanical, and removing that look is the
   point of this PRD.
5. **Tall props are blocked at their base only.** The upper part of a tent, tower
   or column is walk-behind, not solid. So a character may stand *visually over*
   a column's shaft and be perfectly legal. Trust the collision rectangles in the
   backdrop file, not the picture.
6. **Flat-topped structures are fully blocked** — city houses, the burnt
   sanctuary, the palace front. Nobody stands on those.

## Placement craft

- **Place people where the beat puts them,** not where there is room. The
  Lamplighter near where the player arrives, an official by the thing they
  administer, a servant by the tables they work. Scene 1 puts Melzar's equivalent
  at the food tables and the mother in the city rather than the enemy camp.
- **The player spawns somewhere that shows the scene's subject.** Scene 1 spawns
  just inside the breach so the first thing on screen is a wall broken open.
- **Guides (the bare scripture references) can stand slightly apart** from the
  story cast. They are the scored encounters and benefit from being findable.
- **Do not cluster the four Judeans** (Daniel, Hananiah, Mishael, Azariah). They
  appear in every scene, and in review they read as a row. Give them different
  y values and let one or two stand apart from the other two.

## The file you edit

`content/maps/scene-N.map.json`, and **only** that file.

```json
{
  "scene": 4,
  "status": "authored",
  "backdrop": "babylon-palace",
  "note": "what this scene is, and why the cast stands where it does",
  "spawn": { "x": 0, "y": 0 },
  "exit": { "x": 0, "y": 0, "width": 100, "height": 40, "note": "where it leads" },
  "placements": [
    { "reference": "character:scene-4:daniel", "x": 0, "y": 0, "note": "why here" }
  ]
}
```

- Flip `status` from `"draft"` to `"authored"`. That is what turns the validator
  on for your scene.
- Every placement needs a `note`. It is how the operator reviews 99 placements
  without opening the game for each one.
- The draft file already has a provisional `spawn` and `exit`. They are described
  as "standable and inside the right zone, but not reviewed". Improve them if the
  beat wants a different arrival, keep them if they are right.
- **`collision` and `overlays` must never appear in a scene file.** The schema
  rejects them by name. They belong to the backdrop, which is shared, and five
  palace scenes independently deriving collision was the exact failure the
  two-file split prevents.

## How to check your work

```
VALIDATE_SCENE=<N> pnpm validate:scene
```

Reads only your scene file and the one backdrop it names, so it cannot fail on
another worker's half-finished scene. Iterate until it passes. It runs the same
four checks as the boot path:

1. Every placement outside every collision rectangle for the backdrop.
2. No two placements closer than 40px.
3. Every placement inside world bounds, counting the drawn 24x32 sprite and its
   feet anchor, not just the point.
4. **Every placement reachable from the spawn point** by flood fill across the
   collision grid, meaning the player can get within `INTERACT_RADIUS` of them.

Check 4 is the one that matters. A walled-off character makes the scene
uncompletable and the player has no way to know why.

**A passing validator is necessary, not sufficient.** It cannot tell you that
someone is standing in a stupid place, only that they are standing somewhere
legal.

## Out of bounds for a scene worker

- Do not edit any other scene file, any backdrop file, anything in `src/`,
  `content/*.json` at the top level, or the PRD.
- Do not run `pnpm test`, `pnpm build` or `pnpm e2e`. They load all nine scene
  files at once and will fail on a sibling's in-progress work, which tells you
  nothing about your own. Use `pnpm validate:scene`.
- Do not commit, stage, or push. The lead validates each returned file and makes
  one commit per scene.
- Do not write an ADR (`AGENTS.md` §7).
