// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addHighlight, removeHighlight } from "./highlights";

describe("highlights", () => {
  it("adds a USFM reference plus colour", () => {
    const result = addHighlight({}, "FIX.1.1", "yellow");
    expect(result.changed).toBe(true);
    expect(result.highlights).toEqual({ "FIX.1.1": "yellow" });
  });

  it("adding the same reference and colour twice is a no-op, not a duplicate", () => {
    const first = addHighlight({}, "FIX.1.1", "yellow");
    const second = addHighlight(first.highlights, "FIX.1.1", "yellow");
    expect(second.changed).toBe(false);
    expect(second.highlights).toEqual({ "FIX.1.1": "yellow" });
  });

  it("DECISION: the same reference carries one colour at a time; a new colour replaces the old one", () => {
    const first = addHighlight({}, "FIX.1.1", "yellow");
    const second = addHighlight(first.highlights, "FIX.1.1", "green");
    expect(second.changed).toBe(true);
    expect(second.highlights).toEqual({ "FIX.1.1": "green" });
    expect(Object.keys(second.highlights)).toHaveLength(1);
  });

  it("removes a highlight", () => {
    const added = addHighlight({}, "FIX.1.1", "yellow");
    const removed = removeHighlight(added.highlights, "FIX.1.1");
    expect(removed.changed).toBe(true);
    expect(removed.highlights).toEqual({});
  });

  it("removing an absent reference is a no-op", () => {
    const result = removeHighlight({}, "FIX.1.1");
    expect(result.changed).toBe(false);
    expect(result.highlights).toEqual({});
  });

  it("works with no YouVersion session present: highlights never reference a session", () => {
    const result = addHighlight({}, "FIX.1.1", "yellow");
    expect(result.highlights).toEqual({ "FIX.1.1": "yellow" });
    // No session argument exists on this function's signature at all.
    expect(addHighlight.length).toBe(3);
  });
});
