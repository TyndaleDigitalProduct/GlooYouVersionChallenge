import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { RuntimeProvider } from "./RuntimeContext";
import { CAPTION_HOLD_MS, FADE_MS, SceneTransition } from "./SceneTransition";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:scene-transition",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

function renderTransition(runtime = boot()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <SceneTransition />
    </RuntimeProvider>,
  );
  return runtime;
}

function tick(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("SceneTransition (PRD-13 phase 5)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing while no transition is in flight", () => {
    renderTransition();
    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
  });

  it("fades out, swaps the room behind the black, holds the caption, then fades in", () => {
    const runtime = boot();
    renderTransition(runtime);

    act(() => {
      runtime.view.getState().beginSceneTransition({
        fromSceneId: "scene-1",
        toSceneId: "scene-2",
        caption: "Dawn, and the gates stand open.",
      });
    });

    // Fading out. The old room is still on screen, so no caption over it yet.
    expect(screen.getByTestId("scene-transition")).toHaveAttribute("data-stage", "out");
    expect(screen.queryByTestId("scene-transition-caption")).not.toBeInTheDocument();
    expect(runtime.view.getState().roomSceneId).toBe("scene-1");

    tick(FADE_MS);

    // Fully black: this is the only moment the room may change.
    expect(screen.getByTestId("scene-transition")).toHaveAttribute("data-stage", "arriving");
    expect(screen.getByTestId("scene-transition-caption")).toHaveTextContent(
      "Dawn, and the gates stand open.",
    );
    expect(runtime.view.getState().roomSceneId).toBe("scene-2");

    tick(CAPTION_HOLD_MS);
    expect(screen.getByTestId("scene-transition")).toHaveAttribute("data-stage", "in");

    tick(FADE_MS);
    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
    expect(runtime.view.getState().sceneTransition).toBeNull();
    expect(runtime.view.getState().roomSceneId).toBe("scene-2");
  });

  it("rewinds the dialogue on arrival, so the new scene plays its own opening", () => {
    const runtime = boot();
    renderTransition(runtime);
    runtime.view.getState().advanceDialogue();
    runtime.view.getState().advanceDialogue();
    runtime.view.getState().advanceDialogue();

    act(() => {
      runtime.view
        .getState()
        .beginSceneTransition({ fromSceneId: "scene-1", toSceneId: "scene-2", caption: "Dawn." });
    });
    tick(FADE_MS);

    expect(runtime.view.getState().dialogueIndex).toBe(0);
  });

  it("still runs the fade when the content left a caption out, rather than stalling", () => {
    const runtime = boot();
    renderTransition(runtime);

    act(() => {
      runtime.view
        .getState()
        .beginSceneTransition({ fromSceneId: "scene-1", toSceneId: "scene-2", caption: null });
    });
    tick(FADE_MS);

    expect(screen.queryByTestId("scene-transition-caption")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-transition")).toHaveAttribute("data-stage", "arriving");

    // One tick per stage: each stage schedules its own timer only once React has
    // flushed the previous stage's state change.
    tick(CAPTION_HOLD_MS);
    tick(FADE_MS);
    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
  });
});
