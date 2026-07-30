import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { ChapterCompleteScreen } from "./ChapterCompleteScreen";
import { RuntimeProvider } from "./RuntimeContext";

function bootFinished() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:chapter-complete",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  const runtime = result.value;
  runtime.store.getState().setPlayerName("Ezra");
  runtime.store.getState().engageEncounter("scene-1", "2KI.24.1-4");
  for (const scene of runtime.content.scenes) runtime.store.getState().completeScene(scene.id);
  // How the player actually gets here: the Lamplighter's "Close the chapter" on
  // scene 9, or Continue on a finished save.
  runtime.view.getState().showChapterComplete();
  return runtime;
}

function renderScreen(runtime = bootFinished()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <ChapterCompleteScreen />
    </RuntimeProvider>,
  );
  return runtime;
}

describe("ChapterCompleteScreen (PRD-13 phase 5)", () => {
  it("names what the player finished, end to end, rather than just saying 'complete'", () => {
    const runtime = bootFinished();
    expect(runtime.store.getState().isGameComplete()).toBe(true);
    renderScreen(runtime);

    const screen_ = screen.getByTestId("chapter-complete");
    expect(screen_).toHaveTextContent("Ezra");
    expect(screen_).toHaveTextContent("DAN.1.1");
    expect(screen_).toHaveTextContent("DAN.1.20-21");
  });

  it("tallies scenes, cross-references, and stones", () => {
    const runtime = bootFinished();
    renderScreen(runtime);

    const tally = screen.getByTestId("chapter-complete-tally");
    expect(tally).toHaveTextContent("9 of 9 scenes closed");
    expect(tally).toHaveTextContent("0 of 24 cross-references resolved");
    expect(tally).toHaveTextContent(`${runtime.store.getState().balance()} Vale Stones gathered`);
  });

  it("offers the chapter map, which is the way back into any finished scene", async () => {
    const user = userEvent.setup();
    const runtime = renderScreen();

    await user.click(screen.getByTestId("complete-open-chapter-map"));

    expect(runtime.view.getState().chapterMapOpen).toBe(true);
    // Still the end state underneath: closing the map returns here, not home.
    expect(runtime.view.getState().phase).toBe("complete");
  });

  it("also lets the player back into the world, rather than only out of it", async () => {
    const user = userEvent.setup();
    const runtime = renderScreen();

    await user.click(screen.getByTestId("complete-return-to-world"));

    expect(runtime.view.getState().phase).toBe("playing");
  });
});
