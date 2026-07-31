import { describe, expect, it } from "vitest";
import { SCRIPTURE_ATTRIBUTIONS } from "./scriptureAttribution";

describe("SCRIPTURE_ATTRIBUTIONS", () => {
  // The point of this list is that it covers *every* translation a player can
  // be shown, not just the live one. Both paths serve real Scripture, so both
  // are attributed whether or not the live fetch is working at the time.
  it("attributes both translations the game can render", () => {
    expect(SCRIPTURE_ATTRIBUTIONS.map((entry) => entry.version)).toEqual([
      "New International Version",
      "World English Bible",
    ]);
  });

  // Biblica's notice is a rights-holder requirement, not copy we may edit. It
  // is reproduced exactly as YouVersion publishes it on the version record
  // (GET /v1/bibles/111, `copyright`), so this pins the wording against a
  // well-meaning tidy-up.
  it("reproduces the NIV notice verbatim, including every required mark", () => {
    const niv = SCRIPTURE_ATTRIBUTIONS[0].notice;
    expect(niv).toContain("The Holy Bible, New International Version® NIV®");
    expect(niv).toContain("Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.®");
    expect(niv).toContain("Used by Permission of Biblica, Inc.® All rights reserved worldwide.");
  });

  it("names the WEB as public domain, the licence the bundled text ships under", () => {
    expect(SCRIPTURE_ATTRIBUTIONS[1].notice).toContain("public domain");
  });

  it("carries a non-empty notice for every entry", () => {
    for (const entry of SCRIPTURE_ATTRIBUTIONS) {
      expect(entry.version.length).toBeGreaterThan(0);
      expect(entry.notice.length).toBeGreaterThan(0);
    }
  });
});
