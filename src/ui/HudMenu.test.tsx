import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { ok } from "@/core/result";
import type { SessionProvider } from "../app/providers";
import { createAppRuntime } from "../app/runtime";
import { HudMenu } from "./HudMenu";
import { RuntimeProvider } from "./RuntimeContext";

/** A fake real (non-stub) SessionProvider whose signIn() always succeeds, for
 * exercising the post-connect profile display without a real OAuth round-trip. */
function fakeConnectedSessionProvider(profile: {
  displayName?: string;
  avatarUrl?: string;
}): SessionProvider {
  return {
    isStub: false,
    current: () => null,
    signOut: () => undefined,
    signIn: () => Promise.resolve(ok({ yvpId: "yvp-1", ...profile })),
  };
}

function boot() {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:hud-menu",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

function renderMenu(runtime = boot()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <HudMenu />
    </RuntimeProvider>,
  );
  return runtime;
}

describe("HudMenu (PRD-11, storyboard-v2.md §3 'behind the HUD menu')", () => {
  it("starts closed", () => {
    renderMenu();
    expect(screen.queryByTestId("hud-menu")).not.toBeInTheDocument();
  });

  it("opens and closes on toggle", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByTestId("hud-menu-toggle"));
    expect(screen.getByTestId("hud-menu")).toBeInTheDocument();

    await user.click(screen.getByTestId("hud-menu-toggle"));
    expect(screen.queryByTestId("hud-menu")).not.toBeInTheDocument();
  });

  it("opens the chapter map and closes the menu behind it (PRD-13 phase 5)", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().continueGame();
    renderMenu(runtime);
    await user.click(screen.getByTestId("hud-menu-toggle"));

    await user.click(screen.getByTestId("menu-chapter-map"));

    expect(runtime.view.getState().chapterMapOpen).toBe(true);
    expect(runtime.view.getState().menuOpen).toBe(false);
    // Still mid-play underneath: the map is a progress view, not a phase.
    expect(runtime.view.getState().phase).toBe("playing");
  });

  it("Replay intro reopens the intro and closes the menu", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().continueGame();
    renderMenu(runtime);

    await user.click(screen.getByTestId("hud-menu-toggle"));
    await user.click(screen.getByTestId("menu-replay-intro"));

    expect(runtime.view.getState().phase).toBe("intro");
    expect(runtime.view.getState().menuOpen).toBe(false);
  });

  it("offers a YouVersion connect action, stating it runs against a stub", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    renderMenu(runtime);

    await user.click(screen.getByTestId("hud-menu-toggle"));

    expect(screen.getByTestId("menu-connect-youversion")).toBeInTheDocument();
    expect(screen.getByText(/stub/i)).toBeInTheDocument();

    await user.click(screen.getByTestId("menu-connect-youversion"));
    expect(await screen.findByTestId("menu-signin-message")).toBeInTheDocument();
  });

  it("shows a connected status and a disconnect action once a session exists", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.store.getState().setSession("yvp-123");
    renderMenu(runtime);

    await user.click(screen.getByTestId("hud-menu-toggle"));
    expect(screen.getByTestId("menu-youversion-status")).toBeInTheDocument();

    await user.click(screen.getByTestId("menu-disconnect-youversion"));
    expect(runtime.store.getState().session).toBeNull();
  });

  it("shows the connected account's name and avatar once sign-in succeeds", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.session = fakeConnectedSessionProvider({
      displayName: "Test Player",
      avatarUrl: "https://example.test/avatar.png",
    });
    renderMenu(runtime);

    await user.click(screen.getByTestId("hud-menu-toggle"));
    await user.click(screen.getByTestId("menu-connect-youversion"));

    expect(await screen.findByTestId("menu-youversion-name")).toHaveTextContent("Test Player");
    expect(screen.getByTestId("menu-youversion-avatar")).toHaveAttribute(
      "src",
      "https://example.test/avatar.png",
    );
  });

  it("Close dismisses the menu without changing phase", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.view.getState().continueGame();
    renderMenu(runtime);

    await user.click(screen.getByTestId("hud-menu-toggle"));
    await user.click(screen.getByTestId("menu-close"));

    expect(screen.queryByTestId("hud-menu")).not.toBeInTheDocument();
    expect(runtime.view.getState().phase).toBe("playing");
  });
});
