// Where the player goes next, and what the fade says on the way (PRD-13 phase 5).
//
// Transitions are a fade on the Lamplighter's "ready to move on" control
// (operator, 2026-07-30, superseding walk-to-exit). Nobody walks to a door,
// there is no exit rectangle, and the fade is therefore the *entire* transition:
// it carries the whole beat, so what it says matters more than how long it takes.
//
// Everything here is a pure derivation of the content documents. It holds no
// rule about what is unlocked (that is src/core/progression.ts, untouched per
// ADR-0004) and no state of its own: it only answers "which scene follows this
// one, and what does its caption say". The caption always comes from the
// *arriving* scene, so a scene reached from the chapter map is stamped exactly
// the same way as one reached by closing its predecessor.
import type { GameContent } from "@/content/loadContent";

export interface SceneTransitionPlan {
  /** The room being left. */
  fromSceneId: string;
  /** The room being entered, at its own authored spawn point. */
  toSceneId: string;
  /**
   * The line shown over the fade, naming when and where the arriving scene
   * happens. Null only if the content file left one out, which
   * loadContent.test.ts fails the build over for the real files.
   */
  caption: string | null;
}

/**
 * The next playable scene in narrative order, or null at the end of the chapter.
 *
 * "Playable" rather than simply "next" because the world can only draw a
 * playable scene (`WorldScene.activeSceneMap`), so fading into a non-playable
 * one would throw rather than degrade. All nine of Daniel 1 are playable as of
 * PRD-13 phase 5; the skip exists for a later chapter authored a scene at a time.
 */
export function nextPlayableSceneId(content: GameContent, sceneId: string): string | null {
  const index = content.scenes.findIndex((scene) => scene.id === sceneId);
  if (index === -1) return null;

  const next = content.scenes.slice(index + 1).find((scene) => scene.playable);
  return next ? next.id : null;
}

/**
 * The transition offered by the Lamplighter's "ready to move on" control, or
 * null when there is nowhere left to go — which is exactly the condition the
 * end state hangs off (`isGameComplete`, src/core/progression.ts).
 */
export function planOnward(content: GameContent, fromSceneId: string): SceneTransitionPlan | null {
  const toSceneId = nextPlayableSceneId(content, fromSceneId);
  if (!toSceneId) return null;
  return { fromSceneId, toSceneId, caption: captionFor(content, toSceneId) };
}

/**
 * The transition for re-entering a scene directly, which is how the chapter map
 * gets back into a completed one. Deliberately the same fade and the same
 * caption as `planOnward`, so arriving somewhere always looks the same however
 * the player got there.
 *
 * Refuses a jump to the room already on screen: fading out and back in on the
 * same spawn point reads as a glitch, and it would restart the room for nothing.
 */
export function planJump(
  content: GameContent,
  fromSceneId: string,
  toSceneId: string,
): SceneTransitionPlan | null {
  if (fromSceneId === toSceneId) return null;
  const target = content.scenes.find((scene) => scene.id === toSceneId);
  if (!target?.playable) return null;
  return { fromSceneId, toSceneId, caption: captionFor(content, toSceneId) };
}

function captionFor(content: GameContent, sceneId: string): string | null {
  return content.scenes.find((scene) => scene.id === sceneId)?.transitionCaption ?? null;
}
