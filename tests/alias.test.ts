import { describe, expect, it } from "vitest";
import { CORE_READY } from "@/core";

describe("@/* path alias", () => {
  it("resolves a trivial export from src/core through the @/core alias", () => {
    expect(CORE_READY).toBe(true);
  });
});
