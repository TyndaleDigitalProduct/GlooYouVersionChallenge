import { findSceneContent } from "@/content/loadContent";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

/**
 * The narrative beats for the current playable scene.
 *
 * Every line in here is placeholder filler and is marked as such on screen,
 * not only in the content file: a screenshot of this build must not be
 * mistakable for authored copy. No line quotes or paraphrases Scripture.
 *
 * Reaching the last beat completes the scene through `store.completeScene`
 * and does nothing else. Revealing the next region is src/core's job, and the
 * world redraws off the resulting `region:revealed` event.
 */
export function DialogueBox() {
  const runtime = useRuntime();
  const currentSceneId = useGameState((state) => state.currentSceneId());
  const dialogueIndex = useViewState((state) => state.dialogueIndex);

  const scene = currentSceneId ? findSceneContent(runtime.content, currentSceneId) : undefined;

  if (!scene?.playable) {
    return (
      <section className="vv-panel vv-dialogue" data-testid="scene-complete">
        <p className="vv-dialogue__speaker">End of the vertical slice</p>
        <p className="vv-dialogue__text">
          Scene 1 is complete and the next region has been revealed on the map. Scenes 2 to 9 exist
          in the manifest so progression and fog of war are real, but they carry no dialogue yet.
        </p>
      </section>
    );
  }

  const beatIndex = Math.min(dialogueIndex, scene.beats.length - 1);
  const beat = scene.beats[beatIndex];
  const isLastBeat = beatIndex === scene.beats.length - 1;

  const advance = () => {
    if (isLastBeat) {
      runtime.store.getState().completeScene(scene.id);
      return;
    }
    runtime.view.getState().advanceDialogue();
  };

  return (
    <section className="vv-panel vv-dialogue" data-testid="dialogue-box">
      <header className="vv-dialogue__header">
        <p className="vv-dialogue__speaker">{beat.speaker}</p>
        <p className="vv-dialogue__setting">
          {scene.verses} · {scene.setting}
        </p>
      </header>

      <p className="vv-placeholder-tag">Placeholder copy, not authored dialogue</p>
      <p className="vv-dialogue__text" data-testid="dialogue-text">
        {beat.text}
      </p>

      <footer className="vv-dialogue__footer">
        <p className="vv-dialogue__progress">
          Beat {beatIndex + 1} of {scene.beats.length}
        </p>
        <button
          type="button"
          className="vv-button"
          data-testid="dialogue-advance"
          onClick={advance}
        >
          {isLastBeat ? "Finish scene" : "Continue"}
        </button>
      </footer>
    </section>
  );
}
