import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import realCastDocument from "../../content/characters.json";
import realDialogueDocument from "../../content/daniel-1.dialogue.json";
import realRefsDocument from "../../content/daniel-1.refs.json";
import { buildCast, guideArtFor, spriteKeysToPreload, storyCharacterArtFor } from "./cast";
import { buildGameContent, type GameContent } from "./loadContent";

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.value;
}

const realContent: GameContent = unwrap(buildGameContent(realRefsDocument, realDialogueDocument));

function minimalCast(overrides: Record<string, unknown> = {}) {
  return {
    status: "final",
    note: "Named art.",
    player: { sprite: "player_male-tone2" },
    lamplighter: { sprite: "lamplighter-tone2" },
    guidesBySection: {
      "OT History": {
        sprite: "chronicler-tone1",
        portrait: "ex_scribe-tone1",
        markerColor: "0x4f8fd4",
      },
    },
    storyCharactersBySpeaker: {},
    ...overrides,
  };
}

/** Content whose only cross-reference section is "OT History". */
const oneSectionContent: GameContent = unwrap(
  buildGameContent(
    {
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
      ],
    },
    {
      status: "placeholder",
      note: "Placeholder.",
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "One." }],
          characters: [],
          lamplighterExit: undefined,
        },
      ],
    },
  ),
);

/** Same as `oneSectionContent`, but scene 1 also has a story character with lines. */
const contentWithCharacter: GameContent = unwrap(
  buildGameContent(
    {
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
      ],
    },
    {
      status: "placeholder",
      note: "Placeholder.",
      scenes: [
        {
          id: 1,
          playable: true,
          lamplighterOpening: [{ text: "One." }],
          characters: [{ speaker: "A mother", beats: [{ text: "A line." }] }],
          lamplighterExit: undefined,
        },
      ],
    },
  ),
);

describe("buildCast", () => {
  it("parses the player sprite, the Lamplighter sprite, and each section's art", () => {
    const cast = unwrap(buildCast(minimalCast(), oneSectionContent));

    expect(cast.playerSpriteKey).toBe("player_male-tone2");
    expect(cast.lamplighterSpriteKey).toBe("lamplighter-tone2");
    expect(guideArtFor(cast, "OT History")).toEqual({
      section: "OT History",
      spriteKey: "chronicler-tone1",
      portraitKey: "ex_scribe-tone1",
      markerColor: 0x4f8fd4,
    });
  });

  it("parses a story character's sprite, keyed by the dialogue speaker string", () => {
    const cast = unwrap(
      buildCast(
        minimalCast({ storyCharactersBySpeaker: { "A mother": { sprite: "ex_woman-tone3" } } }),
        contentWithCharacter,
      ),
    );

    expect(storyCharacterArtFor(cast, "A mother")).toEqual({
      speaker: "A mother",
      spriteKey: "ex_woman-tone3",
    });
    expect(storyCharacterArtFor(cast, "Nobody")).toBeUndefined();
  });

  it("converts the hex literal to the number Phaser wants", () => {
    const cast = unwrap(buildCast(minimalCast(), oneSectionContent));

    expect(guideArtFor(cast, "OT History")?.markerColor).toBe(5214164);
  });

  it("rejects a cast document that is not marked final", () => {
    const result = buildCast(minimalCast({ status: "provisional" }), oneSectionContent);

    expect(result.ok ? "" : result.reason).toContain("cast-document-invalid");
  });

  it("rejects a marker colour that is not a 0xRRGGBB literal", () => {
    const result = buildCast(
      minimalCast({
        guidesBySection: {
          "OT History": { sprite: "s", portrait: "p", markerColor: "#4f8fd4" },
        },
      }),
      oneSectionContent,
    );

    expect(result.ok ? "" : result.reason).toContain("markerColor");
  });

  it("rejects a section that appears in the curated refs but has no character", () => {
    // Without this, a guide with no art would surface mid-game as a missing
    // sprite rather than at load.
    const result = buildCast(minimalCast(), realContent);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("cast-missing-section");
    expect(result.ok ? "" : result.reason).toContain("Prophets");
  });

  it("allows a mapped section that no scene uses yet", () => {
    const cast = buildCast(
      minimalCast({
        guidesBySection: {
          "OT History": { sprite: "a", portrait: "a", markerColor: "0x000000" },
          "NT Letters": { sprite: "b", portrait: "b", markerColor: "0xffffff" },
        },
      }),
      oneSectionContent,
    );

    expect(cast).toMatchObject({ ok: true });
  });

  it("rejects a speaker in a playable scene with no story-character art mapped", () => {
    // Same rationale as cast-missing-section: an unmapped speaker in the one
    // playable scene would surface as a missing sprite mid-game instead of at load.
    const result = buildCast(minimalCast(), contentWithCharacter);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("cast-missing-character");
    expect(result.ok ? "" : result.reason).toContain("A mother");
  });
});

describe("spriteKeysToPreload", () => {
  it("lists the player, the Lamplighter, and every guide sheet exactly once", () => {
    const cast = unwrap(
      buildCast(
        minimalCast({
          guidesBySection: {
            "OT History": { sprite: "shared", portrait: "a", markerColor: "0x000000" },
            "NT Letters": { sprite: "shared", portrait: "b", markerColor: "0xffffff" },
          },
        }),
        oneSectionContent,
      ),
    );

    expect(spriteKeysToPreload(cast)).toEqual(["player_male-tone2", "lamplighter-tone2", "shared"]);
  });

  it("also lists every mapped story character/NPC sheet exactly once", () => {
    const cast = unwrap(
      buildCast(
        minimalCast({
          storyCharactersBySpeaker: { "A mother": { sprite: "ex_woman-tone3" } },
        }),
        contentWithCharacter,
      ),
    );

    expect(spriteKeysToPreload(cast)).toEqual([
      "player_male-tone2",
      "lamplighter-tone2",
      "chronicler-tone1",
      "ex_woman-tone3",
    ]);
  });
});

describe("the real cast file", () => {
  const cast = unwrap(buildCast(realCastDocument, realContent));

  it("covers all six of ADR-0002's biblical sections", () => {
    expect(Object.keys(cast.guides).sort()).toEqual([
      "Gospels/Acts",
      "NT Letters",
      "OT History",
      "OT Poetry/Wisdom",
      "Prophets",
      "Torah (Gen-Deut)",
    ]);
  });

  it("covers every section the twenty-four curated cross-references use", () => {
    const used = new Set(
      realContent.scenes.flatMap((scene) =>
        scene.crossReferences.map((crossRef) => crossRef.section),
      ),
    );

    for (const section of used) {
      expect(guideArtFor(cast, section), `no art for section: ${section}`).toBeDefined();
    }
  });

  it("gives each section a distinct character, so guides are told apart", () => {
    const sprites = Object.values(cast.guides).map((guide) => guide.spriteKey);

    expect(new Set(sprites).size).toBe(sprites.length);
  });

  it("maps every scene-1 speaker to its own story-character/NPC art", () => {
    // Scene 1 is the only playable scene, so it is the hard requirement
    // (PRD-12); buildCast itself enforces this (cast-missing-character).
    const sceneOne = realContent.scenes.find((scene) => scene.id === "scene-1");
    if (!sceneOne) throw new Error("expected to find scene-1");

    for (const character of sceneOne.characters) {
      expect(
        storyCharacterArtFor(cast, character.speaker),
        `no art for speaker: ${character.speaker}`,
      ).toBeDefined();
    }
  });

  it("preloads the player, the Lamplighter, every guide, and every mapped story character/NPC", () => {
    // 30 = player + Lamplighter + 6 guides + every *distinct* story-character/NPC
    // sprite (several speakers intentionally share a generic ex_*/youth_*
    // stand-in — see PRD-12 DECISIONS).
    expect(spriteKeysToPreload(cast)).toHaveLength(30);
  });

  it("names only sprite files that actually exist in public/assets", () => {
    // A typo here would otherwise surface as a 404 and a Phaser console error,
    // caught only by the e2e run. Fail here, in milliseconds, instead.
    for (const key of spriteKeysToPreload(cast)) {
      const file = path.resolve(__dirname, "../../public/assets/sprites", `${key}.png`);
      expect(existsSync(file), `missing sprite sheet: ${file}`).toBe(true);
    }
  });

  it("names only portrait files that actually exist in public/assets", () => {
    for (const guide of Object.values(cast.guides)) {
      const file = path.resolve(
        __dirname,
        "../../public/assets/portraits",
        `${guide.portraitKey}.png`,
      );
      expect(existsSync(file), `missing portrait: ${file}`).toBe(true);
    }
  });
});
