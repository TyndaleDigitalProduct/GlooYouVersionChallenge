import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { LamplighterExitPanel } from "./LamplighterExitPanel";
import { RuntimeProvider } from "./RuntimeContext";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:lamplighter-exit",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

function renderPanel(runtime = boot()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <LamplighterExitPanel />
    </RuntimeProvider>,
  );
  return runtime;
}

describe("LamplighterExitPanel (PRD-12)", () => {
  it("renders nothing when no Lamplighter panel is open", () => {
    renderPanel();
    expect(screen.queryByTestId("lamplighter-panel")).not.toBeInTheDocument();
  });

  it("shows the 'none' branch line when nothing has been engaged", () => {
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    expect(screen.getByTestId("lamplighter-panel")).toBeInTheDocument();
    expect(screen.getByTestId("lamplighter-text")).toHaveTextContent(
      "In a hurry? I understand; sieges do that to people.",
    );
  });

  it("shows the 'some' branch line once one of the scene's references is engaged", () => {
    const runtime = boot();
    runtime.store.getState().engageEncounter("scene-1", "2KI.24.1-4");
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    expect(screen.getByTestId("lamplighter-text")).toHaveTextContent(
      "You heard some of what this city has to say.",
    );
  });

  it("'Not yet' closes the panel without completing the scene", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    await user.click(screen.getByTestId("lamplighter-not-yet"));

    expect(screen.queryByTestId("lamplighter-panel")).not.toBeInTheDocument();
    expect(runtime.store.getState().isSceneComplete("scene-1")).toBe(false);
  });
});

describe("the 'ready to move on' control (PRD-13 phase 5)", () => {
  it("is not offered until the Lamplighter has closed the scene", async () => {
    // The operator's rule (2026-07-30): the Lamplighter stays the gate. Moving on
    // is a second press, offered only once the scene is actually closed, so the
    // scene-complete stone award still happens through the Lamplighter and
    // nothing can skip past it.
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    expect(screen.queryByTestId("lamplighter-move-on")).not.toBeInTheDocument();
    expect(screen.getByTestId("lamplighter-close-scene")).toBeInTheDocument();
  });

  it("closing the scene awards the stones and then offers the control, panel still open", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    await user.click(screen.getByTestId("lamplighter-close-scene"));

    expect(runtime.store.getState().isSceneComplete("scene-1")).toBe(true);
    expect(
      runtime.store.getState().ledger.filter((entry) => entry.cause === "scene-complete"),
    ).toHaveLength(1);
    expect(screen.getByTestId("lamplighter-panel")).toBeInTheDocument();
    expect(screen.getByTestId("lamplighter-move-on")).toBeInTheDocument();
    expect(screen.queryByTestId("lamplighter-close-scene")).not.toBeInTheDocument();
  });

  it("names where the fade is going, since the picture alone may not change", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-3");
    runtime.store.getState().completeScene("scene-1");
    runtime.store.getState().completeScene("scene-2");
    renderPanel(runtime);

    await user.click(screen.getByTestId("lamplighter-close-scene"));

    // Scene 4 shares `babylon-palace` with scene 3, so the destination has to be
    // said in words: the backdrop will look identical on the other side.
    expect(screen.getByTestId("lamplighter-onward")).toHaveTextContent("DAN.1.6-7");
  });

  it("pressing it starts the fade toward the next scene and closes the panel", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    await user.click(screen.getByTestId("lamplighter-close-scene"));
    await user.click(screen.getByTestId("lamplighter-move-on"));

    expect(runtime.view.getState().sceneTransition).toEqual({
      fromSceneId: "scene-1",
      toSceneId: "scene-2",
      caption: runtime.content.scenes[1].transitionCaption ?? null,
      stage: "out",
    });
    expect(runtime.view.getState().openLamplighterSceneId).toBeNull();
    // The room does not swap until the overlay is fully opaque.
    expect(runtime.view.getState().roomSceneId).toBe("scene-1");
  });

  it("a revisited scene offers the control immediately, and moving on re-awards nothing", async () => {
    // PRD-13 open question 6, defaulted: a revisited scene's Lamplighter has
    // already closed it, so there is nothing left to gate. `completeScene`
    // reports changed: false, and the transition path never calls it at all.
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().completeScene("scene-1");
    const ledgerBefore = runtime.store.getState().ledger.length;
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    expect(screen.queryByTestId("lamplighter-close-scene")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("lamplighter-move-on"));

    expect(runtime.store.getState().ledger).toHaveLength(ledgerBefore);
    expect(
      runtime.store.getState().ledger.filter((entry) => entry.cause === "scene-complete"),
    ).toHaveLength(1);
    expect(runtime.view.getState().sceneTransition?.toSceneId).toBe("scene-2");
  });

  it("the last scene offers the end state instead of a next scene", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    for (const scene of runtime.content.scenes.slice(0, 8)) {
      runtime.store.getState().completeScene(scene.id);
    }
    runtime.view.getState().openLamplighter("scene-9");
    renderPanel(runtime);

    await user.click(screen.getByTestId("lamplighter-close-scene"));
    expect(runtime.store.getState().isGameComplete()).toBe(true);
    expect(screen.queryByTestId("lamplighter-onward")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("lamplighter-move-on"));

    // A defined end state, not a fade into a room that does not exist.
    expect(runtime.view.getState().sceneTransition).toBeNull();
    expect(runtime.view.getState().phase).toBe("complete");
    expect(runtime.view.getState().openLamplighterSceneId).toBeNull();
  });

  it("PRD-12 revisit: shows the 'all' branch once every reference is resolved", async () => {
    const runtime = boot();
    const cards = [
      { id: "c1", text: "a", value: 5 },
      { id: "c2", text: "b", value: 4 },
      { id: "c3", text: "c", value: 3 },
      { id: "c4", text: "d", value: 0 },
      { id: "c5", text: "e", value: 2 },
      { id: "c6", text: "f", value: 1 },
    ];

    // The scene was already completed once (e.g. through an earlier Lamplighter
    // visit with references left unengaged), then the player came back and
    // resolved both — scene revisit (PRD-12, storyboard-v2.md open decision 1)
    // means this is a legal sequence, not a stale state.
    runtime.store.getState().completeScene("scene-1");
    runtime.store.getState().generateEncounterCards("scene-1", "2KI.24.1-4", cards);
    runtime.store.getState().lockEncounterSelections("scene-1", "2KI.24.1-4", ["c1"]);
    runtime.store.getState().generateEncounterCards("scene-1", "JER.25.2-11", cards);
    runtime.store.getState().lockEncounterSelections("scene-1", "JER.25.2-11", ["c1"]);
    expect(runtime.store.getState().ledger.some((entry) => entry.cause === "all-references")).toBe(
      true,
    );

    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    expect(screen.getByTestId("lamplighter-text")).toHaveTextContent("You listened to them all");
    expect(
      runtime.store.getState().ledger.filter((entry) => entry.cause === "scene-complete"),
    ).toHaveLength(1);
  });
});
