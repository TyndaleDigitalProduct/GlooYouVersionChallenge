import { describe, expect, it } from "vitest";
import realDialogueDocument from "../../content/daniel-1.dialogue.json";
import realRefsDocument from "../../content/daniel-1.refs.json";
import {
  buildGameContent,
  characterIdFor,
  findCharacterDialogue,
  findCrossReferenceContent,
  findSceneContent,
} from "./loadContent";

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
      {
        id: 1,
        playable: true,
        lamplighterOpening: [{ text: "[PLACEHOLDER] One." }],
        characters: [],
        lamplighterExit: undefined,
      },
      {
        id: 2,
        playable: false,
        lamplighterOpening: [],
        characters: [],
        lamplighterExit: undefined,
      },
    ],
    ...overrides,
  };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.value;
}

function requireScene(content: Parameters<typeof findSceneContent>[0], sceneId: string) {
  const scene = findSceneContent(content, sceneId);
  if (!scene) throw new Error(`expected to find ${sceneId}`);
  return scene;
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

  it("flattens Lamplighter opening, then characters in file order, then the three branch exits", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "Opening one." }, { text: "Opening two." }],
          characters: [
            { speaker: "Daniel", beats: [{ text: "Daniel one." }, { text: "Daniel two." }] },
            { speaker: "A mother", beats: [{ text: "One line." }] },
          ],
          lamplighterExit: { all: "Exit all.", some: "Exit some.", none: "Exit none." },
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });
    const content = unwrap(buildGameContent(minimalRefs(), dialogue));
    const sceneOne = findSceneContent(content, "scene-1");

    expect(sceneOne?.beats).toEqual([
      { speaker: "The Lamplighter", text: "Opening one." },
      { speaker: "The Lamplighter", text: "Opening two." },
      { speaker: "Daniel", text: "Daniel one." },
      { speaker: "Daniel", text: "Daniel two." },
      { speaker: "A mother", text: "One line." },
      { speaker: "The Lamplighter", text: "Exit all.", branch: "all" },
      { speaker: "The Lamplighter", text: "Exit some.", branch: "some" },
      { speaker: "The Lamplighter", text: "Exit none.", branch: "none" },
    ]);
  });

  it("exposes the Lamplighter opening, characters, and exit separately for per-character lookup", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "Opening one." }],
          characters: [{ speaker: "A mother", beats: [{ text: "One line." }] }],
          lamplighterExit: { all: "Exit all.", some: "Exit some.", none: "Exit none." },
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });
    const content = unwrap(buildGameContent(minimalRefs(), dialogue));
    const sceneOne = findSceneContent(content, "scene-1");

    expect(sceneOne?.lamplighterOpening).toEqual([
      { speaker: "The Lamplighter", text: "Opening one." },
    ]);
    expect(sceneOne?.characters).toEqual([
      { speaker: "A mother", characterId: "a-mother", beats: [{ text: "One line." }] },
    ]);
    expect(sceneOne?.lamplighterExit).toEqual({
      all: "Exit all.",
      some: "Exit some.",
      none: "Exit none.",
    });
  });

  it("looks a character up by speaker string or by its derived id", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "Opening one." }],
          characters: [{ speaker: "A mother", beats: [{ text: "One line." }] }],
          lamplighterExit: undefined,
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });
    const content = unwrap(buildGameContent(minimalRefs(), dialogue));
    const sceneOne = requireScene(content, "scene-1");

    expect(findCharacterDialogue(sceneOne, "A mother")?.beats).toEqual([{ text: "One line." }]);
    expect(findCharacterDialogue(sceneOne, "a-mother")?.speaker).toBe("A mother");
    expect(findCharacterDialogue(sceneOne, "nobody")).toBeUndefined();
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
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "" }],
          characters: [],
          lamplighterExit: undefined,
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });

    expect(buildGameContent(minimalRefs(), dialogue)).toMatchObject({ ok: false });
  });

  it("rejects a character beat group with no beats", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "Opening." }],
          characters: [{ speaker: "Narrator", beats: [] }],
          lamplighterExit: undefined,
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });

    expect(buildGameContent(minimalRefs(), dialogue)).toMatchObject({ ok: false });
  });

  it("rejects a curated scene that has no dialogue entry", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "One." }],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });
    const result = buildGameContent(minimalRefs(), dialogue);

    expect(result.ok ? "" : result.reason).toContain("dialogue-missing-scene (2)");
  });

  it("rejects a dialogue entry for a scene the curated document does not have", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "One." }],
          characters: [],
          lamplighterExit: undefined,
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
        {
          id: 3,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });
    const result = buildGameContent(minimalRefs(), dialogue);

    expect(result.ok ? "" : result.reason).toContain("dialogue-unknown-scene (3)");
  });

  it("rejects a playable scene that carries no dialogue at all", () => {
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
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
    const dialogue = minimalDialogue({
      scenes: [
        {
          id: 2,
          playable: false,
          lamplighterOpening: [],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    });
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

describe("characterIdFor", () => {
  it("lowercases and hyphenates a speaker name", () => {
    expect(characterIdFor("Daniel")).toBe("daniel");
    expect(characterIdFor("A mother")).toBe("a-mother");
    expect(characterIdFor("Soldier on the wall")).toBe("soldier-on-the-wall");
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

  it("give every scene a lamplighterExit with all three branches as non-empty text", () => {
    for (const scene of content.scenes) {
      expect(scene.lamplighterExit?.all.length, `scene ${scene.id}`).toBeGreaterThan(0);
      expect(scene.lamplighterExit?.some.length, `scene ${scene.id}`).toBeGreaterThan(0);
      expect(scene.lamplighterExit?.none.length, `scene ${scene.id}`).toBeGreaterThan(0);
    }
  });

  it("give scene 1 a per-character lookup for every story character and NPC", () => {
    const sceneOne = requireScene(content, "scene-1");
    const speakers = sceneOne.characters.map((character) => character.speaker);

    expect(speakers).toEqual([
      "Daniel",
      "Hananiah",
      "Mishael",
      "Azariah",
      "Nebuchadnezzar",
      "Gatekeeper",
      "A mother",
      "Soldier on the wall",
      "Market vendor",
    ]);
    expect(findCharacterDialogue(sceneOne, "Daniel")?.beats).toHaveLength(2);
    expect(findCharacterDialogue(sceneOne, "market-vendor")?.beats).toHaveLength(1);
  });

  it("keeps the derived beats array in exact agreement with the per-speaker fields it was built from", () => {
    for (const scene of content.scenes) {
      const expected = [
        ...scene.lamplighterOpening,
        ...scene.characters.flatMap((character) =>
          character.beats.map((beat) => ({ speaker: character.speaker, text: beat.text })),
        ),
        ...(scene.lamplighterExit
          ? [
              {
                speaker: "The Lamplighter",
                text: scene.lamplighterExit.all,
                branch: "all" as const,
              },
              {
                speaker: "The Lamplighter",
                text: scene.lamplighterExit.some,
                branch: "some" as const,
              },
              {
                speaker: "The Lamplighter",
                text: scene.lamplighterExit.none,
                branch: "none" as const,
              },
            ]
          : []),
      ];

      expect(scene.beats, `scene ${scene.id}`).toEqual(expected);
    }
  });

  it("gives every story character and NPC a stable, non-empty characterId", () => {
    for (const scene of content.scenes) {
      for (const character of scene.characters) {
        expect(character.characterId.length, `${scene.id}/${character.speaker}`).toBeGreaterThan(0);
      }
    }
  });
});
