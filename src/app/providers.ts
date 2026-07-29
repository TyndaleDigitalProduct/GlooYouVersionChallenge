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
import type { Result } from "@/core/result";
import { err } from "@/core/result";
import type { YouVersionSession } from "@/core/save";

// --- Scripture text -------------------------------------------------------
// PRD-04 shipped no Scripture text at all: not YouVersion, not the bundled
// WEB fallback, and certainly not model-generated text. PRD-08 phase 2
// commits the bundled WEB fallback and replaces the stub that used to live
// here with the real implementation in ./scriptureProvider.ts. The interface
// stays here and stays exactly this shape (async, an explicit `unavailable`
// status) so PRD-09 can swap in a YouVersion fetch without a signature
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
