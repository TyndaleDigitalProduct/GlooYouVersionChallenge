import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import realCastDocument from "../../content/characters.json";
import realDialogueDocument from "../../content/daniel-1.dialogue.json";
import realRefsDocument from "../../content/daniel-1.refs.json";
import { buildCast, guideArtFor, spriteKeysToPreload } from "./cast";
import { buildGameContent, type GameContent } from "./loadContent";

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.value;
}

const realContent: GameContent = unwrap(buildGameContent(realRefsDocument, realDialogueDocument));

function minimalCast(overrides: Record<string, unknown> = {}) {
  return {
    status: "provisional",
    note: "Stand-in art.",
    player: { sprite: "daniel_judean-tone2" },
    guidesBySection: {
      "OT History": {
        sprite: "ex_scribe-tone1",
        portrait: "ex_scribe-tone1",
        markerColor: "0x4f8fd4",
      },
    },
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
      scenes: [{ id: 1, playable: true, beats: [{ speaker: "N", text: "One." }] }],
    },
  ),
);

describe("buildCast", () => {
  it("parses the player sprite and each section's art", () => {
    const cast = unwrap(buildCast(minimalCast(), oneSectionContent));

    expect(cast.playerSpriteKey).toBe("daniel_judean-tone2");
    expect(guideArtFor(cast, "OT History")).toEqual({
      section: "OT History",
      spriteKey: "ex_scribe-tone1",
      portraitKey: "ex_scribe-tone1",
      markerColor: 0x4f8fd4,
    });
  });

  it("converts the hex literal to the number Phaser wants", () => {
    const cast = unwrap(buildCast(minimalCast(), oneSectionContent));

    expect(guideArtFor(cast, "OT History")?.markerColor).toBe(5214164);
  });

  it("rejects a cast document claiming to be final art direction", () => {
    const result = buildCast(minimalCast({ status: "final" }), oneSectionContent);

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
});

describe("spriteKeysToPreload", () => {
  it("lists the player and every guide sheet exactly once", () => {
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

    expect(spriteKeysToPreload(cast)).toEqual(["daniel_judean-tone2", "shared"]);
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

  it("preloads the player plus six guides", () => {
    expect(spriteKeysToPreload(cast)).toHaveLength(7);
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
