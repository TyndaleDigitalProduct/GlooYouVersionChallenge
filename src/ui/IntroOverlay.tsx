import { useState } from "react";
import { substituteName } from "./nameSubstitution";
import { useGameState, useRuntime } from "./RuntimeContext";

interface IntroBeat {
  title: string;
  body: string;
}

/**
 * Placeholder-free, but still shell copy authored for this PRD rather than
 * scene dialogue (out of scope, per the PRD's "Out of scope" list). Covers
 * exactly what storyboard-v2.md §3 lists: cast, click to move, click to
 * talk, the lantern affordance, the read gate, the three-card cap, the
 * reveal, and stones.
 */
const INTRO_BEATS: readonly IntroBeat[] = [
  {
    title: "Welcome",
    body: "Welcome to the Vale, {name}. This is Daniel 1, and you're about to walk through it.",
  },
  {
    title: "Getting around",
    body: "Click anywhere on the ground to walk there. Click a character to talk with them.",
  },
  {
    title: "The lantern",
    body: "A lit lantern means that character has something to show you — a connection to the wider Bible worth exploring.",
  },
  {
    title: "Scripture cards",
    body: "A cross-reference guide opens two Scripture cards: the Daniel passage and its cross-reference. Read both before anything else unlocks.",
  },
  {
    title: "Choosing connections",
    body: "Once both cards are read, six insight cards appear. Pick up to three that feel most important, {name} — there's no penalty for the rest.",
  },
  {
    title: "The reveal",
    body: "After you lock in your picks, every card's value is revealed, chosen or not — a chance to see what else was there.",
  },
  {
    title: "Vale Stones",
    body: "Talking with a guide, choosing well, and finishing a scene all earn Vale Stones. Nothing is ever taken away.",
  },
];

/**
 * The intro (PRD-11, storyboard-v2.md §3). Skippable at any point, and
 * reopenable later from the HUD menu (`HudMenu`'s "Replay intro"), which is
 * what keeps a returning player from being trapped in it and a curious one
 * from losing the way back.
 */
export function IntroOverlay() {
  const runtime = useRuntime();
  // Setup enforces a non-blank name before this phase is reachable; see
  // nameSubstitution.ts for why no fallback address is written here either.
  const playerName = useGameState((state) => state.playerName ?? "");
  const [index, setIndex] = useState(0);

  const beat = INTRO_BEATS[index];
  const isLast = index === INTRO_BEATS.length - 1;

  const advance = () => {
    if (isLast) {
      runtime.view.getState().leaveIntro();
      return;
    }
    setIndex((current) => current + 1);
  };

  return (
    <div className="vv-intro" data-testid="intro-overlay">
      <section className="vv-panel vv-intro__panel">
        <p className="vv-intro__progress">
          {index + 1} of {INTRO_BEATS.length}
        </p>
        <h1 className="vv-intro__title">{beat.title}</h1>
        <p data-testid="intro-text">{substituteName(beat.body, playerName)}</p>

        <div className="vv-intro__footer">
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="intro-skip"
            onClick={() => runtime.view.getState().leaveIntro()}
          >
            Skip intro
          </button>
          <button
            type="button"
            className="vv-button vv-button--primary"
            data-testid="intro-next"
            onClick={advance}
          >
            {isLast ? "Start playing" : "Next"}
          </button>
        </div>
      </section>
    </div>
  );
}
