import { findSceneContent } from "@/content/loadContent";
import { substituteName } from "./nameSubstitution";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

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
 * component gating anything — leaving with "none" completes the scene
 * exactly like leaving with "all" does. Scene revisit (PRD-12, storyboard-v2.md
 * open decision 1) means this panel, and the scene underneath it, stay
 * reachable after completion too: `completeScene` is idempotent, so
 * confirming again is a safe no-op, and the branch keeps recomputing live if
 * the player goes on to resolve a reference they had skipped.
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
  const scene = findSceneContent(runtime.content, sceneId);

  const line = scene?.lamplighterExit?.[branch];

  const moveOn = () => {
    runtime.store.getState().completeScene(sceneId);
    runtime.view.getState().closeLamplighter();
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

        <footer className="vv-dialogue__footer">
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="lamplighter-not-yet"
            onClick={() => runtime.view.getState().closeLamplighter()}
          >
            Not yet
          </button>
          <button
            type="button"
            className="vv-button"
            data-testid="lamplighter-move-on"
            onClick={moveOn}
          >
            Ready to move on
          </button>
        </footer>
      </section>
    </div>
  );
}
