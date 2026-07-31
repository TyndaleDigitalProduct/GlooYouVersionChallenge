import { describe, expect, it } from "vitest";
import realDialogueDocument from "../../content/daniel-1.dialogue.json";
import realRefsDocument from "../../content/daniel-1.refs.json";
import realPersonasDocument from "../../content/personas.json";
import { buildGameContent } from "./loadContent";
import { buildPersonas, personaForSection } from "./personas";

function unwrap<T>(result: { ok: true; value: T } | { ok: false; reason: string }): T {
  if (!result.ok) throw new Error(`expected ok, got: ${result.reason}`);
  return result.value;
}

const realContent = unwrap(buildGameContent(realRefsDocument, realDialogueDocument));

describe("buildPersonas", () => {
  it("resolves every cross-referenced section to a persona with intro and closing", () => {
    // The validation this loader exists for (PRD-16, following buildCast): a
    // curated section with no persona, or a persona with no authored intro or
    // closing, must fail the boot rather than render an empty dialogue box.
    const personas = unwrap(buildPersonas(realPersonasDocument, realContent));

    const sections = new Set(
      realContent.scenes.flatMap((scene) => scene.crossReferences.map((ref) => ref.section)),
    );
    for (const section of sections) {
      const persona = personaForSection(personas, section);
      expect(persona, section).toBeDefined();
      expect(persona?.name.length, section).toBeGreaterThan(0);
      expect(persona?.intro.length, section).toBeGreaterThan(0);
      expect(persona?.closing.length, section).toBeGreaterThan(0);
    }
  });

  it("carries the authored copy through unchanged", () => {
    const personas = unwrap(buildPersonas(realPersonasDocument, realContent));
    const chronicler = personaForSection(personas, "OT History");

    expect(chronicler?.name).toBe("the Chronicler");
    expect(chronicler?.intro).toContain("Nothing ever happens without a backstory");
    expect(chronicler?.closing).toContain("It is written, and it is remembered");
  });

  it("rejects a document missing a section the content cross-references", () => {
    const document = {
      note: "Test fixture.",
      personas: [
        {
          name: "the Chronicler",
          section: "OT History",
          voice_notes: "Bookish.",
          intro: "An intro.",
          closing: "A closing.",
        },
      ],
    };
    const result = buildPersonas(document, realContent);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("persona-missing");
  });

  it("rejects a guide persona whose intro or closing is empty", () => {
    const document = JSON.parse(JSON.stringify(realPersonasDocument)) as {
      personas: Array<{ section: string; intro: string }>;
    };
    const watchman = document.personas.find((persona) => persona.section === "Prophets");
    if (!watchman) throw new Error("expected the Watchman in the real document");
    watchman.intro = "";

    const result = buildPersonas(document, realContent);

    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("Prophets");
  });

  it("does not require an intro of the Lamplighter, whose copy lives in the scene files", () => {
    // The real document carries the Lamplighter with empty intro/closing by
    // design (personaSchema's comment); only sections the refs use are held
    // to the non-empty rule.
    expect(buildPersonas(realPersonasDocument, realContent).ok).toBe(true);
  });
});
