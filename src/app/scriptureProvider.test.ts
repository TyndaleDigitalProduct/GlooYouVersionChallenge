import { describe, expect, it, vi } from "vitest";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import {
  type BiblePassageLookupClient,
  createDefaultScriptureProvider,
  createScriptureProvider,
  createYouVersionScriptureProvider,
  parseUsfmReference,
  SCRIPTURE_UNAVAILABLE_REASON,
  type ScriptureBundleDocument,
} from "./scriptureProvider";
import type { VersionLookupClient } from "./youversionBibleVersion";

// A small, hand-built fixture bundle so range-resolution edge cases (a gap in
// the middle of a range, a range that partially overlaps the bundle) can be
// tested without depending on the shape of the real 112-verse bundle.
const fixtureDocument: ScriptureBundleDocument = {
  translation: "Test Bible",
  licence: "Public Domain",
  source: "fixture",
  retrieved: "2000-01-01",
  verses: {
    "GEN.1.1": "In the beginning.",
    "GEN.1.2": "The earth was formless.",
    "GEN.1.3": "Let there be light.",
    "2KI.24.1": "verse one.",
    "2KI.24.2": "verse two.",
    "2KI.24.3": "verse three.",
    "2KI.24.4": "verse four.",
  },
};

describe("parseUsfmReference", () => {
  it("parses a single-verse reference", () => {
    expect(parseUsfmReference("DAN.1.1")).toEqual({
      book: "DAN",
      chapter: 1,
      verseStart: 1,
      verseEnd: 1,
    });
  });

  it("parses a multi-verse range, including numbered book codes", () => {
    expect(parseUsfmReference("2KI.24.1-4")).toEqual({
      book: "2KI",
      chapter: 24,
      verseStart: 1,
      verseEnd: 4,
    });
  });

  it("returns null, not a throw, for a malformed reference", () => {
    expect(parseUsfmReference("not a reference")).toBeNull();
    expect(parseUsfmReference("")).toBeNull();
    expect(parseUsfmReference("DAN")).toBeNull();
    expect(parseUsfmReference("DAN.1")).toBeNull();
  });

  it("returns null for a reversed range", () => {
    expect(parseUsfmReference("DAN.1.5-2")).toBeNull();
  });
});

describe("createScriptureProvider", () => {
  it("reports isStub: false", () => {
    const provider = createScriptureProvider(fixtureDocument);
    expect(provider.isStub).toBe(false);
  });

  it("resolves a single bundled verse", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    const result = await provider.getPassage("GEN.1.1");
    expect(result).toEqual({
      status: "available",
      reference: "GEN.1.1",
      translation: "Test Bible",
      text: "In the beginning.",
    });
  });

  it("resolves a multi-verse range by concatenating every verse in order", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    const result = await provider.getPassage("GEN.1.1-3");
    expect(result).toEqual({
      status: "available",
      reference: "GEN.1.1-3",
      translation: "Test Bible",
      text: "In the beginning. The earth was formless. Let there be light.",
    });
  });

  it("resolves 2KI.24.1-4, the PRD's named multi-verse example", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    const result = await provider.getPassage("2KI.24.1-4");
    expect(result).toEqual({
      status: "available",
      reference: "2KI.24.1-4",
      translation: "Test Bible",
      text: "verse one. verse two. verse three. verse four.",
    });
  });

  it("returns the defined unavailable outcome for a reference the bundle does not cover", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    const result = await provider.getPassage("JHN.3.16");
    expect(result).toEqual({
      status: "unavailable",
      reference: "JHN.3.16",
      reason: SCRIPTURE_UNAVAILABLE_REASON,
    });
  });

  it("returns unavailable, never throws, for a malformed reference", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    await expect(provider.getPassage("not a reference")).resolves.toEqual({
      status: "unavailable",
      reference: "not a reference",
      reason: SCRIPTURE_UNAVAILABLE_REASON,
    });
  });

  it("returns unavailable for a range that only partially overlaps the bundle", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    // GEN.1.4 does not exist in the fixture, so the range as a whole fails
    // rather than silently returning a truncated passage.
    const result = await provider.getPassage("GEN.1.1-4");
    expect(result).toEqual({
      status: "unavailable",
      reference: "GEN.1.1-4",
      reason: SCRIPTURE_UNAVAILABLE_REASON,
    });
  });

  it("never throws regardless of input", async () => {
    const provider = createScriptureProvider(fixtureDocument);
    for (const input of ["", "   ", "GEN..1", "GEN.1.-1", "🙂", "GEN.1.999"]) {
      await expect(provider.getPassage(input)).resolves.toMatchObject({ status: "unavailable" });
    }
  });
});

describe("the real bundled provider against the real curated content", () => {
  // This is the criterion that actually proves the bundle is complete: every
  // reference the game's content pulls from — the 9 scene anchors plus the
  // 24 curated cross-references — must resolve through the real provider,
  // built on the real committed bundle at content/daniel-1.scripture.json.
  const provider = createScriptureProvider();

  interface RefsDocument {
    scenes: Array<{
      verses: string;
      cross_references: Array<{ ref: string }>;
    }>;
  }

  const refs = rawRefsDocument as RefsDocument;
  const sceneAnchors = refs.scenes.map((scene) => scene.verses);
  const crossReferences = refs.scenes.flatMap((scene) =>
    scene.cross_references.map((crossRef) => crossRef.ref),
  );
  const allReferences = [...new Set([...sceneAnchors, ...crossReferences])];

  it("the curated set names exactly 9 scene anchors and 24 cross-references", () => {
    expect(sceneAnchors).toHaveLength(9);
    expect(crossReferences).toHaveLength(24);
    expect(allReferences).toHaveLength(33);
  });

  it.each(allReferences)("%s resolves to available", async (reference) => {
    const result = await provider.getPassage(reference);
    expect(result.status).toBe("available");
  });

  it("reports the real bundle's translation as World English Bible", async () => {
    const result = await provider.getPassage(sceneAnchors[0]);
    expect(result).toMatchObject({ status: "available", translation: "World English Bible" });
  });

  // The PRD asks for cross-chapter range support "if any exist in the
  // curated set". None do: every reference in content/daniel-1.refs.json
  // names exactly one chapter, so parseUsfmReference's single-chapter
  // pattern is sufficient and cross-chapter support is correctly
  // unimplemented rather than accidentally missing. See DECISIONS.
  it("contains no cross-chapter ranges, so single-chapter parsing is sufficient", () => {
    for (const reference of allReferences) {
      expect(parseUsfmReference(reference)).not.toBeNull();
    }
  });
});

function fakePassageClient(
  overrides: {
    getVersions?: VersionLookupClient["getVersions"];
    getPassage?: BiblePassageLookupClient["getPassage"];
  } = {},
): BiblePassageLookupClient & VersionLookupClient {
  return {
    getVersions:
      overrides.getVersions ??
      (async () =>
        ({
          data: [{ id: 206, abbreviation: "engWEBUS", localized_abbreviation: "WEBUS" }],
          next_page_token: null,
        }) as never),
    getPassage:
      overrides.getPassage ??
      (async (_versionId, usfm) => ({
        id: usfm,
        content: `live text for ${usfm}`,
        reference: usfm,
      })),
  };
}

describe("createYouVersionScriptureProvider (PRD-10)", () => {
  it("reports isStub: false", () => {
    const provider = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient(),
    });
    expect(provider.isStub).toBe(false);
  });

  it("resolves the WEB version id once and fetches format=text passages against it", async () => {
    const getVersions = vi.fn(async () => ({
      data: [{ id: 206, abbreviation: "engWEBUS", localized_abbreviation: "WEBUS" }],
      next_page_token: null,
    })) as unknown as VersionLookupClient["getVersions"];
    const getPassage = vi.fn(async (versionId: number, usfm: string) => ({
      id: usfm,
      content: `text for ${usfm} @ ${versionId}`,
      reference: usfm,
    })) as unknown as BiblePassageLookupClient["getPassage"];

    const provider = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient({ getVersions, getPassage }),
    });

    const first = await provider.getPassage("DAN.1.1");
    expect(first).toEqual({
      status: "available",
      reference: "DAN.1.1",
      translation: "World English Bible",
      text: "text for DAN.1.1 @ 206",
    });

    await provider.getPassage("2KI.24.1-4");

    // Version lookup happens once, not once per passage fetched.
    expect(getVersions).toHaveBeenCalledTimes(1);
    expect(getPassage).toHaveBeenNthCalledWith(1, 206, "DAN.1.1", "text");
    expect(getPassage).toHaveBeenNthCalledWith(2, 206, "2KI.24.1-4", "text");
  });

  it("returns unavailable, without ever calling the API, for a malformed reference", async () => {
    const getPassage = vi.fn();
    const provider = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient({ getPassage: getPassage as never }),
    });

    const result = await provider.getPassage("not a reference");

    expect(result.status).toBe("unavailable");
    expect(getPassage).not.toHaveBeenCalled();
  });

  it("returns unavailable, never throws, when the WEB version cannot be resolved", async () => {
    const provider = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient({
        getVersions: async () => ({ data: [], next_page_token: null }) as never,
      }),
    });

    await expect(provider.getPassage("DAN.1.1")).resolves.toMatchObject({ status: "unavailable" });
  });

  it("returns unavailable, never throws, when the API call rejects", async () => {
    const provider = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient({
        getPassage: async () => {
          throw new Error("network down");
        },
      }),
    });

    await expect(provider.getPassage("DAN.1.1")).resolves.toMatchObject({ status: "unavailable" });
  });

  it("returns unavailable when the passage has no content", async () => {
    const provider = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient({
        getPassage: async (_versionId, usfm) => ({ id: usfm, content: "", reference: usfm }),
      }),
    });

    await expect(provider.getPassage("DAN.1.1")).resolves.toMatchObject({ status: "unavailable" });
  });
});

describe("createDefaultScriptureProvider (PRD-10)", () => {
  it("with no app key configured, is exactly the bundled provider (the no-credentials path)", async () => {
    const bundled = createScriptureProvider();
    const provider = createDefaultScriptureProvider({ appKey: undefined, bundled });

    expect(provider.isStub).toBe(false);
    await expect(provider.getPassage("DAN.1.1")).resolves.toEqual(
      await bundled.getPassage("DAN.1.1"),
    );
  });

  it("prefers a live YouVersion passage when one is available", async () => {
    const bundled = createScriptureProvider();
    const youversion = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient(),
    });

    const provider = createDefaultScriptureProvider({
      appKey: "test-app-key",
      bundled,
      youversion,
    });

    const result = await provider.getPassage("DAN.1.1");
    expect(result).toMatchObject({ status: "available", text: "live text for DAN.1.1" });
  });

  it("degrades to the bundled WEB text with no visible translation switch when the live fetch is unavailable", async () => {
    const bundled = createScriptureProvider();
    const youversion = createYouVersionScriptureProvider({
      appKey: "test-app-key",
      bibleClient: fakePassageClient({
        getPassage: async () => {
          throw new Error("outage");
        },
      }),
    });

    const provider = createDefaultScriptureProvider({
      appKey: "test-app-key",
      bundled,
      youversion,
    });

    const [liveDegraded, bundledDirect] = await Promise.all([
      provider.getPassage("DAN.1.1"),
      bundled.getPassage("DAN.1.1"),
    ]);

    expect(liveDegraded).toEqual(bundledDirect);
    expect(liveDegraded).toMatchObject({ translation: "World English Bible" });
  });
});
