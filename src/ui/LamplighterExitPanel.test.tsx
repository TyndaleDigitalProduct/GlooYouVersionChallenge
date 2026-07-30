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

  it("'Ready to move on' completes the scene and closes the panel", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().openLamplighter("scene-1");
    renderPanel(runtime);

    await user.click(screen.getByTestId("lamplighter-move-on"));

    expect(runtime.store.getState().isSceneComplete("scene-1")).toBe(true);
    expect(screen.queryByTestId("lamplighter-panel")).not.toBeInTheDocument();
  });

  it("PRD-12 revisit: shows the 'all' branch and re-finishing after a prior completion never duplicates the scene-complete award", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    const cards = [
      { id: "c1", text: "a", value: 5 },
      { id: "c2", text: "b", value: 4 },
      { id: "c3", text: "c", value: 3 },
      { id: "c4", text: "d", value: 0 },
      { id: "c5", text: "e", value: 2 },
      { id: "c6", text: "f", value: 1 },
    ];

    // The scene was already completed once (e.g. through an earlier
    // Lamplighter visit with references left unengaged), then the player
    // came back and resolved both — scene revisit (PRD-12, storyboard-v2.md
    // open decision 1) means this is a legal sequence, not a stale state.
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

    await user.click(screen.getByTestId("lamplighter-move-on"));

    // Re-completing is a no-op: no duplicate scene-complete entry.
    expect(
      runtime.store.getState().ledger.filter((entry) => entry.cause === "scene-complete"),
    ).toHaveLength(1);
  });
});
