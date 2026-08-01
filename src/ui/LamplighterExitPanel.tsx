import { planOnward } from "@/app/sceneFlow";
import { findSceneContent } from "@/content/loadContent";
import { substituteName } from "./nameSubstitution";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";
import { displayReference } from "./scriptureReference";

/**
 * The Lamplighter's scene-exit interaction (PRD-12, storyboard-v2.md §4 step
 * 6). PRD-04's scene simply ended when a forced dialogue sequence ran out;
 * item 8 of storyboard-v2.md flags that as unfindable once the Lamplighter
 * "left the screen." PRD-12's fix is to place the Lamplighter as a walk-to-able,
 * clickable marker in the world (WorldScene.ts) for the rest of the scene —
 * this panel is what opens when the player reaches them.
 *
 * The exit line is picked live, every render, from how many of the scene's
 * cross-references the player has engaged (`GameStoreState.lamplighterExitBranch`,
 * src/core/rewards.ts): "all", "some", or "none". None of the three is
 * punitive about what got skipped, and none of them is shown by this
 * component gating anything — leaving with "none" closes the scene exactly
 * like leaving with "all" does.
 *
 * **PRD-13 phase 5 makes this panel the whole of a room transition.** The
 * operator's decision (2026-07-30, superseding walk-to-exit) is that moving on
 * is a fade on an explicit control, and that the control lives here rather than
 * as a new widget on the canvas, because everything readable belongs in the DOM
 * (ADR-0002). So the panel is two steps, and the order is the point:
 *
 *  1. **Close the scene.** The Lamplighter stays the gate: this is the press
 *     that runs `completeScene`, awards the scene-complete stones, and reveals
 *     the next region.
 *  2. **Ready to move on.** Only offered once the scene is closed. This is the
 *     press that fades out, swaps the room, and fades back in on the next
 *     scene's own spawn point.
 *
 * A revisited scene arrives at step 2 straight away, since its Lamplighter
 * closed it long ago (PRD-13 open question 6, defaulted this way). Nothing in
 * step 2 touches the ledger, which is how re-entering a completed scene cannot
 * re-award anything: `completeScene` would report `changed: false` anyway, but
 * the transition path never calls it.
 *
 * On the last scene there is nowhere to fade to, so step 2 becomes the end
 * state instead of a transition (`planOnward` returns null; the phase becomes
 * "complete").
 */
export function LamplighterExitPanel() {
  const sceneId = useViewState((state) => state.openLamplighterSceneId);
  if (!sceneId) return null;
  return <LamplighterExitPanelBody sceneId={sceneId} />;
}

function LamplighterExitPanelBody({ sceneId }: { sceneId: string }) {
  const runtime = useRuntime();
  const playerName = useGameState((state) => state.playerName ?? "");
  const branch = useGameState((state) => state.lamplighterExitBranch(sceneId));
  const closed = useGameState((state) => state.isSceneComplete(sceneId));
  const scene = findSceneContent(runtime.content, sceneId);

  const line = scene?.lamplighterExit?.[branch];
  const onward = planOnward(runtime.content, sceneId);
  const arriving = onward ? findSceneContent(runtime.content, onward.toSceneId) : undefined;

  const closeScene = () => {
    // Idempotent in src/core, so a double press cannot double-award. The panel
    // stays open on purpose: the player has just been told the scene is closed
    // and is being offered the way out in the same breath.
    runtime.store.getState().completeScene(sceneId);
  };

  const moveOn = () => {
    const view = runtime.view.getState();
    if (!onward) {
      view.closeLamplighter();
      view.showChapterComplete();
      return;
    }
    // Closes this panel itself, along with anything else the old room had open.
    view.beginSceneTransition(onward);
  };

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-dialogue"
        role="dialog"
        aria-label="The Lamplighter"
        data-testid="lamplighter-panel"
      >
        <header className="vv-dialogue__header">
          <p className="vv-dialogue__speaker">The Lamplighter</p>
        </header>

        <p className="vv-dialogue__text" data-testid="lamplighter-text">
          {substituteName(line ?? "", playerName)}
        </p>

        {closed && arriving ? (
          <p className="vv-dialogue__progress" data-testid="lamplighter-onward">
            Next: {displayReference(arriving.verses)} · {arriving.setting}
          </p>
        ) : null}
        {closed && !onward ? (
          <p className="vv-dialogue__progress" data-testid="lamplighter-last-scene">
            That is the last scene of the chapter.
          </p>
        ) : null}

        <footer className="vv-dialogue__footer">
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="lamplighter-not-yet"
            onClick={() => runtime.view.getState().closeLamplighter()}
          >
            Not yet
          </button>

          {closed ? (
            <button
              type="button"
              className="vv-button vv-button--primary"
              data-testid="lamplighter-move-on"
              onClick={moveOn}
            >
              {onward ? "Ready to move on" : "Close the chapter"}
            </button>
          ) : (
            <button
              type="button"
              className="vv-button"
              data-testid="lamplighter-close-scene"
              onClick={closeScene}
            >
              I'm finished here
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
