import { beforeEach, describe, expect, it } from "vitest";
import { buildCardSets } from "@/content/cardSets";
import type { EncounterCard } from "@/core/encounters";
import { createInMemoryStorage } from "@/core/fixtures";
import type { Storage as CoreStorage } from "@/core/storage";
import rawCardsDocument from "../../content/daniel-1.cards.json";
import { createStubCardProvider } from "./cardProvider";
import { openEncounter } from "./encounterController";
import type { CardProvider } from "./providers";
import { createAppRuntime } from "./runtime";
import { cardsAreFallback } from "./viewStore";

const KEY = "test:encounter-controller";
const REF = "2KI.24.1-4";

/** The reviewed-fallback stub, built from the real content, for deterministic runs. */
function stubCards(): CardProvider {
  const cardSets = buildCardSets(rawCardsDocument);
  if (!cardSets.ok) throw new Error(`card sets failed to build: ${cardSets.reason}`);
  return createStubCardProvider(cardSets.value);
}

function boot(storage: CoreStorage = createInMemoryStorage(), cards: CardProvider = stubCards()) {
  const result = createAppRuntime({ storage, saveKey: KEY, cards });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("openEncounter: card generation through the provider seam", () => {
  let runtime: ReturnType<typeof boot>;

  beforeEach(() => {
    runtime = boot();
  });

  it("generates the encounter's six-card set from the stub fallback on first open", async () => {
    await openEncounter(runtime, REF);

    const record = runtime.store.getState().encounters[`scene-1::${REF}`];
    expect(record?.cards).toHaveLength(6);
    expect(record?.cards?.[0]?.text).toContain("God's judgment");
  });

  it("marks a stub-provided set as fallback so the UI does not call it model output", async () => {
    await openEncounter(runtime, REF);

    expect(cardsAreFallback(runtime.view.getState(), REF)).toBe(true);
  });

  it("does not regenerate cards, or push a notice, on a second open", async () => {
    await openEncounter(runtime, REF);
    const firstCards = runtime.store.getState().encounters[`scene-1::${REF}`]?.cards;

    runtime.view.getState().closeEncounter();
    await openEncounter(runtime, REF);

    const secondCards = runtime.store.getState().encounters[`scene-1::${REF}`]?.cards;
    expect(secondCards).toEqual(firstCards);
    expect(runtime.view.getState().notices).toEqual([]);
  });

  it("does not persist cards across two runtimes booted on the same storage as a fresh generation", async () => {
    const storage = createInMemoryStorage();
    const first = boot(storage);
    await openEncounter(first, REF);

    const second = boot(storage);
    await openEncounter(second, REF);

    expect(second.view.getState().notices).toEqual([]);
    expect(second.store.getState().encounters[`scene-1::${REF}`]?.cards).toEqual(
      first.store.getState().encounters[`scene-1::${REF}`]?.cards,
    );
  });
});

describe("openEncounter: degrading and honouring a live generation", () => {
  it("degrades to the reviewed fallback, and marks it, when the provider is unavailable", async () => {
    const unavailableProvider: CardProvider = {
      isStub: false,
      generateCards: (request) =>
        Promise.resolve({ status: "unavailable", reference: request.reference, reason: "outage" }),
    };
    const runtime = boot(createInMemoryStorage(), unavailableProvider);

    await openEncounter(runtime, REF);

    const record = runtime.store.getState().encounters[`scene-1::${REF}`];
    // Still fully playable: the encounter has its six-card set (the reviewed
    // fallback), and it is marked so the UI will not pretend it is model output.
    expect(record?.cards).toHaveLength(6);
    expect(cardsAreFallback(runtime.view.getState(), REF)).toBe(true);
    expect(runtime.view.getState().notices).toEqual([]);
  });

  it("persists a genuine generated set without marking it as fallback", async () => {
    const generated: EncounterCard[] = [
      { id: `${REF}:gen:0`, text: "Live insight one", value: 5 },
      { id: `${REF}:gen:1`, text: "Live insight two", value: 4 },
      { id: `${REF}:gen:2`, text: "Live insight three", value: 3 },
      { id: `${REF}:gen:3`, text: "Live distractor one", value: 0 },
      { id: `${REF}:gen:4`, text: "Live distractor two", value: 0 },
      { id: `${REF}:gen:5`, text: "Live insight four", value: 2 },
    ];
    const liveProvider: CardProvider = {
      isStub: false,
      generateCards: (request) =>
        Promise.resolve({ status: "generated", reference: request.reference, cards: generated }),
    };
    const runtime = boot(createInMemoryStorage(), liveProvider);

    await openEncounter(runtime, REF);

    const record = runtime.store.getState().encounters[`scene-1::${REF}`];
    expect(record?.cards).toEqual(generated);
    expect(cardsAreFallback(runtime.view.getState(), REF)).toBe(false);
  });
});
