import { describe, expect, it, vi } from "vitest";
import { loadGame, saveGame } from "@/core/save";
import { createBrowserStorage, SAVE_KEY } from "./browserStorage";

describe("browser storage adapter", () => {
  it("reads and writes through the injected source", () => {
    const data = new Map<string, string>();
    const storage = createBrowserStorage(() => ({
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
    }));

    storage.setItem("k", "v");

    expect(storage.getItem("k")).toBe("v");
    expect(storage.getItem("absent")).toBeNull();
  });

  it("defaults to window.localStorage", () => {
    const storage = createBrowserStorage();

    storage.setItem(SAVE_KEY, "written-by-the-adapter");

    expect(window.localStorage.getItem(SAVE_KEY)).toBe("written-by-the-adapter");
    window.localStorage.removeItem(SAVE_KEY);
  });

  it("reads the source lazily, so a throwing source becomes a recoverable load", () => {
    // Touching window.localStorage can itself throw in some privacy modes.
    // Reading it inside the closure keeps that inside src/core's try/catch.
    const storage = createBrowserStorage(() => {
      throw new Error("storage disabled");
    });

    expect(loadGame(storage, SAVE_KEY)).toMatchObject({
      status: "recovered",
      reason: "storage-unavailable",
    });
  });

  it("reports a failed write as retryable rather than throwing", () => {
    const storage = createBrowserStorage(() => ({
      getItem: () => null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    }));

    const result = saveGame(storage, SAVE_KEY, {
      version: 2,
      completedSceneIds: [],
      encounters: {},
      ledger: [],
      highlights: {},
      session: null,
    });

    expect(result).toMatchObject({ ok: false, retryable: true });
  });

  it("does not touch window when a source is injected", () => {
    const getItem = vi.fn(() => null);
    const storage = createBrowserStorage(() => ({ getItem, setItem: vi.fn() }));

    storage.getItem("k");

    expect(getItem).toHaveBeenCalledWith("k");
  });
});
