import { describe, expect, it } from "vitest";
import rawRefsDocument from "../../content/daniel-1.refs.json";
import {
  createScriptureProvider,
  parseUsfmReference,
  SCRIPTURE_UNAVAILABLE_REASON,
  type ScriptureBundleDocument,
} from "./scriptureProvider";

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
