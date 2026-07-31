import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { reportSignInFailure, SignInFailureReason } from "./signInFailureReason";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sign-in failure reporting", () => {
  it("logs the reason and returns it for display in a dev build", () => {
    vi.stubEnv("DEV", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const shown = reportSignInFailure("token-exchange-failed-400");

    expect(shown).toBe("token-exchange-failed-400");
    expect(warn).toHaveBeenCalledWith("YouVersion sign-in failed: token-exchange-failed-400");
  });

  it("still logs, but shows a player nothing, in a production build", () => {
    vi.stubEnv("DEV", false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const shown = reportSignInFailure("token-exchange-failed-400");

    // The reason is an operator's diagnostic, never player-facing copy.
    expect(shown).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when there is no reason to show", () => {
    vi.stubEnv("DEV", true);
    render(<SignInFailureReason reason={null} />);
    expect(screen.queryByTestId("signin-failure-reason")).not.toBeInTheDocument();
  });

  it("renders the reason, marked as dev-only, when there is one", () => {
    vi.stubEnv("DEV", true);
    render(<SignInFailureReason reason="sign-in-cancelled" />);

    const line = screen.getByTestId("signin-failure-reason");
    expect(line).toHaveTextContent("sign-in-cancelled");
    expect(line).toHaveTextContent(/dev only/i);
  });

  it("refuses to render a reason in a production build, even if one is passed", () => {
    vi.stubEnv("DEV", false);
    render(<SignInFailureReason reason="token-exchange-failed-400" />);

    expect(screen.queryByTestId("signin-failure-reason")).not.toBeInTheDocument();
    expect(screen.queryByText(/token-exchange-failed-400/)).not.toBeInTheDocument();
  });
});
