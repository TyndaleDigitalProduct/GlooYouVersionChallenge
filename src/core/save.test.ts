// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createFailingStorage, createInMemoryStorage } from "./fixtures";
import { CURRENT_SAVE_VERSION, createFreshState, loadGame, saveGame, serializeState } from "./save";

describe("save format", () => {
  it("has an explicit integer version field on a fresh state", () => {
    const state = createFreshState();
    expect(Number.isInteger(state.version)).toBe(true);
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
  });

  it("round trips: serialise then deserialise yields a deep-equal state", () => {
    const state = createFreshState();
    state.completedSceneIds.push("scene-1");
    state.highlights["FIX.1.1"] = "yellow";
    state.ledger.push({
      id: "scene-1:FIX.1.1:engagement",
      sceneId: "scene-1",
      reference: "FIX.1.1",
      cause: "engagement",
      amount: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    state.encounters["scene-1::FIX.1.1"] = "engaged";
    state.session = { yvpId: "yvp-123" };

    const storage = createInMemoryStorage();
    const writeResult = saveGame(storage, "save", state);
    expect(writeResult.ok).toBe(true);

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("ok");
    expect(loaded.state).toEqual(state);
  });

  it("produces a fresh state with no error when there is no existing save", () => {
    const storage = createInMemoryStorage();
    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("ok");
    expect(loaded.state).toEqual(createFreshState());
  });

  it("handles malformed JSON as a defined, recoverable outcome, never a throw", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", "{not json");

    expect(() => loadGame(storage, "save")).not.toThrow();
    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("recovered");
    expect(loaded.state).toEqual(createFreshState());
    if (loaded.status === "recovered") {
      expect(typeof loaded.reason).toBe("string");
    }
  });

  it("handles a missing version field as a defined, recoverable outcome", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify({ completedSceneIds: [] }));

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("recovered");
    expect(loaded.state).toEqual(createFreshState());
  });

  it("handles a wrong-typed field as a defined, recoverable outcome", () => {
    const storage = createInMemoryStorage();
    const state = createFreshState();
    storage.setItem(
      "save",
      JSON.stringify({ ...state, completedSceneIds: "scene-1" /* should be an array */ }),
    );

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("recovered");
    expect(loaded.state).toEqual(createFreshState());
  });

  it("handles an unknown future version as a defined, recoverable outcome", () => {
    const storage = createInMemoryStorage();
    const state = createFreshState();
    storage.setItem("save", JSON.stringify({ ...state, version: CURRENT_SAVE_VERSION + 1 }));

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("recovered");
    expect(loaded.state).toEqual(createFreshState());
  });

  it("never silently discards a valid save: a well-formed current-version save loads as-is, not recovered", () => {
    const storage = createInMemoryStorage();
    const state = createFreshState();
    state.completedSceneIds.push("scene-1");
    saveGame(storage, "save", state);

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("ok");
    expect(loaded.state).toEqual(state);
  });

  it("migrates a version 1 save to the current version via a tested migration path", () => {
    const v1Save = {
      version: 1,
      completedSceneIds: ["scene-1"],
      encounters: { "scene-1::FIX.1.1": "engaged" },
      ledger: [
        {
          id: "scene-1:FIX.1.1:engagement",
          sceneId: "scene-1",
          reference: "FIX.1.1",
          cause: "engagement",
          amount: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      session: null,
      // v1 predates highlights; v2 adds the field with a default.
    };
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v1Save));

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("migrated");
    expect(loaded.state.version).toBe(CURRENT_SAVE_VERSION);
    expect(loaded.state.highlights).toEqual({});
    expect(loaded.state.completedSceneIds).toEqual(["scene-1"]);
    if (loaded.status === "migrated") {
      expect(loaded.fromVersion).toBe(1);
    }
  });

  it("reports a save write failure as a retryable outcome", () => {
    const storage = createFailingStorage();
    const result = saveGame(storage, "save", createFreshState());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(true);
      expect(typeof result.error).toBe("string");
    }
  });

  it("a storage double that cannot read reports a recoverable outcome rather than throwing", () => {
    const storage = createFailingStorage();
    // getItem on this double never throws; it simply has nothing stored yet.
    expect(storage.getItem("save")).toBeNull();
    expect(() => loadGame(storage, "save")).not.toThrow();
  });

  it("serializeState produces JSON parseable back into the same shape", () => {
    const state = createFreshState();
    const json = serializeState(state);
    expect(JSON.parse(json)).toEqual(state);
  });
});
