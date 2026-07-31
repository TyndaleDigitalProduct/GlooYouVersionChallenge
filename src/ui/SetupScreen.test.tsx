import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { ok } from "@/core/result";
import type { SessionProvider } from "../app/providers";
import { createAppRuntime } from "../app/runtime";
import { RuntimeProvider } from "./RuntimeContext";
import { NAME_MAX_LENGTH, SetupScreen } from "./SetupScreen";

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
    saveKey: "test:setup-screen",
    bus: createEventBus(),
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

function renderSetup(runtime = boot()) {
  render(
    <RuntimeProvider runtime={runtime}>
      <SetupScreen />
    </RuntimeProvider>,
  );
  return runtime;
}

describe("SetupScreen (PRD-11, storyboard-v2.md §2)", () => {
  it("disables Continue until a name is entered", () => {
    renderSetup();
    expect(screen.getByTestId("setup-continue")).toBeDisabled();
  });

  it("does not count whitespace-only input as a name", async () => {
    const user = userEvent.setup();
    renderSetup();

    await user.type(screen.getByTestId("player-name-input"), "   ");

    expect(screen.getByTestId("setup-continue")).toBeDisabled();
  });

  it("enables Continue once a real name is entered", async () => {
    const user = userEvent.setup();
    renderSetup();

    await user.type(screen.getByTestId("player-name-input"), "Ezra");

    expect(screen.getByTestId("setup-continue")).toBeEnabled();
  });

  it("shows a validation message for the empty case, once the field has been touched", async () => {
    const user = userEvent.setup();
    renderSetup();

    expect(screen.queryByTestId("player-name-error")).not.toBeInTheDocument();

    const input = screen.getByTestId("player-name-input");
    await user.click(input);
    await user.tab(); // blur while still empty

    expect(screen.getByTestId("player-name-error")).toBeInTheDocument();
  });

  it("enforces the length cap at input time via maxLength, not only on submit", () => {
    renderSetup();
    const input = screen.getByTestId("player-name-input") as HTMLInputElement;
    expect(input.maxLength).toBe(NAME_MAX_LENGTH);
  });

  it("truncates a pasted value longer than the cap rather than accepting it", async () => {
    const user = userEvent.setup();
    renderSetup();

    const tooLong = "a".repeat(NAME_MAX_LENGTH + 10);
    const input = screen.getByTestId("player-name-input") as HTMLInputElement;
    await user.click(input);
    await user.paste(tooLong);

    expect(input.value.length).toBeLessThanOrEqual(NAME_MAX_LENGTH);
  });

  it("submitting a valid name saves it and moves the view to the intro", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    renderSetup(runtime);

    await user.type(screen.getByTestId("player-name-input"), "  Ezra  ");
    await user.click(screen.getByTestId("setup-continue"));

    expect(runtime.store.getState().playerName).toBe("Ezra");
    expect(runtime.view.getState().phase).toBe("intro");
  });

  it("states plainly that the sign-in offer runs against a stub", () => {
    const runtime = boot();
    renderSetup(runtime);

    expect(runtime.session.isStub).toBe(true);
    expect(screen.getByText(/stub/i)).toBeInTheDocument();
  });

  it("declining sign-in is a first-class path: Continue works with no connection attempted", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    renderSetup(runtime);

    await user.type(screen.getByTestId("player-name-input"), "Ezra");
    await user.click(screen.getByTestId("setup-continue"));

    expect(runtime.store.getState().session).toBeNull();
    expect(runtime.view.getState().phase).toBe("intro");
  });

  it("attempting sign-in against the stub fails without blocking or throwing", async () => {
    const user = userEvent.setup();
    renderSetup();

    await user.click(screen.getByTestId("setup-connect-youversion"));

    expect(await screen.findByTestId("setup-signin-message")).toBeInTheDocument();
  });

  it("shows the connected account's name and avatar once sign-in succeeds", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.session = fakeConnectedSessionProvider({
      displayName: "Test Player",
      avatarUrl: "https://example.test/avatar.png",
    });
    renderSetup(runtime);

    await user.click(screen.getByTestId("setup-connect-youversion"));

    expect(await screen.findByTestId("setup-youversion-name")).toHaveTextContent("Test Player");
    expect(screen.getByTestId("setup-youversion-avatar")).toHaveAttribute(
      "src",
      "https://example.test/avatar.png",
    );
  });

  it("shows just Connected with no profile row when the account has no name or avatar", async () => {
    const user = userEvent.setup();
    const runtime = boot();
    runtime.session = fakeConnectedSessionProvider({});
    renderSetup(runtime);

    await user.click(screen.getByTestId("setup-connect-youversion"));

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-youversion-profile")).not.toBeInTheDocument();
  });
});
