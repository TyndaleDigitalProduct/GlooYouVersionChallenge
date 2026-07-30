import { describe, expect, it } from "vitest";
import { createInMemoryStorage } from "@/core/fixtures";
import { characterReference, lamplighterReference } from "@/game/worldMarkers";
import { createAppRuntime } from "./runtime";
import { openWorldInteraction } from "./worldInteractions";

function boot() {
  const result = createAppRuntime({ storage: createInMemoryStorage(), saveKey: "test:world" });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("openWorldInteraction (PRD-12: routes a resolved click by reference kind)", () => {
  it("opens the Lamplighter exit panel for a Lamplighter reference", () => {
    const runtime = boot();

    openWorldInteraction(runtime, lamplighterReference("scene-1"));

    expect(runtime.view.getState().openLamplighterSceneId).toBe("scene-1");
    expect(runtime.view.getState().openEncounterReference).toBeNull();
    expect(runtime.view.getState().openCharacterReference).toBeNull();
  });

  it("opens the character dialogue panel for a character reference", () => {
    const runtime = boot();

    openWorldInteraction(runtime, characterReference("scene-1", "daniel"));

    expect(runtime.view.getState().openCharacterReference).toEqual({
      sceneId: "scene-1",
      characterId: "daniel",
    });
    expect(runtime.view.getState().openEncounterReference).toBeNull();
    expect(runtime.view.getState().openLamplighterSceneId).toBeNull();
  });

  it("falls through to openEncounter for any other reference, unchanged from PRD-08", () => {
    const runtime = boot();

    openWorldInteraction(runtime, "2KI.24.1-4");

    expect(runtime.view.getState().openEncounterReference).toBe("2KI.24.1-4");
    expect(runtime.store.getState().encounters["scene-1::2KI.24.1-4"]?.state).toBe("engaged");
  });
});
