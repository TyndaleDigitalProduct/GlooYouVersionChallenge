import { findCharacterDialogue, findSceneContent } from "@/content/loadContent";
import { substituteName } from "./nameSubstitution";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

/**
 * One story character or NPC's lines (PRD-12, storyboard-v2.md §4 steps 3-4).
 * Deliberately the Lamplighter's plain-beat shape, not the guide encounter
 * flow: no read gate, no Scripture cards, no scoring — "one bland line, no
 * interaction" for an NPC and "1-3 scene-appropriate lines, no interaction"
 * for a story character both mean no *scored* interaction, not no click
 * (storyboard-v2.md §3's "Mechanics to teach" lists "click a character to
 * talk" as a core mechanic, not guide-only).
 *
 * Nothing about a story character/NPC is stateful or one-time, unlike a
 * guide encounter: `openCharacter` (src/app/viewStore.ts) always resets the
 * beat index to 0, so re-clicking one replays its lines from the start
 * rather than resuming or doing nothing.
 */
export function CharacterDialoguePanel() {
  const character = useViewState((state) => state.openCharacterReference);
  if (!character) return null;
  return (
    <CharacterDialoguePanelBody sceneId={character.sceneId} characterId={character.characterId} />
  );
}

function CharacterDialoguePanelBody({
  sceneId,
  characterId,
}: {
  sceneId: string;
  characterId: string;
}) {
  const runtime = useRuntime();
  const playerName = useGameState((state) => state.playerName ?? "");
  const beatIndex = useViewState((state) => state.characterBeatIndex);

  const scene = findSceneContent(runtime.content, sceneId);
  const character = scene ? findCharacterDialogue(scene, characterId) : undefined;

  // Defensive only: every character reference placed in the world names a
  // real entry in this scene's `characters` array (WorldScene.ts builds one
  // marker per entry), so this never fires in normal play.
  if (!character) return null;

  const clampedIndex = Math.min(beatIndex, character.beats.length - 1);
  const beat = character.beats[clampedIndex];
  const isLastBeat = clampedIndex === character.beats.length - 1;

  const advance = () => {
    if (isLastBeat) {
      runtime.view.getState().closeCharacter();
      return;
    }
    runtime.view.getState().advanceCharacterDialogue();
  };

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-dialogue"
        role="dialog"
        aria-label={character.speaker}
        data-testid="character-dialogue-panel"
      >
        <header className="vv-dialogue__header">
          <p className="vv-dialogue__speaker" data-testid="character-dialogue-speaker">
            {character.speaker}
          </p>
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="character-dialogue-close"
            onClick={() => runtime.view.getState().closeCharacter()}
          >
            Close
          </button>
        </header>

        <p className="vv-dialogue__text" data-testid="character-dialogue-text">
          {substituteName(beat.text, playerName)}
        </p>

        <footer className="vv-dialogue__footer">
          <p className="vv-dialogue__progress">
            Beat {clampedIndex + 1} of {character.beats.length}
          </p>
          <button
            type="button"
            className="vv-button"
            data-testid="character-dialogue-advance"
            onClick={advance}
          >
            {isLastBeat ? "Close" : "Continue"}
          </button>
        </footer>
      </section>
    </div>
  );
}
