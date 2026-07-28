// The three seams PRD-04 stubs, each a named interface with a deterministic
// stub implementation. Everything the slice fakes is faked here and nowhere
// else, and all three are constructed at exactly one composition point
// (runtime.ts). Replacing a stub with a real implementation in a later PRD
// touches that composition point and the new implementation only.
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

// --- Insight verdicts -----------------------------------------------------
// ADR-0002 puts the real verdict behind a grounded, streamed model call. The
// stub is deterministic and always recognises the connection, so the reward
// path is exercisable without a model, and it never pretends to have read
// anything the player wrote.

export interface VerdictRequest {
  sceneId: string;
  reference: string;
  section: string;
  note: string;
}

export interface Verdict {
  recognised: boolean;
  message: string;
}

export interface VerdictProvider {
  readonly isStub: boolean;
  evaluate(request: VerdictRequest): Promise<Verdict>;
}

export const STUB_VERDICT_MESSAGE =
  "Stub verdict: no AI guide is running in this build. Nothing was read or judged, and the bonus stone was awarded automatically so the reward path can be exercised.";

export function createStubVerdictProvider(): VerdictProvider {
  return {
    isStub: true,
    evaluate() {
      return Promise.resolve({ recognised: true, message: STUB_VERDICT_MESSAGE });
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
