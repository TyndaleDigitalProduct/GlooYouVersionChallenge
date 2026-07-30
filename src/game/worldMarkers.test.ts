import { describe, expect, it } from "vitest";
import {
  characterReference,
  lamplighterReference,
  parseCharacterReference,
  parseLamplighterReference,
} from "./worldMarkers";

describe("lamplighterReference / parseLamplighterReference", () => {
  it("round-trips a scene id through a marker reference", () => {
    expect(parseLamplighterReference(lamplighterReference("scene-1"))).toBe("scene-1");
  });

  it("does not mistake a character reference, or a bare USFM reference, for a Lamplighter one", () => {
    expect(parseLamplighterReference(characterReference("scene-1", "daniel"))).toBeNull();
    expect(parseLamplighterReference("2KI.24.1-4")).toBeNull();
  });
});

describe("characterReference / parseCharacterReference", () => {
  it("round-trips a (sceneId, characterId) pair through a marker reference", () => {
    const reference = characterReference("scene-1", "daniel");
    expect(parseCharacterReference(reference)).toEqual({
      sceneId: "scene-1",
      characterId: "daniel",
    });
  });

  it("does not mistake a Lamplighter reference, or a bare USFM reference, for a character one", () => {
    expect(parseCharacterReference(lamplighterReference("scene-1"))).toBeNull();
    expect(parseCharacterReference("2KI.24.1-4")).toBeNull();
  });

  it("rejects a malformed character reference missing its characterId segment", () => {
    expect(parseCharacterReference("character:scene-1")).toBeNull();
    expect(parseCharacterReference("character:scene-1:")).toBeNull();
  });
});
