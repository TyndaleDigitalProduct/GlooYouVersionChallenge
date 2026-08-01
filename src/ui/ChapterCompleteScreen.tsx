import { useMemo } from "react";
import { chapterProgress } from "@/app/chapterMap";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";
import { displayReference } from "./scriptureReference";

/**
 * The end state (PRD-13 phase 5): what the player sees after the ninth scene is
 * closed.
 *
 * PRD-13 open question 7, unanswered; defaulted here to a screen that names what
 * was finished and offers the chapter map with everything complete. Not a silent
 * return to the home screen, and not a dead world: reaching Daniel 1:21 is the
 * whole arc the chapter loop exists to deliver, so it says so, and it leaves two
 * doors open — the map, for a scene the player wants to go back into, and the
 * world itself, which stays walkable.
 *
 * Reached from the Lamplighter's "Close the chapter" on scene 9, and again from
 * the home screen's Continue once the save is finished (there is no current scene
 * to continue *to* at that point, so Continue would otherwise drop the player
 * into a chapter with nothing left in it).
 */
export function ChapterCompleteScreen() {
  const runtime = useRuntime();
  const playerName = useGameState((state) => state.playerName);
  const completedSceneIds = useGameState((state) => state.completedSceneIds);
  const encounters = useGameState((state) => state.encounters);
  const balance = useGameState((state) => state.balance());
  const roomSceneId = useViewState((state) => state.roomSceneId);

  const progress = useMemo(
    () => chapterProgress({ content: runtime.content, completedSceneIds, encounters, roomSceneId }),
    [runtime, completedSceneIds, encounters, roomSceneId],
  );

  const first = progress.entries[0];
  const last = progress.entries[progress.entries.length - 1];

  return (
    <div className="vv-complete" data-testid="chapter-complete">
      <section className="vv-panel vv-complete__panel">
        <h2 className="vv-complete__title">Chapter one, closed</h2>

        <p className="vv-dialogue__text">
          {playerName ? `${playerName}, you` : "You"} walked Daniel 1 from{" "}
          {first ? displayReference(first.verses) : ""} to{" "}
          {last ? displayReference(last.verses) : ""}: {progress.scenesTotal} scenes, {"from "}
          {first?.setting.toLowerCase()} to {last?.setting.toLowerCase()}.
        </p>

        <ul className="vv-complete__tally" data-testid="chapter-complete-tally">
          <li>
            {progress.scenesComplete} of {progress.scenesTotal} scenes closed
          </li>
          <li>
            {progress.encountersResolved} of {progress.encountersTotal} cross-references resolved
          </li>
          <li>
            {balance} Vale Stone{balance === 1 ? "" : "s"} gathered
          </li>
        </ul>

        <p className="vv-dialogue__text">
          The references you left unresolved are still there. Every scene stays open, and the
          chapter map is the way back into any of them.
        </p>

        <footer className="vv-complete__actions">
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="complete-return-to-world"
            onClick={() => runtime.view.getState().continueGame()}
          >
            Back into the vale
          </button>
          <button
            type="button"
            className="vv-button vv-button--primary"
            data-testid="complete-open-chapter-map"
            onClick={() => runtime.view.getState().openChapterMap()}
          >
            Open the chapter map
          </button>
        </footer>
      </section>
    </div>
  );
}
