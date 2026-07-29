// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createFailingStorage, createInMemoryStorage } from "./fixtures";
import { CURRENT_SAVE_VERSION, createFreshState, loadGame, saveGame, serializeState } from "./save";

describe("save format (v3)", () => {
  it("has an explicit integer version field on a fresh state", () => {
    const state = createFreshState();
    expect(Number.isInteger(state.version)).toBe(true);
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.version).toBe(3);
  });

  it("leaves playerName absent on a fresh state: legal at the schema level", () => {
    const state = createFreshState();
    expect(state.playerName).toBeUndefined();
    expect("playerName" in state).toBe(false);
  });

  it("round trips at v3, including cards and selections, deep-equal", () => {
    const state = createFreshState();
    state.completedSceneIds.push("scene-1");
    state.highlights["FIX.1.1"] = "yellow";
    state.ledger.push(
      {
        id: "scene-1:FIX.1.1:engagement",
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement",
        amount: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "scene-1:FIX.1.1:insight",
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "insight",
        amount: 8,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "scene-1:scene-complete",
        sceneId: "scene-1",
        cause: "scene-complete",
        amount: 5,
        createdAt: "2026-01-01T00:00:02.000Z",
      },
    );
    state.encounters["scene-1::FIX.1.1"] = {
      state: "resolved",
      cards: [
        { id: "c1", text: "Card one", value: 5 },
        { id: "c2", text: "Card two", value: 4 },
        { id: "c3", text: "Card three", value: 3 },
        { id: "c4", text: "Card four", value: 0 },
        { id: "c5", text: "Card five", value: 2 },
        { id: "c6", text: "Card six", value: 1 },
      ],
      selections: ["c1", "c3"],
    };
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

  it("handles a non-integer version as a defined, recoverable outcome", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify({ ...createFreshState(), version: 1.5 }));

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

describe("migration chain: v1 -> v2 -> v3", () => {
  const v1Save = {
    version: 1,
    completedSceneIds: ["scene-1"],
    encounters: {
      "scene-1::FIX.1.1": "engaged",
      "scene-1::FIX.1.2": "insight-recognised",
    },
    ledger: [
      {
        id: "scene-1:FIX.1.1:engagement",
        sceneId: "scene-1",
        reference: "FIX.1.1",
        cause: "engagement",
        amount: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "scene-1:FIX.1.2:insight",
        sceneId: "scene-1",
        reference: "FIX.1.2",
        cause: "insight",
        amount: 2,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
    ],
    session: null,
    // v1 predates highlights; v2 adds the field with a default.
  };

  it("runs the full v1 -> v2 -> v3 chain on a v1 blob, not just one hop", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v1Save));

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("migrated");
    expect(loaded.state.version).toBe(CURRENT_SAVE_VERSION);
    if (loaded.status === "migrated") {
      expect(loaded.fromVersion).toBe(1);
    }
    expect(loaded.state.highlights).toEqual({});
    expect(loaded.state.completedSceneIds).toEqual(["scene-1"]);
  });

  it("renames insight-recognised to resolved and converts bare strings to records", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v1Save));

    const loaded = loadGame(storage, "save");
    expect(loaded.state.encounters).toEqual({
      "scene-1::FIX.1.1": { state: "engaged" },
      "scene-1::FIX.1.2": { state: "resolved" },
    });
  });

  it("a v2 encounter resolved under the old model has no cards; the migrated record renders resolved with no card set, which is legal", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v1Save));

    const loaded = loadGame(storage, "save");
    const migrated = loaded.state.encounters["scene-1::FIX.1.2"];
    expect(migrated.state).toBe("resolved");
    expect(migrated.cards).toBeUndefined();
    expect(migrated.selections).toBeUndefined();

    // And re-saving/reloading that exact migrated state is itself a legal,
    // non-recovered v3 save (the schema accepts an absent card set).
    const resaveStorage = createInMemoryStorage();
    saveGame(resaveStorage, "save", loaded.state);
    const reloaded = loadGame(resaveStorage, "save");
    expect(reloaded.status).toBe("ok");
    expect(reloaded.state).toEqual(loaded.state);
  });

  it("migrating a v1 blob preserves the ledger entries as-is (v1/v2 causes are a subset of v3's)", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v1Save));

    const loaded = loadGame(storage, "save");
    expect(loaded.state.ledger).toEqual(v1Save.ledger);
  });

  it("an absent player name is legal after migrateV2ToV3", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v1Save));

    const loaded = loadGame(storage, "save");
    expect(loaded.state.playerName).toBeUndefined();
    expect("playerName" in loaded.state).toBe(false);
  });

  it("migrates a version 2 save directly to v3 in one hop", () => {
    const v2Save = {
      version: 2,
      completedSceneIds: ["scene-1"],
      encounters: { "scene-1::FIX.1.1": "insight-recognised" },
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
      highlights: { "FIX.1.1": "yellow" },
      session: { yvpId: "yvp-123" },
    };
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify(v2Save));

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("migrated");
    if (loaded.status === "migrated") {
      expect(loaded.fromVersion).toBe(2);
    }
    expect(loaded.state.encounters).toEqual({ "scene-1::FIX.1.1": { state: "resolved" } });
    expect(loaded.state.highlights).toEqual({ "FIX.1.1": "yellow" });
    expect(loaded.state.session).toEqual({ yvpId: "yvp-123" });
  });

  it("rejects a v1 blob that fails its own schema, as a recovered outcome", () => {
    const storage = createInMemoryStorage();
    storage.setItem("save", JSON.stringify({ ...v1Save, completedSceneIds: "not-an-array" }));

    const loaded = loadGame(storage, "save");
    expect(loaded.status).toBe("recovered");
  });
});
