// The seams this app fakes or has faked, each a named interface. Everything
// still stubbed is faked here and nowhere else, and every implementation
// (stub or real) is constructed at exactly one composition point
// (runtime.ts). Replacing a stub with a real implementation touches that
// composition point and the new implementation only, which is why the
// Scripture stub is gone from this file as of PRD-08 phase 2 but the
// interface it implemented is not.
//
// PRD-04 also stubbed a third seam here, insight verdicts, for the free-text
// conversational mechanic ADR-0002 originally specified. ADR-0003 rejected
// that mechanic outright ("removed from the design, not deferred") in favour
// of card-selection encounters, so that stub is gone: there is no verdict
// left to fake. The card-generation seam it is replaced by belongs to
// PRD-09 (Gloo) and PRD-08 phase 3 (the card UI); phase 1 only lays down the
// persisted state those land on top of.
//
// Every stub carries `isStub: true` so the UI can label itself honestly. That
// flag is not decoration: an AI guide that looks real but is not would be a
// worse failure in this product than a visibly missing one.
import type { EncounterCard } from "@/core/encounters";
import type { Highlights } from "@/core/highlights";
import type { Result } from "@/core/result";
import { err } from "@/core/result";
import type { YouVersionSession } from "@/core/save";

// --- Scripture text -------------------------------------------------------
// PRD-04 shipped no Scripture text at all: not YouVersion, not the bundled
// WEB fallback, and certainly not model-generated text. PRD-08 phase 2
// commits the bundled WEB fallback and replaces the stub that used to live
// here with the real implementation in ./scriptureProvider.ts. The interface
// stays here and stays exactly this shape (async, an explicit `unavailable`
// status) so PRD-10 can swap in a YouVersion fetch without a signature
// change.

export type PassageResult =
  | { status: "available"; reference: string; translation: string; text: string }
  | { status: "unavailable"; reference: string; reason: string };

export interface ScriptureProvider {
  readonly isStub: boolean;
  getPassage(reference: string): Promise<PassageResult>;
}

// --- YouVersion session ---------------------------------------------------
// Sign-in is never required to play, so the slice runs signed out. The
// interface exists now purely so PRD-09 has a seam to fill; deliberately no
// token of any kind is modeled here, per the open question PRD-03 surfaced.

/**
 * What a successful `signIn()` resolves with: the persisted `yvpId` plus
 * display-only profile claims from the ID token (`name`/`picture`, present
 * only because the OAuth scope already requests `profile`). Neither field is
 * part of `YouVersionSession` and neither is ever written to the save blob —
 * they exist purely so the UI can confirm *whose* account just connected.
 */
export interface YouVersionSignInResult extends YouVersionSession {
  displayName?: string;
  avatarUrl?: string;
}

export interface SessionProvider {
  readonly isStub: boolean;
  current(): YouVersionSession | null;
  signIn(): Promise<Result<YouVersionSignInResult>>;
  signOut(): void;
}

export function createStubSessionProvider(): SessionProvider {
  return {
    isStub: true,
    current: () => null,
    signIn: () => Promise.resolve(err("youversion-sign-in-not-implemented")),
    signOut: () => undefined,
  };
}

// --- Insight card generation (PRD-09) -------------------------------------
// The card-generation seam. ADR-0003 makes a cross-reference encounter's six
// insight cards runtime output of Gloo, grounded in the curated note; PRD-09
// is the integration that produces them. This interface is the boundary the
// rest of the app sees, so the real Gloo-backed implementation
// (./cardProvider.ts, calling the /api route) and the reviewed-fallback stub
// are interchangeable without a signature change — the same discipline the
// Scripture seam above follows.
//
// There is no separate verdict seam: ADR-0003 rejected the free-text verdict
// mechanic outright, so PRD-04's `VerdictProvider` stub is gone rather than
// implemented, and this is the one seam the Gloo credential is spent on.

/**
 * The authority material a generation is grounded in, posted to the route as
 * the encounter's identity plus its Daniel passage, its cross-referenced
 * passage, and its curated note. The note is the authority (ADR-0003): the
 * model distributes a human-written claim across the cards and never decides
 * what is true of Scripture, so nothing here lets it override the note.
 */
export interface CardGenerationRequest {
  /** The cross-reference's USFM reference, e.g. "2KI.24.1-4". */
  reference: string;
  /** The Daniel verse this reference illuminates, e.g. "DAN.1.1". */
  anchor: string;
  /** Biblical section / guide persona grouping, e.g. "OT History". */
  section: string;
  /** The curated plain-language note — the authority for the correct cards. */
  note: string;
  /** The Daniel passage text, when the Scripture provider had it. */
  danielPassage?: string;
  /** The cross-referenced passage text, when the Scripture provider had it. */
  crossReferencePassage?: string;
}

/**
 * The client↔route contract, a discriminated union mirroring `PassageResult`:
 * a degraded generation is a value the caller handles, never an exception it
 * catches. `generated` cards have already passed `validateCardSet`; on
 * `unavailable` the caller degrades to the reviewed fallback set and the UI
 * says so.
 */
export type CardSetResult =
  | { status: "generated"; reference: string; cards: readonly EncounterCard[] }
  | { status: "unavailable"; reference: string; reason: string };

export interface CardProvider {
  readonly isStub: boolean;
  generateCards(request: CardGenerationRequest): Promise<CardSetResult>;
}

// --- Highlight sync (PRD-10) -----------------------------------------------
// Capture is unconditional and local-only: src/core/highlights.ts takes no
// session parameter, by design, and that does not change here (Design
// constraint 4). This seam is the opt-in layer on top of capture, never a
// replacement for it — by the time either method below is called, the
// highlight this PRD cares about has already been written locally, so a sync
// failure is recoverable and never loses it. `syncAll` is what a mid-game
// sign-in calls, to push everything already accumulated rather than only
// capturing from that point on; `syncOne` is the common case, a single new
// "Highlight verse" tap while already signed in.
export interface HighlightSyncProvider {
  readonly isStub: boolean;
  syncAll(highlights: Highlights): Promise<Result<{ synced: number }>>;
  syncOne(reference: string, color: string): Promise<Result<void>>;
}
