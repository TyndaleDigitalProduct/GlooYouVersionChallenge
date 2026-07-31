import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { YouVersionProfile } from "./YouVersionProfile";

describe("YouVersionProfile (PRD-10)", () => {
  it("renders nothing when there is no session profile at all", () => {
    render(<YouVersionProfile profile={null} label="Signed in as" testIdPrefix="menu" />);
    expect(screen.queryByTestId("menu-youversion-profile")).not.toBeInTheDocument();
  });

  it("renders nothing when the account has neither a name nor an avatar", () => {
    render(<YouVersionProfile profile={{}} label="Signed in as" testIdPrefix="menu" />);
    expect(screen.queryByTestId("menu-youversion-profile")).not.toBeInTheDocument();
  });

  it("shows the label and name together, under the caller's test id prefix", () => {
    render(
      <YouVersionProfile
        profile={{ displayName: "Zoë Ngũgĩ" }}
        label="Connected as"
        testIdPrefix="setup"
      />,
    );

    const name = screen.getByTestId("setup-youversion-name");
    expect(name).toHaveTextContent("Connected as");
    expect(name).toHaveTextContent("Zoë Ngũgĩ");
    // Name only: no broken image frame beside it.
    expect(screen.queryByTestId("setup-youversion-avatar")).not.toBeInTheDocument();
  });

  it("renders a fixed-size, decorative avatar so a large source image cannot swamp the panel", () => {
    render(
      <YouVersionProfile
        profile={{ displayName: "Ezra", avatarUrl: "https://example.test/a.png" }}
        label="Signed in as"
        testIdPrefix="menu"
      />,
    );

    const avatar = screen.getByTestId("menu-youversion-avatar");
    expect(avatar).toHaveAttribute("src", "https://example.test/a.png");
    // Intrinsic size is pinned in the markup as well as in CSS, so the row does
    // not reflow while the image loads.
    expect(avatar).toHaveAttribute("width", "32");
    expect(avatar).toHaveAttribute("height", "32");
    // Decorative: the name beside it already identifies the account.
    expect(avatar).toHaveAttribute("alt", "");
  });

  it("renders an avatar with no name, when that is all the account has", () => {
    render(
      <YouVersionProfile
        profile={{ avatarUrl: "https://example.test/a.png" }}
        label="Signed in as"
        testIdPrefix="menu"
      />,
    );

    expect(screen.getByTestId("menu-youversion-avatar")).toBeInTheDocument();
    expect(screen.queryByTestId("menu-youversion-name")).not.toBeInTheDocument();
  });
});
