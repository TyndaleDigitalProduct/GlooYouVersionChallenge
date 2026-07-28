// The two encounter actions, kept out of the components so they are testable
// without a DOM and so no React component ever decides what a stone is worth.
// Both are thin: every rule they rely on lives in src/core.
import { findCrossReferenceContent } from "@/content/loadContent";
import type { AppRuntime } from "./runtime";

/**
 * Opens an encounter panel and engages the encounter. Engagement is
 * idempotent in src/core, so re-opening an already-engaged encounter awards
 * nothing further; the panel reads the resulting state and says so.
 */
export function openEncounter(runtime: AppRuntime, reference: string): void {
  const crossRef = findCrossReferenceContent(runtime.content, reference);
  if (!crossRef) {
    runtime.view.getState().pushNotice({
      id: `encounter-unknown-${reference}`,
      tone: "error",
      message: `No curated cross-reference is loaded for ${reference}.`,
    });
    return;
  }

  const result = runtime.store.getState().engageEncounter(crossRef.sceneId, reference);
  if (!result.ok) {
    runtime.view.getState().pushNotice({
      id: `encounter-rejected-${reference}`,
      tone: "error",
      message: `This encounter could not be opened (${result.reason}).`,
    });
    return;
  }

  runtime.view.getState().openEncounter(reference);
}

/**
 * Asks the verdict provider whether the player recognised the connection, and
 * awards the bonus stone if it says yes. In this slice the provider is a
 * deterministic stub that always says yes and says so in its message.
 */
export async function requestVerdict(runtime: AppRuntime, reference: string): Promise<void> {
  const crossRef = findCrossReferenceContent(runtime.content, reference);
  if (!crossRef) return;

  runtime.view.getState().setVerdictPending(true);

  try {
    const verdict = await runtime.verdicts.evaluate({
      sceneId: crossRef.sceneId,
      reference,
      section: crossRef.section,
      note: crossRef.note,
    });

    if (verdict.recognised) {
      const result = runtime.store.getState().recogniseInsight(crossRef.sceneId, reference);
      if (!result.ok) {
        runtime.view.getState().pushNotice({
          id: `insight-rejected-${reference}`,
          tone: "error",
          message: `The bonus stone could not be awarded (${result.reason}).`,
        });
      }
    }

    runtime.view.getState().setVerdict({ reference, message: verdict.message });
  } finally {
    runtime.view.getState().setVerdictPending(false);
  }
}
