import { findSceneContent } from "@/content/loadContent";
import { substituteName } from "./nameSubstitution";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

/**
 * The Lamplighter's opening beats for the current playable scene: the forced
 * "presents the full passage" sequence storyboard-v2.md §4 step 1 puts before
 * free movement. This is *only* the opening now (PRD-12): the Lamplighter's
 * closing is a separate, walk-to-able world interaction
 * (`LamplighterExitPanel`), and every story character/NPC's lines are a
 * third, click-to-talk interaction (`CharacterDialoguePanel`) — neither is a
 * forced Continue sequence any more, and neither completes the scene. This
 * component's only remaining job is the opening; once its last beat is
 * passed, it renders nothing at all and free movement (the world underneath,
 * already rendering) takes over.
 *
 * While the dialogue document's status is "placeholder", every line is
 * filler and is marked as such on screen, not only in the content file: a
 * screenshot of this build must not be mistakable for authored copy. Once the
 * document is "final", the tag drops and the beats are reviewed, authored
 * copy.
 */
export function DialogueBox() {
  const runtime = useRuntime();
  const currentSceneId = useGameState((state) => state.currentSceneId());
  // Setup (PRD-11) enforces a non-blank name before dialogue can ever be
  // reached, so an empty fallback here is defensive only, never the normal
  // path — see nameSubstitution.ts.
  const playerName = useGameState((state) => state.playerName ?? "");
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

  const openingBeats = scene.lamplighterOpening;
  if (dialogueIndex >= openingBeats.length) {
    // The opening is done: nothing left for this component to show. The
    // Lamplighter (reachable at scene exit) and every story character/NPC
    // are placed, clickable markers in the world from here on
    // (WorldScene.ts), not further beats in this sequence.
    return null;
  }

  const beat = openingBeats[dialogueIndex];
  const isLastBeat = dialogueIndex === openingBeats.length - 1;

  return (
    <section className="vv-panel vv-dialogue" data-testid="dialogue-box">
      <header className="vv-dialogue__header">
        <p className="vv-dialogue__speaker">The Lamplighter</p>
        <p className="vv-dialogue__setting">
          {scene.verses} · {scene.setting}
        </p>
      </header>

      {runtime.content.dialogueStatus === "placeholder" && (
        <p className="vv-placeholder-tag">Placeholder copy, not authored dialogue</p>
      )}
      <p className="vv-dialogue__text" data-testid="dialogue-text">
        {substituteName(beat.text, playerName)}
      </p>

      <footer className="vv-dialogue__footer">
        <p className="vv-dialogue__progress">
          Beat {dialogueIndex + 1} of {openingBeats.length}
        </p>
        <button
          type="button"
          className="vv-button"
          data-testid="dialogue-advance"
          onClick={() => runtime.view.getState().advanceDialogue()}
        >
          {isLastBeat ? "Into the streets" : "Continue"}
        </button>
      </footer>
    </section>
  );
}
