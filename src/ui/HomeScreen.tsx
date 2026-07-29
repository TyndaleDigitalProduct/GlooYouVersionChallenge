import { findSceneContent } from "@/content/loadContent";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

/**
 * The home screen (PRD-11, storyboard-v2.md §1). Always the first phase for
 * every player. Which of the two entry states renders is decided by a single
 * check — whether `playerName` is already set on the save — rather than by
 * any separate "does a save exist" flag: a save that exists but failed to
 * read or migrate degrades to `createFreshState()` (src/core/save.ts), which
 * has no `playerName` either, so the first-time state is exactly what shows.
 * Nothing here needs to special-case that failure; `NoticeStack` (rendered
 * by `App` regardless of phase) already surfaces the "your save could not be
 * read" notice `runtime.ts` pushes.
 */
export function HomeScreen() {
  const runtime = useRuntime();
  const playerName = useGameState((state) => state.playerName);
  const confirmOpen = useViewState((state) => state.newGameConfirmOpen);

  const hasSave = Boolean(playerName);

  return (
    <div
      className="vv-home"
      data-testid="home-screen"
      style={{ backgroundImage: "url(assets/backgrounds/start-screen.png)" }}
    >
      <div className="vv-home__panel">
        <h1 className="vv-home__title">Verse &amp; Vale</h1>
        <p className="vv-home__tagline">
          Walk through Daniel 1. Cross-reference guides carry a lit lantern wherever they have
          something to show you.
        </p>

        {hasSave ? (
          <ReturningPlayerActions />
        ) : (
          <button
            type="button"
            className="vv-button vv-button--primary"
            data-testid="home-enter"
            onClick={() => runtime.view.getState().goToSetup()}
          >
            Enter
          </button>
        )}
      </div>

      {confirmOpen ? <NewGameConfirm /> : null}
    </div>
  );
}

function ReturningPlayerActions() {
  const runtime = useRuntime();
  const currentSceneId = useGameState((state) => state.currentSceneId());
  const balance = useGameState((state) => state.balance());
  const scene = currentSceneId ? findSceneContent(runtime.content, currentSceneId) : undefined;

  return (
    <div className="vv-home__actions">
      <button
        type="button"
        className="vv-button vv-button--primary"
        data-testid="home-continue"
        onClick={() => runtime.view.getState().continueGame()}
      >
        <span>Continue</span>
        <span className="vv-home__continue-detail" data-testid="home-continue-detail">
          {scene
            ? `Scene ${scene.ordinal} of ${runtime.content.scenes.length} — ${scene.verses}`
            : "Every scene complete"}
          {" · "}
          {balance} Vale Stone{balance === 1 ? "" : "s"}
        </span>
      </button>
      <button
        type="button"
        className="vv-button vv-button--quiet"
        data-testid="home-new-game"
        onClick={() => runtime.view.getState().openNewGameConfirm()}
      >
        New game
      </button>
    </div>
  );
}

/**
 * The confirm the acceptance criteria requires say exactly what is lost:
 * progress, encounter state, and local highlights. Nothing more — in
 * particular, never YouVersion-synced highlights, which are an outcome of
 * play rather than game state the confirm has any business reclaiming
 * (storyboard-v2.md §1).
 */
function NewGameConfirm() {
  const runtime = useRuntime();

  const confirm = () => {
    runtime.store.getState().resetProgress();
    runtime.view.getState().beginIntro();
  };

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-home__confirm"
        role="alertdialog"
        aria-label="Confirm new game"
        data-testid="new-game-confirm"
      >
        <p>
          Starting a new game erases your progress, your encounter history, and your local
          highlights. This cannot be undone.
        </p>
        <div className="vv-home__confirm-actions">
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="new-game-cancel"
            onClick={() => runtime.view.getState().cancelNewGameConfirm()}
          >
            Cancel
          </button>
          <button
            type="button"
            className="vv-button vv-button--danger"
            data-testid="new-game-confirm-accept"
            onClick={confirm}
          >
            Erase and start over
          </button>
        </div>
      </section>
    </div>
  );
}
