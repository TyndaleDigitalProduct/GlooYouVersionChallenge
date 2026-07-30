import { useMemo } from "react";
import { chapterProgress } from "@/app/chapterMap";
import { planJump } from "@/app/sceneFlow";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

/**
 * The chapter map (PRD-13 phase 5, ADR-0004's "the chapter map becomes its own
 * screen"): the nine scenes of Daniel 1, which are locked, which is current,
 * which are closed, and a way back into any the player has already reached.
 *
 * **Where it lives** (PRD-13 open question 3, unanswered; defaulted here):
 * behind the HUD menu, and offered on the home screen beside Continue rather
 * than replacing it. Deliberately *not* a required step between scenes. With
 * transitions reduced to a fade on the Lamplighter's control, the chapter map has
 * no role in the main loop at all: it is a progress view and a door back into
 * finished scenes, so putting it in the path between every pair of scenes would
 * add a screen the loop does not need.
 *
 * **Whether it needs art** (open question 4, unanswered; defaulted here): no new
 * art. Nothing in `art/` is a chapter map, and inventing one is out of scope for
 * a phase whose point is removing placeholders. But a bare list of nine links
 * would itself be a placeholder, so this is built as a designed progress view in
 * the existing DOM vocabulary — the same parchment, wood, and gold as every other
 * panel — with each state legible at a glance and carried by a badge and dimming
 * rather than by colour alone.
 *
 * It opens over whichever phase is showing and closes back to it, rather than
 * being a phase of its own: it is reachable from both the home screen and mid-play,
 * and those two want different things behind them.
 */
export function ChapterMapScreen() {
  const open = useViewState((state) => state.chapterMapOpen);
  if (!open) return null;
  return <ChapterMapBody />;
}

function ChapterMapBody() {
  const runtime = useRuntime();
  // Both of these are reference-stable slices of the store's own state, which is
  // what lets them be selected directly: a selector deriving a fresh array would
  // re-render forever (see the selector rules in RuntimeContext.tsx).
  const completedSceneIds = useGameState((state) => state.completedSceneIds);
  const encounters = useGameState((state) => state.encounters);
  const balance = useGameState((state) => state.balance());
  const roomSceneId = useViewState((state) => state.roomSceneId);

  const progress = useMemo(
    () =>
      chapterProgress({
        content: runtime.content,
        completedSceneIds,
        encounters,
        roomSceneId,
      }),
    [runtime, completedSceneIds, encounters, roomSceneId],
  );

  const enter = (sceneId: string) => {
    const view = runtime.view.getState();
    const plan = roomSceneId ? planJump(runtime.content, roomSceneId, sceneId) : null;

    if (!plan) {
      // Already standing in that room (or no room recorded yet): just get out of
      // the way. Fading out and back in on the same spawn point would read as a
      // glitch, and `continueGame` is what makes the map a live route into play
      // from the home screen and from the end state.
      view.closeChapterMap();
      view.continueGame();
      return;
    }

    // Closes the map itself and forces the playing phase (see the view store).
    view.beginSceneTransition(plan);
  };

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-chapter-map"
        role="dialog"
        aria-label="Chapter map"
        data-testid="chapter-map"
      >
        <header className="vv-chapter-map__header">
          <h2 className="vv-chapter-map__title">Daniel, chapter one</h2>
          <p className="vv-chapter-map__summary" data-testid="chapter-map-summary">
            {progress.complete
              ? "Every scene closed"
              : `${progress.scenesComplete} of ${progress.scenesTotal} scenes closed`}
            {" · "}
            {progress.encountersResolved} of {progress.encountersTotal} references resolved
            {" · "}
            {balance} Vale Stone{balance === 1 ? "" : "s"}
          </p>
        </header>

        <ol className="vv-chapter-map__scenes">
          {progress.entries.map((entry) => (
            <li
              key={entry.sceneId}
              className={`vv-chapter-scene vv-chapter-scene--${entry.state}${
                entry.here ? " vv-chapter-scene--here" : ""
              }`}
              data-testid={`chapter-scene-${entry.ordinal}`}
              data-state={entry.state}
            >
              <p className="vv-chapter-scene__ordinal" aria-hidden="true">
                {entry.ordinal}
              </p>

              {/* Passage, setting, and reference count on two lines rather than
                  three, so all nine scenes come closer to fitting on one screen:
                  the whole value of a chapter map is seeing the shape of the
                  chapter at once, and scrolling to find scene 9 undercuts that. */}
              <div className="vv-chapter-scene__body">
                <p className="vv-chapter-scene__verses">
                  <span className="vv-visually-hidden">Scene {entry.ordinal}, </span>
                  {entry.verses}
                  <span className="vv-chapter-scene__setting">{entry.setting}</span>
                </p>
                <p className="vv-chapter-scene__references">
                  {entry.encountersResolved} of {entry.encountersTotal} references resolved
                  {entry.here ? (
                    <span className="vv-chapter-scene__here" data-testid="chapter-scene-here">
                      You are here
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="vv-chapter-scene__state">
                {/* Text, not only colour: locked, current, and closed each say so
                    in words, so the three states survive a colour-blind reader
                    and a greyscale screenshot alike (the same rule ADR-0003 sets
                    for insight cards). */}
                <p className="vv-chapter-scene__badge">
                  {entry.state === "locked"
                    ? "Locked"
                    : entry.state === "current"
                      ? "Current"
                      : "Closed"}
                </p>
                {entry.enterable ? (
                  <button
                    type="button"
                    className="vv-button vv-button--quiet"
                    data-testid={`chapter-scene-enter-${entry.ordinal}`}
                    onClick={() => enter(entry.sceneId)}
                  >
                    {entry.state === "complete" ? "Revisit" : "Enter"}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <footer className="vv-chapter-map__footer">
          <button
            type="button"
            className="vv-button"
            data-testid="chapter-map-close"
            onClick={() => runtime.view.getState().closeChapterMap()}
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}
