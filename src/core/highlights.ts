// Highlights: a USFM reference plus a colour. Storable with no YouVersion
// session present (sign-in is never required to play) — note there is no
// session parameter anywhere in this module.
//
// DECISION (see PRD-03 handoff): a reference carries at most one colour at a
// time. Adding a new colour for an already-highlighted reference replaces the
// old one rather than layering a second colour underneath it. This mirrors
// how a single verse is highlighted in most Bible-reading apps and keeps the
// model a simple reference -> colour map. Flagged as possibly warranting a
// product decision / ADR rather than being purely an implementation detail.
export type Highlights = Record<string, string>;

export interface HighlightMutationOutcome {
  highlights: Highlights;
  changed: boolean;
}

export function addHighlight(
  highlights: Highlights,
  reference: string,
  color: string,
): HighlightMutationOutcome {
  if (highlights[reference] === color) {
    return { highlights, changed: false };
  }
  return { highlights: { ...highlights, [reference]: color }, changed: true };
}

export function removeHighlight(
  highlights: Highlights,
  reference: string,
): HighlightMutationOutcome {
  if (!(reference in highlights)) {
    return { highlights, changed: false };
  }
  const next = { ...highlights };
  delete next[reference];
  return { highlights: next, changed: true };
}
