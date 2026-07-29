import { describe, expect, it } from "vitest";
import { substituteName } from "./nameSubstitution";

describe("substituteName", () => {
  it("replaces a single {name} placeholder", () => {
    expect(substituteName("Well done, {name}.", "Ezra")).toBe("Well done, Ezra.");
  });

  it("replaces every occurrence, not just the first", () => {
    expect(substituteName("{name}? Yes, {name}, you.", "Miriam")).toBe("Miriam? Yes, Miriam, you.");
  });

  it("leaves text with no placeholder untouched", () => {
    expect(substituteName("No placeholder here.", "Ezra")).toBe("No placeholder here.");
  });

  it("does not touch a similarly-shaped but different token", () => {
    expect(substituteName("{Name} and {names} are not {name}.", "Ezra")).toBe(
      "{Name} and {names} are not Ezra.",
    );
  });
});
