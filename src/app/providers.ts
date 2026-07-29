// The seams this slice stubs, each a named interface with a deterministic
// stub implementation. Everything the slice fakes is faked here and nowhere
// else, and every stub is constructed at exactly one composition point
// (runtime.ts). Replacing a stub with a real implementation in a later PRD
// touches that composition point and the new implementation only.
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
import type { Result } from "@/core/result";
import { err } from "@/core/result";
import type { YouVersionSession } from "@/core/save";

// --- Scripture text -------------------------------------------------------
// PRD-04 ships no Scripture text at all: not YouVersion, not the bundled WEB
// fallback, and certainly not model-generated text. The stub says so, and the
// UI renders the reason where passage text will eventually go.

export type PassageResult =
  | { status: "available"; reference: string; translation: string; text: string }
  | { status: "unavailable"; reference: string; reason: string };

export interface ScriptureProvider {
  readonly isStub: boolean;
  getPassage(reference: string): Promise<PassageResult>;
}

export const PASSAGE_UNAVAILABLE_REASON =
  "Passage text is not wired up in this build. Real Scripture text arrives in a later PRD.";

export function createStubScriptureProvider(): ScriptureProvider {
  return {
    isStub: true,
    getPassage(reference) {
      return Promise.resolve({
        status: "unavailable",
        reference,
        reason: PASSAGE_UNAVAILABLE_REASON,
      });
    },
  };
}

// --- YouVersion session ---------------------------------------------------
// Sign-in is never required to play, so the slice runs signed out. The
// interface exists now purely so PRD-09 has a seam to fill; deliberately no
// token of any kind is modeled here, per the open question PRD-03 surfaced.

export interface SessionProvider {
  readonly isStub: boolean;
  current(): YouVersionSession | null;
  signIn(): Promise<Result<YouVersionSession>>;
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
