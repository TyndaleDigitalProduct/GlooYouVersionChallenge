// Resolves the YouVersion Platform version the live seams read and write.
// Both YouVersion-backed seams that need one — the real ScriptureProvider
// (scriptureProvider.ts) and the highlight sync provider
// (highlightSyncProvider.ts, highlights are recorded against a Bible
// version) — share this rather than each hand-rolling the lookup, and both
// want the *same* version, so a highlight always lands on the translation the
// player was actually reading when they made it.
//
// The live translation is the **NIV** (operator's call). Note what that
// changes about ADR-0002 "Scripture text": that ADR chose WEB on both the live
// and bundled paths precisely so degrading to offline caused no visible
// translation switch. The bundled text is still WEB and cannot be anything
// else — no modern copyrighted translation can legally be vendored into a
// GPL-3.0 repo — so a degrade to bundled now *is* a visible translation
// switch. Live NIV is licensed to the configured `app_key` by YouVersion,
// which is what makes the live half of this legal; nothing here redistributes
// it.
//
// There is no static version id for any of this shipped by
// @youversion/platform-core (it does export a `DEFAULT_LICENSE_FREE_BIBLE_VERSION`,
// but that names the Berean Standard Bible), so this resolves at runtime from
// `GET /v1/bibles` and each caller caches the result — every caller here
// passes a `BibleClient` already constructed from the one configured
// `app_key`.
import type { BibleClient } from "@youversion/platform-core";

/** The narrow slice of BibleClient this lookup needs, so tests can inject a fake. */
export type VersionLookupClient = Pick<BibleClient, "getVersions">;

/**
 * How the NIV is actually published, most specific first.
 *
 * `GET /v1/bibles?language_ranges[]=eng` returns the NIV as `NIV11` (id 111),
 * whose `localized_abbreviation` is `NIV`. Matching a bare guess is what broke
 * this module once already: it looked for `WEB`, which the API does not
 * publish at all (the World English Bible is `engWEBUS`), and so resolved
 * nothing for the life of the feature. Both fields are matched here because
 * the API populates them differently per version, and the near neighbour
 * `NIVUK11`/`NIVUK` (the Anglicised edition, id 113) is deliberately absent:
 * it is a different edition, not a fallback.
 */
const PREFERRED_ABBREVIATIONS = ["niv11", "niv"] as const;

/** A resolved version: the id the API is called with, and its display name. */
export interface ResolvedBibleVersion {
  id: number;
  /** Human-facing translation name, e.g. "New International Version". */
  title: string;
}

/**
 * Returns the preferred English version, or null if the lookup fails or that
 * version is not present in the response. Never throws — a failed lookup is
 * one more reason a YouVersion-backed seam degrades to its bundled or stub
 * behaviour, never an exception a caller must catch.
 *
 * The title travels with the id so no caller has to hard-code a translation
 * name next to a lookup that could resolve a different one; the live
 * ScriptureProvider labelled every passage "World English Bible" from a
 * constant, which would have quietly mislabelled every NIV verse.
 */
export async function resolvePreferredVersion(
  client: VersionLookupClient,
): Promise<ResolvedBibleVersion | null> {
  try {
    const versions = await client.getVersions("eng");
    // Preference order comes from PREFERRED_ABBREVIATIONS, not from the order
    // the API happens to return versions in.
    for (const wanted of PREFERRED_ABBREVIATIONS) {
      const match = versions.data.find(
        (version) =>
          version.abbreviation?.toLowerCase() === wanted ||
          version.localized_abbreviation?.toLowerCase() === wanted,
      );
      if (match) return { id: match.id, title: match.localized_title || match.abbreviation };
    }
    return null;
  } catch {
    return null;
  }
}
