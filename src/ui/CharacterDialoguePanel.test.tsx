import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { CharacterDialoguePanel } from "./CharacterDialoguePanel";
import { RuntimeProvider } from "./RuntimeContext";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:character-dialogue",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

function renderPanel(runtime = boot()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <CharacterDialoguePanel />
    </RuntimeProvider>,
  );
  return runtime;
}

describe("CharacterDialoguePanel (PRD-12)", () => {
  it("renders nothing when no character panel is open", () => {
    renderPanel();
    expect(screen.queryByTestId("character-dialogue-panel")).not.toBeInTheDocument();
  });

  it("shows the first beat of the opened character's lines", () => {
    const runtime = boot();
    runtime.view.getState().openCharacter("scene-1", "daniel");
    renderPanel(runtime);

    expect(screen.getByTestId("character-dialogue-speaker")).toHaveTextContent("Daniel");
    expect(screen.getByTestId("character-dialogue-text")).toHaveTextContent(
      "The watchmen say the army stretches past the horizon.",
    );
    expect(screen.getByTestId("character-dialogue-advance")).toHaveTextContent("Continue");
  });

  it("advances through every beat with no scoring and no read gate, then closes", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openCharacter("scene-1", "daniel");
    renderPanel(runtime);

    await user.click(screen.getByTestId("character-dialogue-advance"));
    expect(screen.getByTestId("character-dialogue-text")).toHaveTextContent(
      'My father named me "God is my judge."',
    );
    expect(screen.getByTestId("character-dialogue-advance")).toHaveTextContent("Close");

    await user.click(screen.getByTestId("character-dialogue-advance"));

    expect(screen.queryByTestId("character-dialogue-panel")).not.toBeInTheDocument();
    // No ledger entry of any kind was ever created for talking to a story character.
    expect(runtime.store.getState().ledger).toEqual([]);
  });

  it("has no separate header Close: the beat button is the only exit (PRD-14)", () => {
    // The persistent top-right Close was removed by operator request: the
    // bottom-right button (Continue -> Close on the last beat) is the one
    // exit path, and a mis-click costs at most a couple of short lines.
    const runtime = boot();
    runtime.view.getState().openCharacter("scene-1", "daniel");
    renderPanel(runtime);

    expect(screen.queryByTestId("character-dialogue-close")).not.toBeInTheDocument();
  });

  it("shows Close immediately for an NPC's single beat", () => {
    const runtime = boot();
    runtime.view.getState().openCharacter("scene-1", "a-mother");
    renderPanel(runtime);

    expect(screen.getByTestId("character-dialogue-advance")).toHaveTextContent("Close");
  });

  it("re-opening the same character replays from the first beat rather than resuming or no-oping", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openCharacter("scene-1", "daniel");
    renderPanel(runtime);

    await user.click(screen.getByTestId("character-dialogue-advance"));
    await user.click(screen.getByTestId("character-dialogue-advance"));
    expect(screen.queryByTestId("character-dialogue-panel")).not.toBeInTheDocument();

    runtime.view.getState().openCharacter("scene-1", "daniel");
    expect(await screen.findByTestId("character-dialogue-text")).toHaveTextContent(
      "The watchmen say the army stretches past the horizon.",
    );
  });

  it("opens an NPC the same way as a story character, by its derived characterId", () => {
    const runtime = boot();
    // "A mother" -> "a-mother" (characterIdFor, src/content/loadContent.ts).
    runtime.view.getState().openCharacter("scene-1", "a-mother");
    renderPanel(runtime);

    expect(screen.getByTestId("character-dialogue-speaker")).toHaveTextContent("A mother");
  });
});
