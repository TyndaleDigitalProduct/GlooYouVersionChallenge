import { describe, expect, it, vi } from "vitest";
import { resolveWebVersionId, type VersionLookupClient } from "./youversionBibleVersion";

/**
 * The English versions `GET /v1/bibles?language_ranges[]=eng` actually returns,
 * abridged to the entries that matter to this lookup. Recorded from the live
 * API rather than invented: the original bug here was a fake that used an
 * abbreviation (`WEB`) the API does not publish, so a fixture that agrees with
 * the code instead of with YouVersion is exactly what must not be asserted.
 */
const LIVE_ENGLISH_VERSIONS = [
  { id: 12, abbreviation: "ASV", localized_abbreviation: "ASV" },
  { id: 3034, abbreviation: "BSB", localized_abbreviation: "BSB" },
  { id: 206, abbreviation: "engWEBUS", localized_abbreviation: "WEBUS" },
  { id: 1209, abbreviation: "WMB", localized_abbreviation: "WMB" },
  { id: 1207, abbreviation: "WMBBE", localized_abbreviation: "WMBBE" },
];

function lookupClient(data: unknown[]): VersionLookupClient {
  return {
    getVersions: vi.fn(async () => ({ data, next_page_token: null })),
  } as unknown as VersionLookupClient;
}

describe("resolveWebVersionId (PRD-10)", () => {
  it("finds the WEB in the version list the live API actually returns", async () => {
    await expect(resolveWebVersionId(lookupClient(LIVE_ENGLISH_VERSIONS))).resolves.toBe(206);
  });

  it("never mistakes the World Messianic Bible for the World English Bible", async () => {
    const withoutWeb = LIVE_ENGLISH_VERSIONS.filter((version) => version.id !== 206);
    await expect(resolveWebVersionId(lookupClient(withoutWeb))).resolves.toBeNull();
  });

  it("still resolves if YouVersion republishes it under the plain WEB abbreviation", async () => {
    const republished = [{ id: 206, abbreviation: "WEB", localized_abbreviation: "WEB" }];
    await expect(resolveWebVersionId(lookupClient(republished))).resolves.toBe(206);
  });

  it("returns null, rather than throwing, when the lookup itself fails", async () => {
    const failing = {
      getVersions: vi.fn(async () => {
        throw new Error("network down");
      }),
    } as unknown as VersionLookupClient;

    await expect(resolveWebVersionId(failing)).resolves.toBeNull();
  });

  it("returns null on an empty version list", async () => {
    await expect(resolveWebVersionId(lookupClient([]))).resolves.toBeNull();
  });
});
