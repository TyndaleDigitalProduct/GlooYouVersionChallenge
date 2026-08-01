import { findSceneContent } from "@/content/loadContent";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";
import { displayReference } from "./scriptureReference";

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
 *
 * **The art is the menu.** `start-screen.png` has the title, the subtitle,
 * and both action scrolls painted into it, so this component contributes no
 * chrome of its own: just the two scroll buttons laid over their painted
 * counterparts, an accessible name for each, and a caption under Continue.
 * Rendering a DOM panel here as well (the first cut of this PRD) put a second
 * title and a second set of buttons on top of the painted ones, which left
 * the real controls competing with dead pixels that looked just as clickable.
 *
 * The buttons themselves are the standalone scroll art shipped alongside the
 * background (`art/start_screen/Start Screen Buttons`, downscaled 5x into
 * `public/assets/ui/`), positioned to sit exactly on the painted scrolls and
 * sized to cover them. The cut before this one used transparent hit regions
 * over the painted pixels instead, which meant hover, press, and disabled had
 * nothing to act on but a glow or a veil drawn *around* art that could never
 * itself respond. Owning the pixels is what makes those states possible.
 *
 * Two consequences worth naming, both departures from the PRD's acceptance
 * criteria as written:
 *
 * - The criteria say a *single* Enter action for a first-time player. The art
 *   paints two scrolls unconditionally, so instead of hiding one, Continue is
 *   rendered disabled and dimmed with no save behind it, and New Game carries
 *   the Enter role (going straight to setup, with no confirm to sit through
 *   since there is nothing to erase).
 * - The criteria pair the title with a tagline. The art has no room for one
 *   that would not sit on top of the pixel art, and the intro's first beat
 *   already does that orientation work, so there is no tagline here.
 */
export function HomeScreen() {
  const runtime = useRuntime();
  const playerName = useGameState((state) => state.playerName);
  const confirmOpen = useViewState((state) => state.newGameConfirmOpen);
  const currentSceneId = useGameState((state) => state.currentSceneId());
  const balance = useGameState((state) => state.balance());

  const gameComplete = useGameState((state) => state.isGameComplete());
  const hasSave = Boolean(playerName);
  const scene = currentSceneId ? findSceneContent(runtime.content, currentSceneId) : undefined;

  // PRD-13 phase 5: with the chapter finished there is no current scene to
  // continue *to*, so Continue lands on the end state instead of dropping the
  // player into a chapter with nothing left in it.
  const continueGame = () => {
    const view = runtime.view.getState();
    if (gameComplete) {
      view.showChapterComplete();
      return;
    }
    view.continueGame();
  };

  const newGame = () => {
    // With no save there is nothing to erase, so the destructive confirm
    // would be a step with no decision in it. It is only for a real save.
    if (hasSave) {
      runtime.view.getState().openNewGameConfirm();
      return;
    }
    runtime.view.getState().goToSetup();
  };

  return (
    <div className="vv-home" data-testid="home-screen">
      <div className="vv-home__art">
        {/* The title exists only as pixels in the background art, so the
            document still needs one a screen reader can reach. */}
        <h1 className="vv-visually-hidden">Verse &amp; Vale</h1>

        <button
          type="button"
          className="vv-home__scroll vv-home__scroll--new-game"
          data-testid="home-new-game"
          onClick={newGame}
        >
          {/* The word is painted into the scroll, so the img is decorative and
              the accessible name comes from the hidden span beside it. */}
          <img className="vv-home__scroll-art" src="/assets/ui/button-new-game.png" alt="" />
          <span className="vv-visually-hidden">New game</span>
        </button>

        <button
          type="button"
          className="vv-home__scroll vv-home__scroll--continue"
          data-testid="home-continue"
          disabled={!hasSave}
          onClick={continueGame}
        >
          <img className="vv-home__scroll-art" src="/assets/ui/button-continue.png" alt="" />
          <span className="vv-visually-hidden">Continue</span>
        </button>

        <p className="vv-home__continue-detail" data-testid="home-continue-detail">
          {hasSave ? (
            <>
              {scene
                ? `Scene ${scene.ordinal} of ${runtime.content.scenes.length} · ${displayReference(scene.verses)}`
                : "Every scene complete"}
              {" · "}
              {balance} Vale Stone{balance === 1 ? "" : "s"}
            </>
          ) : (
            "No saved game yet"
          )}
        </p>

        {/* PRD-13 phase 5, open question 3 defaulted: the chapter map sits
            *beside* Continue rather than replacing it. Continue is still the one
            press that resumes the game; this is a second, quieter door, into the
            progress view and from there back into any finished scene. It is not
            painted into the art, so it is a plain plate off to the side of the
            two scrolls rather than a third scroll competing with them, and it
            only appears with a save behind it. */}
        {hasSave ? (
          <button
            type="button"
            className="vv-button vv-button--quiet vv-home__chapter-map"
            data-testid="home-chapter-map"
            onClick={() => runtime.view.getState().openChapterMap()}
          >
            Chapter map
          </button>
        ) : null}
      </div>

      {confirmOpen ? <NewGameConfirm /> : null}
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
