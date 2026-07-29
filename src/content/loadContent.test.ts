import { describe, expect, it } from "vitest";
import realDialogueDocument from "../../content/daniel-1.dialogue.json";
import realRefsDocument from "../../content/daniel-1.refs.json";
import { buildGameContent, findCrossReferenceContent, findSceneContent } from "./loadContent";

function minimalRefs(overrides: Record<string, unknown> = {}) {
  return {
    book: "DAN",
    chapter: 1,
    reference_format: "usfm",
    scenes: [
      {
        id: 1,
        verses: "DAN.1.1",
        setting: "Jerusalem under siege",
        cross_references: [
          { ref: "2KI.24.1-4", anchor: "DAN.1.1", section: "OT History", note: "A note." },
        ],
      },
      { id: 2, verses: "DAN.1.2", setting: "Jerusalem falls", cross_references: [] },
    ],
    ...overrides,
  };
}

function minimalDialogue(overrides: Record<string, unknown> = {}) {
  return {
    status: "placeholder",
    note: "Placeholder copy.",
    scenes: [
      { id: 1, playable: true, beats: [{ speaker: "Narrator", text: "[PLACEHOLDER] One." }] },
      { id: 2, playable: false, beats: [] },
    ],
    ...overrides,
  };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.value;
}

describe("buildGameContent", () => {
  it("builds a manifest whose scene order matches the curated scene order", () => {
    const content = unwrap(buildGameContent(minimalRefs(), minimalDialogue()));

    expect(content.manifest.scenes).toEqual([
      { id: "scene-1", regionId: "region-1" },
      { id: "scene-2", regionId: "region-2" },
    ]);
  });

  it("carries every cross-reference into the manifest with its owning scene", () => {
    const content = unwrap(buildGameContent(minimalRefs(), minimalDialogue()));

    expect(content.manifest.crossReferences).toEqual([
      { reference: "2KI.24.1-4", sceneId: "scene-1" },
    ]);
  });

  it("joins dialogue beats onto the curated scene they belong to", () => {
    const content = unwrap(buildGameContent(minimalRefs(), minimalDialogue()));
    const sceneOne = findSceneContent(content, "scene-1");

    expect(sceneOne?.playable).toBe(true);
    expect(sceneOne?.beats).toHaveLength(1);
    expect(sceneOne?.setting).toBe("Jerusalem under siege");
    expect(findSceneContent(content, "scene-2")?.playable).toBe(false);
  });

  it("keeps the curated section and note on each cross-reference", () => {
    const content = unwrap(buildGameContent(minimalRefs(), minimalDialogue()));

    expect(findCrossReferenceContent(content, "2KI.24.1-4")).toEqual({
      reference: "2KI.24.1-4",
      sceneId: "scene-1",
      anchor: "DAN.1.1",
      section: "OT History",
      note: "A note.",
    });
  });

  it("rejects a refs document that is not an object", () => {
    const result = buildGameContent("not a document", minimalDialogue());

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("refs-document-invalid");
  });

  it("rejects a refs document with a wrong-typed field", () => {
    const result = buildGameContent(minimalRefs({ chapter: "one" }), minimalDialogue());

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("chapter");
  });

  it("rejects a dialogue document with an unrecognised status", () => {
    const result = buildGameContent(minimalRefs(), minimalDialogue({ status: "invalid-status" }));

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("dialogue-document-invalid");
  });

  it("rejects a dialogue beat with empty text", () => {
    const dialogue = minimalDialogue({
      scenes: [
        { id: 1, playable: true, beats: [{ speaker: "Narrator", text: "" }] },
        { id: 2, playable: false, beats: [] },
      ],
    });

    expect(buildGameContent(minimalRefs(), dialogue)).toMatchObject({ ok: false });
  });

  it("rejects a curated scene that has no dialogue entry", () => {
    const dialogue = minimalDialogue({
      scenes: [{ id: 1, playable: true, beats: [{ speaker: "Narrator", text: "One." }] }],
    });
    const result = buildGameContent(minimalRefs(), dialogue);

    expect(result.ok ? "" : result.reason).toContain("dialogue-missing-scene (2)");
  });

  it("rejects a dialogue entry for a scene the curated document does not have", () => {
    const dialogue = minimalDialogue({
      scenes: [
        { id: 1, playable: true, beats: [{ speaker: "Narrator", text: "One." }] },
        { id: 2, playable: false, beats: [] },
        { id: 3, playable: false, beats: [] },
      ],
    });
    const result = buildGameContent(minimalRefs(), dialogue);

    expect(result.ok ? "" : result.reason).toContain("dialogue-unknown-scene (3)");
  });

  it("rejects a playable scene that carries no beats", () => {
    const dialogue = minimalDialogue({
      scenes: [
        { id: 1, playable: true, beats: [] },
        { id: 2, playable: false, beats: [] },
      ],
    });
    const result = buildGameContent(minimalRefs(), dialogue);

    expect(result.ok ? "" : result.reason).toContain("playable-scene-without-dialogue (1)");
  });

  it("rejects curated scenes that are not numbered sequentially from one", () => {
    const refs = minimalRefs({
      scenes: [
        {
          id: 2,
          verses: "DAN.1.2",
          setting: "Out of order",
          cross_references: [],
        },
      ],
    });
    const dialogue = minimalDialogue({ scenes: [{ id: 2, playable: false, beats: [] }] });
    const result = buildGameContent(refs, dialogue);

    expect(result.ok ? "" : result.reason).toContain("refs-scenes-not-sequential");
  });

  it("rejects the same reference owned by two scenes, since core resolves by reference alone", () => {
    const refs = minimalRefs({
      scenes: [
        {
          id: 1,
          verses: "DAN.1.1",
          setting: "One",
          cross_references: [
            { ref: "2KI.24.1-4", anchor: "DAN.1.1", section: "OT History", note: "A note." },
          ],
        },
        {
          id: 2,
          verses: "DAN.1.2",
          setting: "Two",
          cross_references: [
            { ref: "2KI.24.1-4", anchor: "DAN.1.2", section: "OT History", note: "A note." },
          ],
        },
      ],
    });
    const result = buildGameContent(refs, minimalDialogue());

    expect(result.ok ? "" : result.reason).toContain("duplicate-cross-reference");
  });
});

describe("the real content files", () => {
  const content = unwrap(buildGameContent(realRefsDocument, realDialogueDocument));

  it("produce a nine-scene manifest with a region for every scene", () => {
    expect(content.manifest.scenes).toHaveLength(9);
    expect(content.manifest.scenes.map((scene) => scene.regionId)).toEqual([
      "region-1",
      "region-2",
      "region-3",
      "region-4",
      "region-5",
      "region-6",
      "region-7",
      "region-8",
      "region-9",
    ]);
  });

  it("produce all twenty-four curated cross-references", () => {
    expect(content.manifest.crossReferences).toHaveLength(24);
  });

  it("make scene 1 the only playable scene until PRD-12 wires runtime support for the rest", () => {
    const playable = content.scenes.filter((scene) => scene.playable);

    expect(playable.map((scene) => scene.id)).toEqual(["scene-1"]);
  });

  it("give scene 1 its two curated cross-references, with sections", () => {
    const sceneOne = findSceneContent(content, "scene-1");

    expect(sceneOne?.crossReferences.map((ref) => [ref.reference, ref.section])).toEqual([
      ["2KI.24.1-4", "OT History"],
      ["JER.25.2-11", "Prophets"],
    ]);
  });

  it("give every scene Lamplighter exit beats with a branch field", () => {
    for (const scene of content.scenes) {
      const exitBeats = scene.beats.filter((beat) => beat.branch !== undefined);
      const branches = exitBeats.map((beat) => beat.branch);
      expect(branches).toEqual(["all", "some", "none"]);
    }
  });
});
