// The two CardProvider implementations (PRD-09), constructed in runtime.ts.
//
//   - createCardProvider() is the real one: it POSTs the encounter's authority
//     material to the server-side /api/generate-cards route and reads back a
//     generated six-card set or an explicit unavailable status. The Gloo call,
//     the credential, and the model all live behind that route — this side of
//     the seam is pure transport and never sees the key (that boundary is
//     asserted in glooCredentialBoundary.test.ts).
//   - createStubCardProvider() is the reviewed-fallback stand-in: it returns
//     the committed fallback set for the reference and carries isStub: true, so
//     with no Gloo credential configured every encounter still plays and the UI
//     can label the cards honestly. This is the same degradation a Gloo outage
//     takes in production, exercised on every run.
//
// Both mirror the ScriptureProvider discipline: every transport failure — a
// non-200, a network error, a timeout, a malformed body — resolves to
// `unavailable` rather than throwing, so a degraded generation is a value the
// controller handles, never an exception that reaches a player.
import type { CardSets } from "@/content/cardSets";
import { fallbackCardSetFor } from "@/content/cardSets";
import type { EncounterCard } from "@/core/encounters";
import { validateCardSet } from "@/core/encounters";
import type { CardGenerationRequest, CardProvider, CardSetResult } from "./providers";

/** The route the real provider posts to. Kept here so tests can override it. */
export const CARD_GENERATION_ENDPOINT = "/api/generate-cards";

/** Wall-clock ceiling on a single generation before it degrades to unavailable. */
export const CARD_GENERATION_TIMEOUT_MS = 30_000;

const CARD_UNAVAILABLE_REASON =
  "Insight cards could not be generated for this encounter, so a reviewed fallback set is used.";

/** Stable within a set and distinct from a fallback id, so provenance is legible. */
function generatedCardId(reference: string, index: number): string {
  return `${reference}:gen:${index}`;
}

/**
 * The subset of `fetch` this module needs. Narrowed to what is used so a test
 * can supply a hand-rolled implementation without constructing a whole
 * `Response`.
 */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/**
 * Reads a route body into a `CardSetResult`. Anything that is not a
 * well-formed generated set — wrong shape, a card that fails the shared
 * `validateCardSet` constraints — collapses to unavailable, so the model
 * having ignored the schema is caught here too rather than trusted. The route
 * already re-checks its own output; this is the same rule applied once more on
 * the far side of the wire, because the schema and `validateCardSet` are one
 * rule and must agree.
 */
function readGeneratedBody(reference: string, body: unknown): CardSetResult {
  if (typeof body !== "object" || body === null) {
    return { status: "unavailable", reference, reason: CARD_UNAVAILABLE_REASON };
  }

  const record = body as { status?: unknown; cards?: unknown };
  if (record.status === "unavailable") {
    return { status: "unavailable", reference, reason: CARD_UNAVAILABLE_REASON };
  }
  if (record.status !== "generated" || !Array.isArray(record.cards)) {
    return { status: "unavailable", reference, reason: CARD_UNAVAILABLE_REASON };
  }

  const cards: EncounterCard[] = [];
  for (const [index, raw] of record.cards.entries()) {
    if (typeof raw !== "object" || raw === null) {
      return { status: "unavailable", reference, reason: CARD_UNAVAILABLE_REASON };
    }
    const card = raw as { text?: unknown; value?: unknown };
    if (typeof card.text !== "string" || typeof card.value !== "number") {
      return { status: "unavailable", reference, reason: CARD_UNAVAILABLE_REASON };
    }
    cards.push({ id: generatedCardId(reference, index), text: card.text, value: card.value });
  }

  // The one-rule check: the schema the route generated against and this
  // validator must agree, so a set that slipped through malformed degrades
  // rather than reaching the store.
  const validation = validateCardSet(cards);
  if (!validation.ok) {
    return { status: "unavailable", reference, reason: CARD_UNAVAILABLE_REASON };
  }

  return { status: "generated", reference, cards };
}

export interface CreateCardProviderOptions {
  fetchImpl?: FetchLike;
  endpoint?: string;
  timeoutMs?: number;
}

/**
 * The real, Gloo-backed provider. It owns no credential: the key, base URL,
 * and model id are read only inside the route, and this side only knows the
 * route exists.
 */
export function createCardProvider(options: CreateCardProviderOptions = {}): CardProvider {
  const {
    // Evaluated lazily so a caller that injects a fetch never touches the
    // global at all, the same pattern runtime.ts uses for browser storage.
    fetchImpl = globalThis.fetch?.bind(globalThis) as FetchLike | undefined,
    endpoint = CARD_GENERATION_ENDPOINT,
    timeoutMs = CARD_GENERATION_TIMEOUT_MS,
  } = options;

  return {
    isStub: false,
    async generateCards(request: CardGenerationRequest): Promise<CardSetResult> {
      const unavailable: CardSetResult = {
        status: "unavailable",
        reference: request.reference,
        reason: CARD_UNAVAILABLE_REASON,
      };

      if (!fetchImpl) return unavailable;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        if (!response.ok) return unavailable;
        const body = await response.json();
        return readGeneratedBody(request.reference, body);
      } catch {
        // Network error, abort/timeout, or a body that would not parse: all
        // one outcome, never a thrown exception.
        return unavailable;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * The reviewed-fallback stub. Returns the committed set for the reference, or
 * unavailable when no fallback exists for it, and always carries isStub: true
 * so nothing downstream mistakes a fallback for model output.
 */
export function createStubCardProvider(cardSets: CardSets): CardProvider {
  return {
    isStub: true,
    generateCards(request: CardGenerationRequest): Promise<CardSetResult> {
      const fallback = fallbackCardSetFor(cardSets, request.reference);
      if (!fallback) {
        return Promise.resolve({
          status: "unavailable",
          reference: request.reference,
          reason: CARD_UNAVAILABLE_REASON,
        });
      }
      return Promise.resolve({
        status: "generated",
        reference: request.reference,
        cards: fallback.cards,
      });
    },
  };
}
