// The real HighlightSyncProvider (PRD-10): the opt-in layer on top of
// unconditional local capture (src/core/highlights.ts). Built on
// @youversion/platform-core's official `HighlightsClient`, never a
// hand-rolled fetch to `/v1/highlights`. Every failure here — no session, no
// resolvable Bible version, a rejected API call — is a `Result` the caller
// handles, never a thrown exception: the local highlight this seam syncs was
// already written before either method here is ever called (see
// highlightController.ts / runtime.ts), so a sync failure is recoverable by
// construction and never loses it.
import { ApiClient, BibleClient, HighlightsClient } from "@youversion/platform-core";
import { createBrowserStorage } from "@/app/browserStorage";
import type { Highlights } from "@/core/highlights";
import { err, ok, type Result } from "@/core/result";
import type { Storage as CoreStorage } from "@/core/storage";
import type { HighlightSyncProvider } from "./providers";
import { readStoredAuth } from "./youversionAuthStorage";
import { resolveWebVersionId, type VersionLookupClient } from "./youversionBibleVersion";
import { getConfiguredYouVersionAppKey } from "./youversionConfig";

/** The narrow slice of HighlightsClient this seam calls, so tests can inject a fake. */
export type HighlightsClientLike = Pick<HighlightsClient, "createHighlight">;

export function createStubHighlightSyncProvider(): HighlightSyncProvider {
  return {
    isStub: true,
    syncOne: () => Promise.resolve(ok(undefined)),
    syncAll: () => Promise.resolve(ok({ synced: 0 })),
  };
}

export interface CreateHighlightSyncProviderOptions {
  /** Defaults to the one credential AGENTS.md §6 permits in the bundle. */
  appKey?: string;
  storage?: CoreStorage;
  highlightsClient?: HighlightsClientLike;
  versionLookupClient?: VersionLookupClient;
  /** Skips version resolution entirely; mainly for tests. */
  versionId?: number;
}

/**
 * The real, HighlightsClient-backed provider. Degrades to
 * `createStubHighlightSyncProvider()` with no `app_key` configured — the
 * same no-credentials path every other YouVersion-backed seam takes.
 */
export function createHighlightSyncProvider(
  options: CreateHighlightSyncProviderOptions = {},
): HighlightSyncProvider {
  const appKey = options.appKey ?? getConfiguredYouVersionAppKey();
  if (!appKey) return createStubHighlightSyncProvider();

  const {
    storage = createBrowserStorage(),
    highlightsClient = new HighlightsClient(new ApiClient({ appKey })),
    // Defaulted for the same reason scriptureProvider.ts defaults its
    // BibleClient: without one, `resolvedVersionId` below has nothing to ask
    // and every sync fails `bible-version-unresolved`. Left undefined here,
    // this seam was inert in the real app while every test passed, because
    // each test injects its own lookup client.
    versionLookupClient = new BibleClient(new ApiClient({ appKey })),
  } = options;

  // Resolved once per provider instance and reused (youversionBibleVersion.ts
  // has no cache of its own), rather than one lookup per highlight synced.
  let cachedVersionId: number | null = options.versionId ?? null;
  let resolving: Promise<number | null> | null = null;

  async function resolvedVersionId(): Promise<number | null> {
    if (cachedVersionId != null) return cachedVersionId;
    if (!versionLookupClient) return null;
    if (!resolving) {
      resolving = resolveWebVersionId(versionLookupClient).then((id) => {
        cachedVersionId = id;
        return id;
      });
    }
    return resolving;
  }

  async function syncOne(reference: string, color: string): Promise<Result<void>> {
    const auth = readStoredAuth(storage);
    if (!auth) return err("not-signed-in");

    const versionId = await resolvedVersionId();
    if (versionId == null) return err("bible-version-unresolved");

    try {
      await highlightsClient.createHighlight(
        { version_id: versionId, passage_id: reference, color },
        auth.accessToken,
      );
      return ok(undefined);
    } catch {
      return err("highlight-sync-failed");
    }
  }

  async function syncAll(highlights: Highlights): Promise<Result<{ synced: number }>> {
    let synced = 0;
    for (const [reference, color] of Object.entries(highlights)) {
      const result = await syncOne(reference, color);
      if (result.ok) synced += 1;
    }
    return ok({ synced });
  }

  return { isStub: false, syncOne, syncAll };
}
