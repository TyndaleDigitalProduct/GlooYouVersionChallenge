// The thirteen authored map documents, imported statically so Vite bundles them
// and a clean-clone build on Vercel cannot miss one.
//
// Explicit imports rather than `import.meta.glob`: a glob would silently ship a
// build with eight scene files if somebody deleted one, and PRD-13's whole point
// is that a missing room fails loudly instead of degrading. The count is asserted
// below, and `buildSceneMaps` (loadContent.ts) then requires one scene file per
// manifest scene and a backdrop file for every key a scene names.

import rawBabylonPalace from "../../content/maps/babylon-palace.backdrop.json";
import rawJerusalemSiege from "../../content/maps/jerusalem-siege.backdrop.json";
import rawScene1 from "../../content/maps/scene-1.map.json";
import rawScene2 from "../../content/maps/scene-2.map.json";
import rawScene3 from "../../content/maps/scene-3.map.json";
import rawScene4 from "../../content/maps/scene-4.map.json";
import rawScene5 from "../../content/maps/scene-5.map.json";
import rawScene6 from "../../content/maps/scene-6.map.json";
import rawScene7 from "../../content/maps/scene-7.map.json";
import rawScene8 from "../../content/maps/scene-8.map.json";
import rawScene9 from "../../content/maps/scene-9.map.json";
import rawTemple from "../../content/maps/temple.backdrop.json";
import rawThroneRoom from "../../content/maps/throne-room.backdrop.json";

/** One per picture: collision and walk-behind overlays. Authored by the lead. */
export const RAW_BACKDROP_DOCUMENTS: readonly unknown[] = [
  rawJerusalemSiege,
  rawTemple,
  rawBabylonPalace,
  rawThroneRoom,
];

/** One per story beat: backdrop key, spawn, cast placement, exit. */
export const RAW_SCENE_MAP_DOCUMENTS: readonly unknown[] = [
  rawScene1,
  rawScene2,
  rawScene3,
  rawScene4,
  rawScene5,
  rawScene6,
  rawScene7,
  rawScene8,
  rawScene9,
];
