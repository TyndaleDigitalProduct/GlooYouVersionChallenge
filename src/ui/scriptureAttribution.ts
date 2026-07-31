// The Scripture attribution the intro displays, covering every translation
// the game can put in front of a player.
//
// Why this exists at all: until PRD-10 both the live and bundled paths served
// the public-domain WEB, which needs no notice. The live path now reads the
// NIV, whose publisher requires its copyright notice be displayed wherever the
// text appears. The bundled WEB is still shipped and still shown whenever the
// live fetch degrades (scriptureProvider.ts), so a player in one session can
// see one translation and in the next see the other. Attributing only the live
// one would therefore be wrong roughly whenever the network is.
//
// These are static strings rather than a runtime read of the API's `copyright`
// field on purpose: the notice has to render on the intro, which is reachable
// with no network, no `app_key`, and no session, and a legal notice that
// silently disappears in exactly the degraded conditions the fallback exists
// for is worse than useless. The NIV wording below is reproduced from
// `GET /v1/bibles/111` (`copyright`), retrieved 2026-07-31; the WEB edition and
// source are recorded in THIRD_PARTY.md under "Scripture text".

export interface ScriptureAttribution {
  /** The translation name, as YouVersion publishes it. */
  version: string;
  /** The notice, verbatim where a rights holder specifies the wording. */
  notice: string;
}

export const SCRIPTURE_ATTRIBUTIONS: readonly ScriptureAttribution[] = [
  {
    version: "New International Version",
    // Biblica's required wording. Reproduce exactly; do not reflow or tidy.
    notice:
      "The Holy Bible, New International Version® NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by Permission of Biblica, Inc.® All rights reserved worldwide.",
  },
  {
    version: "World English Bible",
    notice: "Used for offline passages. The World English Bible is in the public domain.",
  },
];
