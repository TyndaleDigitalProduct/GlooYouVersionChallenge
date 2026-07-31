import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "@/core/eventBus";
import { createInMemoryStorage } from "@/core/fixtures";
import { HIGHLIGHT_COLOR, highlightPassage } from "./highlightController";
import { createAppRuntime } from "./runtime";

function boot(overrides: Parameters<typeof createAppRuntime>[0] = {}) {
  const result = createAppRuntime({
    storage: createInMemoryStorage(),
    saveKey: "test:highlight-controller",
    bus: createEventBus(),
    ...overrides,
  });
  if (!result.ok) throw new Error(`runtime failed to boot: ${result.reason}`);
  return result.value;
}

describe("highlightPassage (PRD-10)", () => {
  it("records the highlight locally, unconditionally, regardless of session state", () => {
    const runtime = boot();
    expect(runtime.store.getState().session).toBeNull();

    highlightPassage(runtime, "DAN.1.1");

    expect(runtime.store.getState().highlights).toEqual({ "DAN.1.1": HIGHLIGHT_COLOR });
  });

  it("is idempotent: tapping twice does not change the stored colour", () => {
    const runtime = boot();

    highlightPassage(runtime, "DAN.1.1");
    highlightPassage(runtime, "DAN.1.1");

    expect(runtime.store.getState().highlights).toEqual({ "DAN.1.1": HIGHLIGHT_COLOR });
  });

  it("attempts no sync at all when nobody is signed in", () => {
    const syncOne = vi.fn();
    const runtime = boot({ highlightSync: { isStub: false, syncOne, syncAll: vi.fn() } });

    highlightPassage(runtime, "DAN.1.1");

    expect(syncOne).not.toHaveBeenCalled();
  });

  it("syncs the single highlight through the provider once signed in", async () => {
    const syncOne = vi.fn(async () => ({ ok: true as const, value: undefined }));
    const fakeSession = {
      isStub: false,
      current: () => ({ yvpId: "yvp-1" }),
      signOut: () => undefined,
      signIn: vi.fn(),
    };
    const runtime = boot({
      session: fakeSession,
      highlightSync: { isStub: false, syncOne, syncAll: vi.fn() },
    });

    highlightPassage(runtime, "DAN.1.1");
    await Promise.resolve();
    await Promise.resolve();

    expect(syncOne).toHaveBeenCalledWith("DAN.1.1", HIGHLIGHT_COLOR);
  });

  it("never loses the local highlight when the sync fails, and surfaces a recoverable notice", async () => {
    const syncOne = vi.fn(async () => ({ ok: false as const, reason: "highlight-sync-failed" }));
    const fakeSession = {
      isStub: false,
      current: () => ({ yvpId: "yvp-1" }),
      signOut: () => undefined,
      signIn: vi.fn(),
    };
    const runtime = boot({
      session: fakeSession,
      highlightSync: { isStub: false, syncOne, syncAll: vi.fn() },
    });

    highlightPassage(runtime, "DAN.1.1");
    // Let the fire-and-forget sync settle.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(runtime.store.getState().highlights).toEqual({ "DAN.1.1": HIGHLIGHT_COLOR });
    expect(runtime.view.getState().notices).toContainEqual(
      expect.objectContaining({ tone: "warning" }),
    );
  });
});
