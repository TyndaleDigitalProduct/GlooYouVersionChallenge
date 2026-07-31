import { describe, expect, it, vi } from "vitest";
import { resolvePreferredVersion, type VersionLookupClient } from "./youversionBibleVersion";

/**
 * The English versions `GET /v1/bibles?language_ranges[]=eng` actually returns,
 * abridged to the entries that matter to this lookup. Recorded from the live
 * API rather than invented: the original bug here was a fake that used an
 * abbreviation (`WEB`) the API does not publish, so a fixture that agrees with
 * the code instead of with YouVersion is exactly what must not be asserted.
 */
const LIVE_ENGLISH_VERSIONS = [
  {
    id: 12,
    abbreviation: "ASV",
    localized_abbreviation: "ASV",
    localized_title: "American Standard Version",
  },
  {
    id: 111,
    abbreviation: "NIV11",
    localized_abbreviation: "NIV",
    localized_title: "New International Version",
  },
  {
    id: 113,
    abbreviation: "NIVUK11",
    localized_abbreviation: "NIVUK",
    localized_title: "New International Version (Anglicised)",
  },
  {
    id: 206,
    abbreviation: "engWEBUS",
    localized_abbreviation: "WEBUS",
    localized_title: "World English Bible, American English Edition",
  },
];

function lookupClient(data: unknown[]): VersionLookupClient {
  return {
    getVersions: vi.fn(async () => ({ data, next_page_token: null })),
  } as unknown as VersionLookupClient;
}

describe("resolvePreferredVersion (PRD-10)", () => {
  it("resolves the NIV from the version list the live API actually returns", async () => {
    await expect(resolvePreferredVersion(lookupClient(LIVE_ENGLISH_VERSIONS))).resolves.toEqual({
      id: 111,
      title: "New International Version",
    });
  });

  // The Anglicised edition sits next to the NIV in the same response and
  // matches on a prefix of the same abbreviation, so this is the near-miss the
  // preference order exists to rule out.
  it("never resolves the Anglicised edition in place of the NIV", async () => {
    const anglicisedOnly = LIVE_ENGLISH_VERSIONS.filter((version) => version.id !== 111);
    await expect(resolvePreferredVersion(lookupClient(anglicisedOnly))).resolves.toBeNull();
  });

  it("carries the translation name, so no caller has to hard-code one", async () => {
    const resolved = await resolvePreferredVersion(lookupClient(LIVE_ENGLISH_VERSIONS));
    expect(resolved?.title).toBe("New International Version");
  });

  it("falls back to the abbreviation when a version carries no localized title", async () => {
    const untitled = [{ id: 111, abbreviation: "NIV11", localized_abbreviation: "NIV" }];
    await expect(resolvePreferredVersion(lookupClient(untitled))).resolves.toEqual({
      id: 111,
      title: "NIV11",
    });
  });

  it("returns null, rather than throwing, when the lookup itself fails", async () => {
    const failing = {
      getVersions: vi.fn(async () => {
        throw new Error("network down");
      }),
    } as unknown as VersionLookupClient;

    await expect(resolvePreferredVersion(failing)).resolves.toBeNull();
  });

  it("returns null on an empty version list", async () => {
    await expect(resolvePreferredVersion(lookupClient([]))).resolves.toBeNull();
  });
});
