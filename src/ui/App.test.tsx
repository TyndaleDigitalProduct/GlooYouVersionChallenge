import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { App } from "./App";

function boot(storage = createInMemoryStorage()) {
  const result = createAppRuntime({ storage, saveKey: "test:app", bus: createEventBus() });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("App phase gating (PRD-11)", () => {
  it("boots straight to the home screen, with none of the playing-only UI mounted", () => {
    const runtime = boot();
    render(<App runtime={runtime} />);

    expect(screen.getByTestId("home-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("vale-stones")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dialogue-box")).not.toBeInTheDocument();
    expect(screen.queryByTestId("hud-menu-toggle")).not.toBeInTheDocument();
  });

  it("carries a first-time player all the way through: home -> setup -> intro -> playing", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    render(<App runtime={runtime} />);

    await user.click(screen.getByTestId("home-enter"));
    expect(screen.getByTestId("setup-screen")).toBeInTheDocument();

    await user.type(screen.getByTestId("player-name-input"), "Ezra");
    await user.click(screen.getByTestId("setup-continue"));
    expect(screen.getByTestId("intro-overlay")).toBeInTheDocument();

    await user.click(screen.getByTestId("intro-skip"));

    expect(screen.getByTestId("vale-stones")).toBeInTheDocument();
    expect(screen.getByTestId("dialogue-box")).toBeInTheDocument();
    expect(screen.getByTestId("hud-menu-toggle")).toBeInTheDocument();
    expect(runtime.store.getState().playerName).toBe("Ezra");
  });

  it("carries a returning player straight from home to playing via Continue, with no setup or intro", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    render(<App runtime={runtime} />);

    await user.click(screen.getByTestId("home-continue"));

    expect(screen.queryByTestId("setup-screen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("intro-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialogue-box")).toBeInTheDocument();
  });

  it("a HUD menu 'Replay intro' mid-game returns to the intro, then back to playing", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    render(<App runtime={runtime} />);

    await user.click(screen.getByTestId("home-continue"));
    await user.click(screen.getByTestId("hud-menu-toggle"));
    await user.click(screen.getByTestId("menu-replay-intro"));

    expect(screen.getByTestId("intro-overlay")).toBeInTheDocument();
    expect(screen.queryByTestId("dialogue-box")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("intro-skip"));
    expect(screen.getByTestId("dialogue-box")).toBeInTheDocument();
  });
});
