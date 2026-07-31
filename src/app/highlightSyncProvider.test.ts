import { describe, expect, it, vi } from "vitest";
import { createInMemoryStorage } from "@/core/fixtures";
import {
  type CreateHighlightSyncProviderOptions,
  createHighlightSyncProvider,
  createStubHighlightSyncProvider,
  type HighlightsClientLike,
} from "./highlightSyncProvider";
import { writeStoredAuth } from "./youversionAuthStorage";
import type { VersionLookupClient } from "./youversionBibleVersion";

function signedInStorage(accessToken = "access-123") {
  const storage = createInMemoryStorage();
  writeStoredAuth(storage, { yvpId: "yvp-1", accessToken, refreshToken: "r", expiresAt: 0 });
  return storage;
}

function fakeHighlightsClient(
  overrides: { createHighlight?: HighlightsClientLike["createHighlight"] } = {},
): HighlightsClientLike & { createHighlight: ReturnType<typeof vi.fn> } {
  return {
    createHighlight: vi.fn(
      overrides.createHighlight ??
        (async (data) => ({ version_id: 0, passage_id: "", color: "", ...data })),
    ),
  };
}

function fakeVersionLookupClient(id: number | null = 206): VersionLookupClient & {
  getVersions: ReturnType<typeof vi.fn>;
} {
  const versions =
    id == null ? [] : [{ id, abbreviation: "engWEBUS", localized_abbreviation: "WEBUS" }];
  return {
    getVersions: vi.fn(async () => ({ data: versions, next_page_token: null })),
  } as unknown as VersionLookupClient & { getVersions: ReturnType<typeof vi.fn> };
}

describe("createStubHighlightSyncProvider", () => {
  it("is a labelled no-op that never fails", async () => {
    const provider = createStubHighlightSyncProvider();
    expect(provider.isStub).toBe(true);
    await expect(provider.syncOne("DAN.1.1", "ffeb3b")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(provider.syncAll({ "DAN.1.1": "ffeb3b" })).resolves.toEqual({
      ok: true,
      value: { synced: 0 },
    });
  });
});

describe("createHighlightSyncProvider (PRD-10)", () => {
  it("degrades to the stub when no app key is configured", () => {
    const provider = createHighlightSyncProvider({ appKey: undefined });
    expect(provider.isStub).toBe(true);
  });

  it("reports a recoverable error, rather than throwing, when nobody has signed in", async () => {
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage: createInMemoryStorage(),
      versionLookupClient: fakeVersionLookupClient(),
      highlightsClient: fakeHighlightsClient(),
    });

    const result = await provider.syncOne("DAN.1.1", "ffeb3b");
    expect(result).toEqual({ ok: false, reason: "not-signed-in" });
  });

  it("pushes one highlight through HighlightsClient using the resolved WEB version id and the stored access token", async () => {
    const storage = signedInStorage("token-abc");
    const highlightsClient = fakeHighlightsClient();
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage,
      versionLookupClient: fakeVersionLookupClient(206),
      highlightsClient,
    });

    const result = await provider.syncOne("DAN.1.1", "ffeb3b");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(highlightsClient.createHighlight).toHaveBeenCalledWith(
      { version_id: 206, passage_id: "DAN.1.1", color: "ffeb3b" },
      "token-abc",
    );
  });

  it("caches the resolved version id across calls rather than looking it up every time", async () => {
    const storage = signedInStorage();
    const versionLookupClient = fakeVersionLookupClient(206);
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage,
      versionLookupClient,
      highlightsClient: fakeHighlightsClient(),
    });

    await provider.syncOne("DAN.1.1", "ffeb3b");
    await provider.syncOne("2KI.24.1-4", "ffeb3b");

    expect(versionLookupClient.getVersions).toHaveBeenCalledTimes(1);
  });

  it("pushes every locally accumulated highlight on syncAll, not only new ones", async () => {
    const storage = signedInStorage();
    const highlightsClient = fakeHighlightsClient();
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage,
      versionLookupClient: fakeVersionLookupClient(206),
      highlightsClient,
    });

    const result = await provider.syncAll({
      "DAN.1.1": "ffeb3b",
      "2KI.24.1-4": "ffeb3b",
      "JER.25.2-11": "ffeb3b",
    });

    expect(result).toEqual({ ok: true, value: { synced: 3 } });
    expect(highlightsClient.createHighlight).toHaveBeenCalledTimes(3);
  });

  it("syncAll on an empty highlight map is a no-op success", async () => {
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage: signedInStorage(),
      versionLookupClient: fakeVersionLookupClient(206),
      highlightsClient: fakeHighlightsClient(),
    });

    await expect(provider.syncAll({})).resolves.toEqual({ ok: true, value: { synced: 0 } });
  });

  it("degrades to a recoverable error, never a throw, when the API call fails (never loses the local highlight)", async () => {
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage: signedInStorage(),
      versionLookupClient: fakeVersionLookupClient(206),
      highlightsClient: fakeHighlightsClient({
        createHighlight: async () => {
          throw new Error("network down");
        },
      }),
    });

    await expect(provider.syncOne("DAN.1.1", "ffeb3b")).resolves.toEqual({
      ok: false,
      reason: "highlight-sync-failed",
    });
  });

  it("reports a recoverable error when the Bible version cannot be resolved", async () => {
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage: signedInStorage(),
      versionLookupClient: fakeVersionLookupClient(null),
      highlightsClient: fakeHighlightsClient(),
    });

    await expect(provider.syncOne("DAN.1.1", "ffeb3b")).resolves.toEqual({
      ok: false,
      reason: "bible-version-unresolved",
    });
  });

  it("counts partial failures within syncAll without throwing", async () => {
    let call = 0;
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage: signedInStorage(),
      versionLookupClient: fakeVersionLookupClient(206),
      highlightsClient: fakeHighlightsClient({
        createHighlight: async (data) => {
          call += 1;
          if (call === 2) throw new Error("boom");
          return data;
        },
      }),
    });

    const result = await provider.syncAll({
      "DAN.1.1": "ffeb3b",
      "2KI.24.1-4": "ffeb3b",
      "JER.25.2-11": "ffeb3b",
    });

    expect(result).toEqual({ ok: true, value: { synced: 2 } });
  });

  // Every other spec here injects a versionLookupClient, so none of them could
  // see that the factory had no default for it: the provider runtime.ts builds
  // could never resolve a version id, and so failed `bible-version-unresolved`
  // on every highlight the real game ever tried to sync. This is the one spec
  // that exercises the un-injected path, the way runtime.ts calls it.
  it("resolves a Bible version with no lookup client injected, the way runtime.ts constructs it", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ id: 206, abbreviation: "engWEBUS", localized_abbreviation: "WEBUS" }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const highlightsClient = fakeHighlightsClient();
    const provider = createHighlightSyncProvider({
      appKey: "test-app-key",
      storage: signedInStorage(),
      highlightsClient,
    });

    const result = await provider.syncOne("DAN.1.1", "ffeb3b");

    expect(result).toEqual({ ok: true, value: undefined });
    expect(highlightsClient.createHighlight).toHaveBeenCalledWith(
      { version_id: 206, passage_id: "DAN.1.1", color: "ffeb3b" },
      "access-123",
    );

    vi.unstubAllGlobals();
  });
});

// Keep the exported options type honest against its own factory (a
// compile-time check, not a runtime assertion): every optional field here
// really is optional.
const _typeCheck: CreateHighlightSyncProviderOptions = {};
void _typeCheck;
