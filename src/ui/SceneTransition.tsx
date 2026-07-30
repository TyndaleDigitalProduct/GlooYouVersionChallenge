import { useEffect } from "react";
import { useRuntime, useViewState } from "./RuntimeContext";

/**
 * How long each fade takes, and how long the caption is held at full black.
 *
 * Exported because the clock is the one part of the transition that is not
 * derivable from state: the store holds which stage the fade is in, and this
 * component is the only thing that moves it on. Keeping the numbers here, next
 * to the effect that uses them, is what stops a CSS duration and a JS timeout
 * drifting apart — `styles.css` reads `--vv-fade-ms` from the same values.
 *
 * The hold is generous on purpose. With walking gone, the fade *is* the whole
 * transition (PRD-13 phase 5), and its caption is the only thing telling the
 * player that time has passed. Five of the eight transitions land on the picture
 * they left, so a caption flashing past would leave them looking at the palace
 * they just left with no explanation.
 */
export const FADE_MS = 450;
export const CAPTION_HOLD_MS = 1500;

/**
 * The room transition: a fade out, a caption naming the time change, a fade
 * back in on the next scene at its own spawn point.
 *
 * In the DOM rather than as a Phaser camera fade, for two reasons. The caption
 * is readable text, which ADR-0002 puts in the overlay without exception; and a
 * camera fade would darken the canvas while leaving the HUD and any panel
 * sitting brightly on top of it, so the transition would not read as one thing
 * happening to the whole screen.
 *
 * The stage machine lives in the view store (`SceneTransitionState`); this
 * component only supplies the clock. That split is deliberate: the room swap has
 * to land while the overlay is fully opaque, and "which stage are we in" is then
 * a fact any test can assert without waiting on a timer.
 */
export function SceneTransition() {
  const runtime = useRuntime();
  const transition = useViewState((state) => state.sceneTransition);
  const stage = transition?.stage ?? null;

  useEffect(() => {
    if (!stage) return;

    const view = runtime.view.getState();
    const { advance, delay } =
      stage === "out"
        ? { advance: view.arriveInScene, delay: FADE_MS }
        : stage === "arriving"
          ? { advance: view.revealScene, delay: CAPTION_HOLD_MS }
          : { advance: view.endSceneTransition, delay: FADE_MS };

    const timer = window.setTimeout(advance, delay);
    return () => window.clearTimeout(timer);
  }, [runtime, stage]);

  if (!transition) return null;

  return (
    <div
      className="vv-transition"
      data-stage={transition.stage}
      data-testid="scene-transition"
      // Not aria-hidden: the caption is the only statement that time has passed,
      // so it has to reach a screen reader as it appears.
      role="status"
    >
      {/* Held back until the screen is actually black. Shown over a half-faded
          world it would read as text laid on the old scene rather than as the
          stamp on the new one. */}
      {transition.caption && transition.stage !== "out" ? (
        <p className="vv-transition__caption" data-testid="scene-transition-caption">
          {transition.caption}
        </p>
      ) : null}
    </div>
  );
}
