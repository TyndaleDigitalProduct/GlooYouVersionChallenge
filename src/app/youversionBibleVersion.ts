// Resolves the YouVersion Platform version id for the World English Bible.
// Both YouVersion-backed seams that need one — the real ScriptureProvider
// (scriptureProvider.ts) and the highlight sync provider
// (highlightSyncProvider.ts, highlights are recorded against a Bible
// version) — share this rather than each hand-rolling the lookup, and both
// want the *same* version: WEB is the default translation on both the live
// and bundled paths (ADR-0002 "Scripture text"), which is what keeps a
// degrade-to-bundled invisible.
//
// There is no well-known static WEB version id shipped by
// @youversion/platform-core (it does export a `DEFAULT_LICENSE_FREE_BIBLE_VERSION`,
// but that names the Berean Standard Bible, not WEB), so this resolves it at
// runtime from `GET /v1/bibles` and caches the result — every caller here
// passes a `BibleClient` already constructed from the one configured
// `app_key`.
import type { BibleClient } from "@youversion/platform-core";

/** The narrow slice of BibleClient this lookup needs, so tests can inject a fake. */
export type VersionLookupClient = Pick<BibleClient, "getVersions">;

/**
 * How the World English Bible is actually published, most specific first.
 *
 * `GET /v1/bibles?language_ranges[]=eng` returns fourteen versions and none of
 * them is abbreviated `WEB`: the WEB is `engWEBUS` (id 206), whose
 * `localized_abbreviation` is `WEBUS`. Matching the bare `WEB` this module
 * originally looked for therefore never matched anything, and both seams that
 * depend on this lookup degraded permanently and silently — bundled text in
 * the ScriptureProvider, `bible-version-unresolved` on every highlight sync.
 * `WEB` is kept last so the lookup still works if YouVersion ever publishes it
 * under the plain abbreviation. `WMB`/`WMBBE` (World *Messianic* Bible) are
 * deliberately not here: they are a different translation.
 */
const WEB_ABBREVIATIONS = ["engwebus", "webus", "web"] as const;

/**
 * Returns the numeric version id for the WEB in English, or null if the lookup
 * fails or the WEB is not present in the response. Never throws — a failed
 * lookup is one more reason a YouVersion-backed seam degrades to its bundled
 * or stub behaviour, never an exception a caller must catch.
 */
export async function resolveWebVersionId(client: VersionLookupClient): Promise<number | null> {
  try {
    const versions = await client.getVersions("eng");
    // Preference order comes from WEB_ABBREVIATIONS, not from the order the
    // API happens to return versions in.
    for (const wanted of WEB_ABBREVIATIONS) {
      const match = versions.data.find(
        (version) =>
          version.abbreviation?.toLowerCase() === wanted ||
          version.localized_abbreviation?.toLowerCase() === wanted,
      );
      if (match) return match.id;
    }
    return null;
  } catch {
    return null;
  }
}
