import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { createAppRuntime } from "../app/runtime";
import { App } from "./App";
import { CAPTION_HOLD_MS, FADE_MS } from "./SceneTransition";

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

    await user.click(screen.getByTestId("home-new-game"));
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

describe("the chapter loop (PRD-13 phase 5)", () => {
  // Restores the clock even if a test below fails part way through. Without this,
  // a timed-out fake-timer test leaves them installed and every later test in the
  // file hangs on its first real await, which reads as four failures instead of
  // one.
  afterEach(() => {
    vi.useRealTimers();
  });

  it("says which room the player is in, in place of the old vertical-slice tag", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    render(<App runtime={runtime} />);

    await user.click(screen.getByTestId("home-continue"));

    expect(screen.getByTestId("scene-tag")).toHaveTextContent("Scene 1 of 9");
    expect(screen.getByTestId("scene-tag")).toHaveTextContent("DAN.1.1");
  });

  it("closes a scene through the Lamplighter, fades, and arrives in the next one", () => {
    // The whole transition, end to end, through the real components: the control
    // is not offered until the Lamplighter has closed the scene, pressing it
    // blanks the screen with a caption naming the time change, the room swaps
    // behind the black, and the arriving scene plays its own opening.
    //
    // `fireEvent` rather than `userEvent` throughout, because the fade is on a
    // clock: userEvent drives its own timers even at zero delay, and under
    // vi.useFakeTimers its promises never settle. fireEvent is synchronous and
    // act-wrapped, which is all a button press needs here.
    vi.useFakeTimers();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    render(<App runtime={runtime} />);

    fireEvent.click(screen.getByTestId("home-continue"));
    act(() => {
      runtime.view.getState().openLamplighter("scene-1");
    });

    expect(screen.queryByTestId("lamplighter-move-on")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("lamplighter-close-scene"));
    expect(screen.getByTestId("vale-stones-balance")).toHaveTextContent("5");

    fireEvent.click(screen.getByTestId("lamplighter-move-on"));
    expect(screen.getByTestId("scene-transition")).toHaveAttribute("data-stage", "out");
    expect(screen.queryByTestId("lamplighter-panel")).not.toBeInTheDocument();
    expect(screen.getByTestId("scene-tag")).toHaveTextContent("Scene 1 of 9");

    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.getByTestId("scene-transition-caption")).toHaveTextContent(
      "Dawn, and the gates stand open.",
    );
    expect(screen.getByTestId("scene-tag")).toHaveTextContent("Scene 2 of 9");

    act(() => {
      vi.advanceTimersByTime(CAPTION_HOLD_MS);
    });
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });

    expect(screen.queryByTestId("scene-transition")).not.toBeInTheDocument();
    expect(screen.getByTestId("dialogue-text")).toHaveTextContent(
      "So the siege ended the way sieges usually do",
    );
  });

  it("reaches the end state after the ninth scene, with the chapter map behind it", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    for (const scene of runtime.content.scenes.slice(0, 8)) {
      runtime.store.getState().completeScene(scene.id);
    }
    // The eight fades a real session would have run to get here.
    runtime.view.getState().enterRoom("scene-9");
    render(<App runtime={runtime} />);

    await user.click(screen.getByTestId("home-continue"));
    act(() => {
      runtime.view.getState().openLamplighter("scene-9");
    });

    await user.click(screen.getByTestId("lamplighter-close-scene"));
    await user.click(screen.getByTestId("lamplighter-move-on"));

    // A defined end state, not a dead world and not a silent return home.
    expect(screen.getByTestId("chapter-complete")).toBeInTheDocument();
    expect(screen.queryByTestId("home-screen")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("complete-open-chapter-map"));
    expect(screen.getByTestId("chapter-map-summary")).toHaveTextContent("Every scene closed");
  });

  it("gets back into a finished scene from the chapter map, mid-play", () => {
    vi.useFakeTimers();
    const runtime = boot();
    runtime.store.getState().setPlayerName("Ezra");
    runtime.store.getState().completeScene("scene-1");
    runtime.store.getState().completeScene("scene-2");
    runtime.view.getState().enterRoom("scene-3");
    render(<App runtime={runtime} />);

    fireEvent.click(screen.getByTestId("home-continue"));
    expect(screen.getByTestId("scene-tag")).toHaveTextContent("Scene 3 of 9");

    fireEvent.click(screen.getByTestId("hud-menu-toggle"));
    fireEvent.click(screen.getByTestId("menu-chapter-map"));
    fireEvent.click(screen.getByTestId("chapter-scene-enter-1"));

    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });
    expect(screen.getByTestId("scene-tag")).toHaveTextContent("Scene 1 of 9");
    act(() => {
      vi.advanceTimersByTime(CAPTION_HOLD_MS);
    });
    act(() => {
      vi.advanceTimersByTime(FADE_MS);
    });

    // Revisited: no forced opening replay, and nothing re-awarded.
    expect(screen.queryByTestId("dialogue-box")).not.toBeInTheDocument();
    expect(
      runtime.store.getState().ledger.filter((entry) => entry.cause === "scene-complete"),
    ).toHaveLength(2);
  });
});
