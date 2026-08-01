import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { ChapterMapScreen } from "./ChapterMapScreen";
import { RuntimeProvider } from "./RuntimeContext";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:chapter-map",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

function renderMap(runtime = boot()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <ChapterMapScreen />
    </RuntimeProvider>,
  );
  return runtime;
}

function scene(ordinal: number) {
  return screen.getByTestId(`chapter-scene-${ordinal}`);
}

describe("ChapterMapScreen (PRD-13 phase 5)", () => {
  it("renders nothing until it is opened", () => {
    renderMap();
    expect(screen.queryByTestId("chapter-map")).not.toBeInTheDocument();
  });

  it("shows all nine scenes of Daniel 1 with their passages and settings", () => {
    const runtime = boot();
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    for (const ordinal of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
      expect(scene(ordinal)).toBeInTheDocument();
    }
    expect(scene(1)).toHaveTextContent("Daniel 1:1");
    expect(scene(1)).toHaveTextContent("Jerusalem under siege");
    expect(scene(9)).toHaveTextContent("Daniel 1:20-21");
  });

  it("carries each state in words as well as in colour: locked, current, closed", () => {
    const runtime = boot();
    runtime.store.getState().completeScene("scene-1");
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    expect(scene(1)).toHaveAttribute("data-state", "complete");
    expect(scene(1)).toHaveTextContent("Closed");
    expect(scene(2)).toHaveAttribute("data-state", "current");
    expect(scene(2)).toHaveTextContent("Current");
    expect(scene(3)).toHaveAttribute("data-state", "locked");
    expect(scene(3)).toHaveTextContent("Locked");
  });

  it("marks the room the player is standing in", () => {
    const runtime = boot();
    runtime.store.getState().completeScene("scene-1");
    runtime.view.getState().enterRoom("scene-2");
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    expect(within(scene(2)).getByTestId("chapter-scene-here")).toBeInTheDocument();
    expect(within(scene(1)).queryByTestId("chapter-scene-here")).not.toBeInTheDocument();
  });

  it("offers a way in only for a scene that is unlocked, and calls a finished one a revisit", () => {
    const runtime = boot();
    runtime.store.getState().completeScene("scene-1");
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    expect(screen.getByTestId("chapter-scene-enter-1")).toHaveTextContent("Revisit");
    expect(screen.getByTestId("chapter-scene-enter-2")).toHaveTextContent("Enter");
    // A locked scene has no control at all rather than a dead one.
    expect(screen.queryByTestId("chapter-scene-enter-3")).not.toBeInTheDocument();
  });

  it("re-entering a completed scene fades there and awards nothing", async () => {
    // PRD-13: a completed scene can be re-entered, and re-entering must not
    // re-award stones. The transition path never calls `completeScene` at all, so
    // there is nothing to be idempotent about.
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().completeScene("scene-1");
    runtime.store.getState().completeScene("scene-2");
    runtime.view.getState().enterRoom("scene-3");
    const ledgerBefore = runtime.store.getState().ledger.length;
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    await user.click(screen.getByTestId("chapter-scene-enter-1"));

    expect(runtime.view.getState().sceneTransition).toMatchObject({
      fromSceneId: "scene-3",
      toSceneId: "scene-1",
      stage: "out",
    });
    expect(runtime.view.getState().chapterMapOpen).toBe(false);
    expect(runtime.view.getState().phase).toBe("playing");
    expect(runtime.store.getState().ledger).toHaveLength(ledgerBefore);
  });

  it("entering the room already on screen just closes the map, with no fade", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().enterRoom("scene-1");
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    await user.click(screen.getByTestId("chapter-scene-enter-1"));

    expect(runtime.view.getState().sceneTransition).toBeNull();
    expect(runtime.view.getState().chapterMapOpen).toBe(false);
    expect(runtime.view.getState().phase).toBe("playing");
  });

  it("summarises chapter progress: scenes closed, references resolved, stones", () => {
    const runtime = boot();
    runtime.store.getState().engageEncounter("scene-1", "2KI.24.1-4");
    runtime.store.getState().completeScene("scene-1");
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    const summary = screen.getByTestId("chapter-map-summary");
    expect(summary).toHaveTextContent("1 of 9 scenes closed");
    expect(summary).toHaveTextContent("0 of 24 references resolved");
    expect(summary).toHaveTextContent("6 Vale Stones");
  });

  it("says the chapter is closed once every scene is, rather than 9 of 9", () => {
    const runtime = boot();
    for (const entry of runtime.content.scenes) runtime.store.getState().completeScene(entry.id);
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    expect(screen.getByTestId("chapter-map-summary")).toHaveTextContent("Every scene closed");
    for (const ordinal of [1, 5, 9]) {
      expect(scene(ordinal)).toHaveAttribute("data-state", "complete");
      expect(screen.getByTestId(`chapter-scene-enter-${ordinal}`)).toBeInTheDocument();
    }
  });

  it("closes back to whatever was underneath, without touching the phase", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openChapterMap();
    renderMap(runtime);

    await user.click(screen.getByTestId("chapter-map-close"));

    expect(runtime.view.getState().chapterMapOpen).toBe(false);
    expect(runtime.view.getState().phase).toBe("home");
  });
});
