import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { HomeScreen } from "./HomeScreen";
import { RuntimeProvider } from "./RuntimeContext";

function boot(storage = createInMemoryStorage()) {
  const result = createAppRuntime({ storage, saveKey: "test:home-screen", bus: createEventBus() });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("HomeScreen (PRD-11, storyboard-v2.md §1)", () => {
  // Both actions are painted into the background art, so both are always in
  // the DOM. The two entry states are told apart by whether Continue is
  // enabled, not by whether it exists.
  it("names the painted title accessibly and disables Continue when no save exists", () => {
    const runtime = boot();
    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    expect(screen.getByRole("heading", { name: "Verse & Vale" })).toBeInTheDocument();
    expect(screen.getByTestId("home-new-game")).toBeEnabled();
    expect(screen.getByTestId("home-continue")).toBeDisabled();
    expect(screen.getByTestId("home-continue-detail")).toHaveTextContent(/no saved game/i);
  });

  it("New game with no save enters setup directly, with no confirm to sit through", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-new-game"));

    expect(screen.queryByTestId("new-game-confirm")).not.toBeInTheDocument();
    expect(runtime.view.getState().phase).toBe("setup");
  });

  it("shows Continue with the current scene and Vale Stone balance, plus New game, once a name is saved", () => {
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("home-continue")).toBeEnabled();
    expect(screen.getByTestId("home-continue-detail")).toHaveTextContent("Scene 1 of 9");
    expect(screen.getByTestId("home-continue-detail")).toHaveTextContent("0 Vale Stones");
    expect(screen.getByTestId("home-new-game")).toBeInTheDocument();
  });

  it("Continue moves the view straight to playing, skipping setup and intro", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-continue"));

    expect(runtime.view.getState().phase).toBe("playing");
  });

  it("offers the chapter map beside Continue, but only with a save behind it (PRD-13 phase 5)", async () => {
    // Open question 3, defaulted: beside Continue rather than replacing it. The
    // map is a progress view and a door back into finished scenes, so it has
    // nothing to show on a first run.
    const user = userEvent.setup();
    const firstRun = boot();

    const { unmount } = render(
      <RuntimeProvider runtime={firstRun}>
        <HomeScreen />
      </RuntimeProvider>,
    );
    expect(screen.queryByTestId("home-chapter-map")).not.toBeInTheDocument();
    unmount();

    const returning = boot();
    returning.store.getState().setPlayerName("Ezra");
    render(
      <RuntimeProvider runtime={returning}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-chapter-map"));

    expect(returning.view.getState().chapterMapOpen).toBe(true);
    // Continue is untouched: the map does not replace it.
    expect(screen.getByTestId("home-continue")).toBeEnabled();
    expect(returning.view.getState().phase).toBe("home");
  });

  it("Continue on a finished chapter lands on the end state, not an empty world", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    for (const scene of runtime.content.scenes) runtime.store.getState().completeScene(scene.id);

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("home-continue-detail")).toHaveTextContent("Every scene complete");
    await user.click(screen.getByTestId("home-continue"));

    // `currentSceneId()` is null here, so "playing" would be a chapter with
    // nothing left to do in it.
    expect(runtime.view.getState().phase).toBe("complete");
  });

  it("New game opens a confirm naming exactly what is lost, and nothing more", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-new-game"));

    const confirm = screen.getByTestId("new-game-confirm");
    expect(confirm).toHaveTextContent("progress");
    expect(confirm).toHaveTextContent("encounter history");
    expect(confirm).toHaveTextContent("local highlights");
    // Nothing more: YouVersion-synced highlights are not the game's to
    // reclaim (storyboard-v2.md §1) and must not be named in this copy.
    expect(confirm).not.toHaveTextContent(/youversion/i);
  });

  it("cancelling the confirm changes nothing", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    runtime.store.getState().completeScene("scene-1");

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-new-game"));
    await user.click(screen.getByTestId("new-game-cancel"));

    expect(screen.queryByTestId("new-game-confirm")).not.toBeInTheDocument();
    expect(runtime.store.getState().completedSceneIds).toEqual(["scene-1"]);
    expect(runtime.view.getState().phase).toBe("home");
  });

  it("confirming wipes progress, keeps the name, and goes straight to the intro", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    runtime.store.getState().completeScene("scene-1");

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-new-game"));
    await user.click(screen.getByTestId("new-game-confirm-accept"));

    expect(runtime.store.getState().completedSceneIds).toEqual([]);
    expect(runtime.store.getState().playerName).toBe("Ezra");
    expect(runtime.view.getState().phase).toBe("intro");
  });

  it("degrades to the first-time state when the save could not be read, without hiding the notice", () => {
    const storage = createInMemoryStorage();
    storage.setItem("test:home-screen", "{ not json");
    const runtime = boot(storage);

    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("home-continue")).toBeDisabled();
    expect(runtime.view.getState().notices).toEqual([
      expect.objectContaining({ id: "save-recovered" }),
    ]);
  });
});
