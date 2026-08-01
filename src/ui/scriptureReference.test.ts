import { describe, expect, it } from "vitest";
import realRefsDocument from "../../content/daniel-1.refs.json";
import { displayReference } from "./scriptureReference";

describe("displayReference", () => {
  it("renders a single verse the way a person says it", () => {
    expect(displayReference("DAN.1.1")).toBe("Daniel 1:1");
    expect(displayReference("PRO.2.6")).toBe("Proverbs 2:6");
  });

  it("renders a verse range", () => {
    expect(displayReference("DAN.1.3-5")).toBe("Daniel 1:3-5");
    expect(displayReference("2KI.24.1-4")).toBe("2 Kings 24:1-4");
    expect(displayReference("1SA.2.1-10")).toBe("1 Samuel 2:1-10");
  });

  it("says Psalm, singular, for a single psalm", () => {
    expect(displayReference("PSA.106.40-42")).toBe("Psalm 106:40-42");
  });

  it("passes anything it does not recognise through unchanged, never a crash", () => {
    expect(displayReference("ZZZ.1.1")).toBe("ZZZ.1.1");
    expect(displayReference("not a reference")).toBe("not a reference");
    expect(displayReference("")).toBe("");
  });

  it("formats every reference the real content uses, so no machine code can leak on screen", () => {
    const refs = realRefsDocument as {
      scenes: Array<{ verses: string; cross_references: Array<{ ref: string; anchor: string }> }>;
    };
    const everyReference = refs.scenes.flatMap((scene) => [
      scene.verses,
      ...scene.cross_references.flatMap((crossRef) => [crossRef.ref, crossRef.anchor]),
    ]);

    for (const reference of everyReference) {
      const display = displayReference(reference);
      expect(display, reference).not.toBe(reference);
      expect(display, reference).toMatch(/^[1-2]? ?[A-Z][a-z]+ \d+:\d+(-\d+)?$/);
    }
  });
});
