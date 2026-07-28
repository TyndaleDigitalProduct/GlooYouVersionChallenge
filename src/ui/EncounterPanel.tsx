import { useEffect, useState } from "react";
import { requestVerdict } from "@/app/encounterController";
import type { PassageResult } from "@/app/providers";
import { findCrossReferenceContent } from "@/content/loadContent";
import { encounterState } from "@/core/encounters";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";

const STATE_LABELS: Record<string, string> = {
  unvisited: "Not yet engaged",
  engaged: "Engaged · base stone awarded",
  "insight-recognised": "Insight recognised · bonus stone awarded",
};

export function EncounterPanel() {
  const openReference = useViewState((state) => state.openEncounterReference);
  if (!openReference) return null;
  return <EncounterPanelBody key={openReference} reference={openReference} />;
}

/**
 * One cross-reference encounter.
 *
 * The curated note is real content. Everything else that would carry meaning
 * is stubbed and labelled: there is no passage text, and the verdict comes
 * from a deterministic stub rather than a guide. The panel says so in both
 * places, because an AI guide that looks real but is not would be a worse
 * failure in this product than a visibly absent one.
 */
function EncounterPanelBody({ reference }: { reference: string }) {
  const runtime = useRuntime();
  const crossRef = findCrossReferenceContent(runtime.content, reference);
  const sceneId = crossRef?.sceneId ?? "";

  const state = useGameState((store) => encounterState(store.encounters, sceneId, reference));
  const verdictPending = useViewState((view) => view.verdictPending);
  const verdictMessage = useViewState((view) =>
    view.verdict?.reference === reference ? view.verdict.message : null,
  );

  const [passage, setPassage] = useState<PassageResult | null>(null);

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

  const alreadyRecognised = state === "insight-recognised";

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-encounter"
        role="dialog"
        aria-label={`Cross-reference encounter: ${crossRef.reference}`}
        data-testid="encounter-panel"
      >
        <header className="vv-encounter__header">
          <div>
            <h2 className="vv-encounter__title">{crossRef.section} guide</h2>
            <p className="vv-encounter__reference" data-testid="encounter-reference">
              {crossRef.reference} · illuminating {crossRef.anchor}
            </p>
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

          <button
            type="button"
            className="vv-button"
            data-testid="recognise-button"
            disabled={verdictPending || alreadyRecognised}
            onClick={() => void requestVerdict(runtime, reference)}
          >
            {alreadyRecognised
              ? "Connection already recognised"
              : verdictPending
                ? "Checking…"
                : "Recognise the connection (stubbed)"}
          </button>

          {verdictMessage ? (
            <p className="vv-encounter__stub" data-testid="verdict-message">
              {verdictMessage}
            </p>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
