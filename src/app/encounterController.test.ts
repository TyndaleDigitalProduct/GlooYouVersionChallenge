import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryStorage } from "@/core/fixtures";
import type { Storage as CoreStorage } from "@/core/storage";
import { openEncounter } from "./encounterController";
import { createAppRuntime } from "./runtime";

const KEY = "test:encounter-controller";

function boot(storage: CoreStorage = createInMemoryStorage()) {
  const result = createAppRuntime({ storage, saveKey: KEY });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("openEncounter: fallback card generation", () => {
  let runtime: ReturnType<typeof boot>;

  beforeEach(() => {
    runtime = boot();
  });

  it("generates the encounter's six-card set from the fallback content on first open", () => {
    openEncounter(runtime, "2KI.24.1-4");

    const record = runtime.store.getState().encounters["scene-1::2KI.24.1-4"];
    expect(record?.cards).toHaveLength(6);
    expect(record?.cards?.[0]?.text).toContain("God's judgment");
  });

  it("does not regenerate cards, or push a notice, on a second open", () => {
    openEncounter(runtime, "2KI.24.1-4");
    const firstCards = runtime.store.getState().encounters["scene-1::2KI.24.1-4"]?.cards;

    runtime.view.getState().closeEncounter();
    openEncounter(runtime, "2KI.24.1-4");

    const secondCards = runtime.store.getState().encounters["scene-1::2KI.24.1-4"]?.cards;
    expect(secondCards).toEqual(firstCards);
    expect(runtime.view.getState().notices).toEqual([]);
  });

  it("does not persist cards across two runtimes booted on the same storage as a fresh generation", () => {
    const storage = createInMemoryStorage();
    const first = boot(storage);
    openEncounter(first, "2KI.24.1-4");

    const second = boot(storage);
    openEncounter(second, "2KI.24.1-4");

    expect(second.view.getState().notices).toEqual([]);
    expect(second.store.getState().encounters["scene-1::2KI.24.1-4"]?.cards).toEqual(
      first.store.getState().encounters["scene-1::2KI.24.1-4"]?.cards,
    );
  });
});
