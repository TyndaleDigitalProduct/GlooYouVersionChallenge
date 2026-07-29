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
  it("shows title, tagline, and a single Enter action when no save exists", () => {
    const runtime = boot();
    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    expect(screen.getByText("Verse & Vale")).toBeInTheDocument();
    expect(screen.getByTestId("home-enter")).toBeInTheDocument();
    expect(screen.queryByTestId("home-continue")).not.toBeInTheDocument();
    expect(screen.queryByTestId("home-new-game")).not.toBeInTheDocument();
  });

  it("Enter moves the view to setup", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    render(
      <RuntimeProvider runtime={runtime}>
        <HomeScreen />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("home-enter"));

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

    expect(screen.queryByTestId("home-enter")).not.toBeInTheDocument();
    expect(screen.getByTestId("home-continue")).toBeInTheDocument();
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

    expect(screen.getByTestId("home-enter")).toBeInTheDocument();
    expect(runtime.view.getState().notices).toEqual([
      expect.objectContaining({ id: "save-recovered" }),
    ]);
  });
});
