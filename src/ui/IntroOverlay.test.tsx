import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { IntroOverlay } from "./IntroOverlay";
import { RuntimeProvider } from "./RuntimeContext";

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:intro-overlay",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("IntroOverlay (PRD-11, storyboard-v2.md §3)", () => {
  it("substitutes the saved name into intro copy", () => {
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <IntroOverlay />
      </RuntimeProvider>,
    );

    expect(screen.getByTestId("intro-text")).toHaveTextContent("Ezra");
    expect(screen.getByTestId("intro-text")).not.toHaveTextContent("{name}");
  });

  it("is skippable from any beat, landing on the playing phase", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <IntroOverlay />
      </RuntimeProvider>,
    );

    await user.click(screen.getByTestId("intro-skip"));

    expect(runtime.view.getState().phase).toBe("playing");
  });

  it("paginates through every beat via Next, ending on Start playing", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <IntroOverlay />
      </RuntimeProvider>,
    );

    const firstText = screen.getByTestId("intro-text").textContent;

    let guard = 0;
    while (screen.getByTestId("intro-next").textContent !== "Start playing" && guard < 20) {
      await user.click(screen.getByTestId("intro-next"));
      guard += 1;
    }

    expect(screen.getByTestId("intro-next")).toHaveTextContent("Start playing");
    expect(screen.getByTestId("intro-text").textContent).not.toBe(firstText);

    await user.click(screen.getByTestId("intro-next"));
    expect(runtime.view.getState().phase).toBe("playing");
  });

  // PRD-10 switched the live path to the NIV, which unlike the public-domain
  // WEB carries a notice Biblica requires be displayed. The intro is where the
  // operator placed it, and it covers *all* Scripture the game can render, so
  // it must not be conditional on which path served a given passage.
  it("shows the Scripture attribution for every translation the game can render", () => {
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <IntroOverlay />
      </RuntimeProvider>,
    );

    const attribution = screen.getByTestId("intro-scripture-attribution");
    expect(attribution).toHaveTextContent("New International Version");
    expect(attribution).toHaveTextContent("Biblica");
    expect(attribution).toHaveTextContent("World English Bible");
  });

  it("keeps the attribution on screen for every beat, not just the first", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");

    render(
      <RuntimeProvider runtime={runtime}>
        <IntroOverlay />
      </RuntimeProvider>,
    );

    let guard = 0;
    while (screen.getByTestId("intro-next").textContent !== "Start playing" && guard < 20) {
      await user.click(screen.getByTestId("intro-next"));
      expect(screen.getByTestId("intro-scripture-attribution")).toBeInTheDocument();
      guard += 1;
    }

    expect(screen.getByTestId("intro-scripture-attribution")).toHaveTextContent("Biblica");
  });
});
