import { describe, expect, it } from "vitest";
import { buildCardSets } from "@/content/cardSets";
import rawCardsDocument from "../../content/daniel-1.cards.json";
import { createCardProvider, createStubCardProvider, type FetchLike } from "./cardProvider";
import type { CardGenerationRequest } from "./providers";

const REQUEST: CardGenerationRequest = {
  reference: "2KI.24.1-4",
  anchor: "DAN.1.1",
  section: "OT History",
  note: "A curated note.",
};

/** A valid generated body: six cards, one distractor, three-plus correct, unique text. */
const VALID_BODY = {
  status: "generated",
  cards: [
    { text: "one", value: 5 },
    { text: "two", value: 4 },
    { text: "three", value: 3 },
    { text: "four", value: 0 },
    { text: "five", value: 0 },
    { text: "six", value: 1 },
  ],
};

function fetchReturning(body: unknown, ok = true, status = 200): FetchLike {
  return () => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
}

describe("createStubCardProvider (the reviewed-fallback stand-in)", () => {
  function stub() {
    const cardSets = buildCardSets(rawCardsDocument);
    if (!cardSets.ok) throw new Error(cardSets.reason);
    return createStubCardProvider(cardSets.value);
  }

  it("carries isStub honestly", () => {
    expect(stub().isStub).toBe(true);
  });

  it("returns the committed fallback six-card set for a known reference", async () => {
    const result = await stub().generateCards(REQUEST);

    expect(result.status).toBe("generated");
    if (result.status === "generated") expect(result.cards).toHaveLength(6);
  });

  it("returns unavailable when no fallback exists for the reference", async () => {
    const result = await stub().generateCards({ ...REQUEST, reference: "NONE.9.9" });

    expect(result.status).toBe("unavailable");
  });
});

describe("createCardProvider (the real, route-calling provider)", () => {
  it("carries isStub: false", () => {
    expect(createCardProvider({ fetchImpl: fetchReturning(VALID_BODY) }).isStub).toBe(false);
  });

  it("returns a generated set with stable ids on a well-formed body", async () => {
    const provider = createCardProvider({ fetchImpl: fetchReturning(VALID_BODY) });

    const result = await provider.generateCards(REQUEST);

    expect(result.status).toBe("generated");
    if (result.status === "generated") {
      expect(result.cards).toHaveLength(6);
      expect(result.cards[0]).toEqual({ id: "2KI.24.1-4:gen:0", text: "one", value: 5 });
    }
  });

  it("resolves to unavailable on a non-200 response, never throwing", async () => {
    const provider = createCardProvider({ fetchImpl: fetchReturning(VALID_BODY, false, 503) });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("resolves to unavailable on a network error", async () => {
    const provider = createCardProvider({
      fetchImpl: () => Promise.reject(new Error("network down")),
    });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("resolves to unavailable on a malformed (unparseable) body", async () => {
    const provider = createCardProvider({
      fetchImpl: () =>
        Promise.resolve({ ok: true, status: 200, json: () => Promise.reject(new Error("bad")) }),
    });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("resolves to unavailable when the route reports unavailable", async () => {
    const provider = createCardProvider({
      fetchImpl: fetchReturning({ status: "unavailable", reason: "no-credential" }),
    });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("re-validates the body and degrades a set that violates the shared card rule", async () => {
    // Six cards but all valued 0: passes JSON shape, fails validateCardSet
    // (no card above 0). The schema and validateCardSet are one rule, so this
    // is caught on the client side too rather than reaching the store.
    const provider = createCardProvider({
      fetchImpl: fetchReturning({
        status: "generated",
        cards: Array.from({ length: 6 }, (_, i) => ({ text: `c${i}`, value: 0 })),
      }),
    });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("resolves to unavailable when cards is not an array", async () => {
    const provider = createCardProvider({
      fetchImpl: fetchReturning({ status: "generated", cards: "nope" }),
    });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });

  it("resolves to unavailable when no fetch implementation is available", async () => {
    const provider = createCardProvider({ fetchImpl: undefined });

    await expect(provider.generateCards(REQUEST)).resolves.toMatchObject({
      status: "unavailable",
    });
  });
});
