// PRD-17: the prompt names the guide the player is standing next to, in the
// persona's own name ("the Chronicler"), not the generic section title
// ("the OT History guide"), and shows the reference the way a person says it.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { ProximityPrompt } from "./ProximityPrompt";
import { RuntimeProvider } from "./RuntimeContext";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:proximity-prompt",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("ProximityPrompt copy (PRD-17)", () => {
  it("names the persona, not the section, and says the reference like a person", () => {
    const runtime = boot();
    runtime.view.getState().setNearbyReference("2KI.24.1-4");

    render(
      <RuntimeProvider runtime={runtime}>
        <ProximityPrompt />
      </RuntimeProvider>,
    );

    const prompt = screen.getByTestId("proximity-prompt");
    expect(prompt).toHaveTextContent("Speak with the Chronicler about 2 Kings 24:1-4");
    expect(prompt).not.toHaveTextContent("OT History");
    expect(prompt).not.toHaveTextContent("2KI.24.1-4");
  });

  it("reads naturally for a persona whose name carries no article", () => {
    const runtime = boot();
    // Lady Wisdom's encounter (OT Poetry/Wisdom), PRO.2.6, scene 3.
    runtime.view.getState().setNearbyReference("PRO.2.6");

    render(
      <RuntimeProvider runtime={runtime}>
        <ProximityPrompt />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("proximity-prompt")).toHaveTextContent(
      "Speak with Lady Wisdom about Proverbs 2:6",
    );
  });
});
