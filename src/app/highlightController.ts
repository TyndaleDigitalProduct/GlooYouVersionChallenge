// The "Highlight verse" button's action (PRD-10). Deliberately thin, and
// deliberately not part of encounterController.ts: capture never depends on
// a session (Design constraint 4) and is not part of the encounter's own
// state machine, so this is a separate, single-purpose action the Scripture
// card's button calls directly.
//
// Highlighting is a deliberate player action, not an automatic consequence of
// reading (this revises storyboard-v2.md item 7 and §4 step 7, which had
// tied the highlight to the read gate before this PRD existed to say
// otherwise). The local write happens unconditionally, every time, before
// this function ever looks at whether anyone is signed in — that ordering is
// what makes a sync failure recoverable by construction rather than by
// promise: the highlight this seam might fail to sync has already been
// written by the time the sync is even attempted.
import type { AppRuntime } from "./runtime";

/**
 * YouVersion's default highlight yellow. One colour for every highlight
 * (Decision 1, PRD-10 "Notes"): `highlights.ts` keeps its one-colour-per-
 * reference model unchanged, so the shared anchor DAN.1.1 is this colour in
 * both Scene 1 encounters regardless of which the player opens first. No
 * published hex swatch for YouVersion's own default yellow ships in
 * @youversion/platform-core; this is a standard highlighter yellow chosen as
 * the best-effort literal value for the operator's colour decision, easy to
 * swap here (the one place it is named) if YouVersion publishes their own.
 */
export const HIGHLIGHT_COLOR = "ffeb3b";

/**
 * Records a highlight locally (always) and, only if a session already
 * exists, fires an opt-in sync of that one highlight. The sync is
 * fire-and-forget from this function's point of view: `addHighlight` above
 * has already committed the local state by the time `syncOne` is even
 * called, so a rejected sync only ever produces a recoverable notice, never
 * a lost highlight.
 */
export function highlightPassage(runtime: AppRuntime, reference: string): void {
  runtime.store.getState().addHighlight(reference, HIGHLIGHT_COLOR);

  const session = runtime.session.current();
  if (!session) return;

  void runtime.highlightSync.syncOne(reference, HIGHLIGHT_COLOR).then((result) => {
    if (!result.ok) {
      // The player-facing notice is deliberately one message for every cause:
      // nothing they can do differs. The reason still has to reach *someone*,
      // though — `not-signed-in`, `bible-version-unresolved`, and
      // `highlight-sync-failed` are three quite different faults that were
      // previously indistinguishable from outside, which is why a seam that
      // could never resolve a version id read as an ordinary network blip.
      console.warn(`[highlight-sync] ${reference}: ${result.reason}`);
      runtime.view.getState().pushNotice({
        id: `highlight-sync-failed-${reference}`,
        tone: "warning",
        message:
          "This highlight is saved on this device, but could not sync to your YouVersion account right now.",
      });
    }
  });
}
