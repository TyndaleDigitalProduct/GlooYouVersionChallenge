import { useEffect, useState } from "react";
import type { PassageResult } from "@/app/providers";
import { guideArtFor } from "@/content/cast";
import { findCrossReferenceContent } from "@/content/loadContent";
import { encounterState } from "@/core/encounters";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

const STATE_LABELS: Record<string, string> = {
  unvisited: "Not yet engaged",
  engaged: "Engaged · base stone awarded",
  resolved: "Resolved · insight stones awarded",
};

export function EncounterPanel() {
  const openReference = useViewState((state) => state.openEncounterReference);
  if (!openReference) return null;
  return <EncounterPanelBody key={openReference} reference={openReference} />;
}

/**
 * One cross-reference encounter.
 *
 * The curated note is real content. The passage text is still stubbed and
 * labelled as such; the six-card selection reveal that resolves an encounter
 * is a later phase of this PRD, so this panel only shows the engaged state
 * once the player has walked up.
 */
function EncounterPanelBody({ reference }: { reference: string }) {
  const runtime = useRuntime();
  const crossRef = findCrossReferenceContent(runtime.content, reference);
  const sceneId = crossRef?.sceneId ?? "";

  const state = useGameState((store) => encounterState(store.encounters, sceneId, reference));

  const [passage, setPassage] = useState<PassageResult | null>(null);
  // A missing portrait degrades to a panel without one, never to a broken
  // image icon.
  const [portraitBroken, setPortraitBroken] = useState(false);

  useEffect(() => {
    let cancelled = false;
    runtime.scripture.getPassage(reference).then((result) => {
      if (!cancelled) setPassage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [runtime, reference]);

  if (!crossRef) return null;

  const art = guideArtFor(runtime.cast, crossRef.section);
  const showPortrait = art !== undefined && !portraitBroken;

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-encounter"
        role="dialog"
        aria-label={`Cross-reference encounter: ${crossRef.reference}`}
        data-testid="encounter-panel"
      >
        <header className="vv-encounter__header">
          <div className="vv-encounter__identity">
            {showPortrait ? (
              <img
                className="vv-portrait"
                src={`assets/portraits/${art.portraitKey}.png`}
                alt=""
                data-testid="encounter-portrait"
                onError={() => setPortraitBroken(true)}
              />
            ) : null}
            <div>
              <h2 className="vv-encounter__title">{crossRef.section} guide</h2>
              <p className="vv-encounter__reference" data-testid="encounter-reference">
                {crossRef.reference} · illuminating {crossRef.anchor}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="encounter-close"
            onClick={() => runtime.view.getState().closeEncounter()}
          >
            Close
          </button>
        </header>

        <p className="vv-placeholder-tag">
          Placeholder character. The six guide personas are not written yet.
        </p>

        <div className="vv-encounter__passage">
          <h3 className="vv-encounter__subhead">Passage</h3>
          <p className="vv-encounter__stub" data-testid="passage-slot">
            {passage?.status === "available"
              ? passage.text
              : (passage?.reason ?? "Loading passage…")}
          </p>
        </div>

        <div className="vv-encounter__note">
          <h3 className="vv-encounter__subhead">Curated note</h3>
          <p data-testid="encounter-note">{crossRef.note}</p>
        </div>

        <footer className="vv-encounter__footer">
          <p className="vv-encounter__state" data-testid="encounter-state">
            {STATE_LABELS[state] ?? state}
          </p>
          <p className="vv-placeholder-tag">
            The six-card selection that resolves this encounter arrives in a later phase.
          </p>
        </footer>
      </section>
    </div>
  );
}
