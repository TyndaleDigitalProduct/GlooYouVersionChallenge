import { findSceneContent } from "@/content/loadContent";
import { substituteName } from "./nameSubstitution";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

/**
 * The Lamplighter's opening beats for the room the player is standing in: the
 * forced "presents the full passage" sequence storyboard-v2.md §4 step 1 puts
 * before free movement. This is *only* the opening (PRD-12): the Lamplighter's
 * closing is a separate world interaction (`LamplighterExitPanel`), and every
 * story character/NPC's lines are a third, click-to-talk interaction
 * (`CharacterDialoguePanel`). Once the last opening beat is passed, this
 * component renders nothing at all and free movement takes over.
 *
 * **PRD-13 phase 5 fixed the `playable` gate here, and this is the trap that
 * cost a day on 2026-07-29.** Until now the component opened with
 * `if (!scene?.playable) return <the "End of the vertical slice" panel>`, using
 * "the scene the store considers current has no dialogue" as a stand-in for "the
 * player has reached the end of the content". That stand-in held only while
 * scene 1 was the single playable scene: completing it advanced
 * `currentSceneId()` to an unplayable scene 2, the negation fired, and the
 * end-of-slice panel appeared. Make a second scene playable and the negation can
 * never fire again, so the panel silently stopped appearing — which is what broke
 * `pnpm e2e`.
 *
 * The fix is not to change the condition but to remove the conflation. Three
 * separate questions had been collapsed into one flag:
 *
 *  - *Which scene's dialogue is this?* The room on screen
 *    (`ViewState.roomSceneId`), not `currentSceneId()`. Those differ routinely
 *    now: a completed scene can be re-entered, and `currentSceneId()` advances
 *    the instant `completeScene` fires, while the player is still standing in
 *    the room they just closed.
 *  - *Is there an opening to play?* A scene with no authored dialogue simply has
 *    nothing to show, so it renders nothing. It is not an ending, and it must
 *    never present itself as one.
 *  - *Has the chapter ended?* `isGameComplete()` in src/core, surfaced by the
 *    end-state screen (`ChapterCompleteScreen`) — a defined end state rather
 *    than a dialogue panel that happens to be showing when the content runs out.
 *
 * A revisited scene shows no opening either: its Lamplighter has already
 * presented the passage, and a forced three-beat replay on every revisit would
 * be a toll on the one thing PRD-12 added revisit for.
 */
export function DialogueBox() {
  const runtime = useRuntime();
  const currentSceneId = useGameState((state) => state.currentSceneId());
  const roomSceneId = useViewState((state) => state.roomSceneId);
  // Setup (PRD-11) enforces a non-blank name before dialogue can ever be
  // reached, so an empty fallback here is defensive only, never the normal
  // path — see nameSubstitution.ts.
  const playerName = useGameState((state) => state.playerName ?? "");
  const dialogueIndex = useViewState((state) => state.dialogueIndex);

  const sceneId = roomSceneId ?? currentSceneId;
  const closed = useGameState((state) => (sceneId ? state.isSceneComplete(sceneId) : false));
  const scene = sceneId ? findSceneContent(runtime.content, sceneId) : undefined;

  if (!scene?.playable) return null;
  if (closed) return null;

  const openingBeats = scene.lamplighterOpening;
  if (dialogueIndex >= openingBeats.length) {
    // The opening is done: nothing left for this component to show. The
    // Lamplighter and every story character/NPC are placed, clickable markers
    // in the world from here on (WorldScene.ts), not further beats here.
    return null;
  }

  const beat = openingBeats[dialogueIndex];
  const isLastBeat = dialogueIndex === openingBeats.length - 1;

  return (
    // A stage wrapping the portrait and the panel so the Lamplighter can be a
    // *sibling* of the panel rather than its child: only then can the panel's
    // parchment and wood frame paint over his lower half, so he reads as
    // standing behind the box with his head and shoulders rising out of it. A
    // child can never sit behind its own parent's background, which is why he
    // used to sit on top of the box instead of behind it.
    <div className="vv-dialogue-stage">
      {/* The Lamplighter's own sprite, cropped from his walk sheet to his
          front-facing idle frame (row 0, column 0 — see spriteDirections.ts) and
          hung behind the panel so his head and shoulders emerge from behind its
          top edge, as if he is looming up over the box to speak. No painted bust
          exists for him yet (blocked art, PRD-13 out-of-scope), and an ex_*
          stand-in would be a different character's face; his real sprite is the
          honest choice. The crop, scale and placement all live in CSS; only the
          sheet URL is dynamic, keyed off the cast so a tone swap cannot mispoint
          it. */}
      <figure
        className="vv-dialogue__portrait"
        data-testid="lamplighter-portrait"
        aria-hidden="true"
        style={{ backgroundImage: `url(assets/sprites/${runtime.cast.lamplighterSpriteKey}.png)` }}
      />

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
    </div>
  );
}
