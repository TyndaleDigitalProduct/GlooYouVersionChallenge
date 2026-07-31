// The real ScriptureProvider, replacing createStubScriptureProvider (PRD-08
// phase 2). Backed by a bundled public-domain WEB fallback committed at
// content/daniel-1.scripture.json, covering the 9 scene anchors and 24
// cross-referenced passages the curated content in
// content/daniel-1.refs.json names. Edition and source are recorded in
// THIRD_PARTY.md under "Scripture text".
//
// The bundle is stored at single-verse granularity (one WEB verse per USFM
// key) rather than pre-joined ranges, so a query for a range resolves by
// looking up each verse in the range and concatenating, which is what "USFM
// ranges resolve correctly" in the PRD actually means: not a map lookup on
// the exact range string, but real chapter/verse arithmetic. This also means
// any sub-range of a bundled passage resolves too, for free.
//
// PRD-10 adds a YouVersion fetch behind the same ScriptureProvider signature
// (createYouVersionScriptureProvider, createDefaultScriptureProvider,
// below); createScriptureProvider itself — the bundled WEB implementation —
// is unchanged, and stays the fallback the live path degrades to.
import { ApiClient, BibleClient } from "@youversion/platform-core";
import { USFMRef, USFMRefRange } from "@youversion/usfm-references";
import { err, ok, type Result } from "@/core/result";
import rawScriptureDocument from "../../content/daniel-1.scripture.json";
import type { PassageResult, ScriptureProvider } from "./providers";
import {
  type ResolvedBibleVersion,
  resolvePreferredVersion,
  type VersionLookupClient,
} from "./youversionBibleVersion";
import { getConfiguredYouVersionAppKey } from "./youversionConfig";

export interface ScriptureBundleDocument {
  translation: string;
  licence: string;
  source: string;
  retrieved: string;
  /** Keyed "BOOK.CHAPTER.VERSE", e.g. "2KI.24.1". One WEB verse of text. */
  verses: Record<string, string>;
}

export const SCRIPTURE_UNAVAILABLE_REASON =
  "This passage is not included in the bundled Scripture text for this build.";

export interface UsfmRange {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

// Matches "BOOK.CHAPTER.VERSE" or "BOOK.CHAPTER.VERSE-VERSE". Deliberately
// does not accept a hyphenated chapter component ("BOOK.C1.V1-C2.V2"):
// content/daniel-1.refs.json contains no cross-chapter ranges (asserted in
// scriptureProvider.test.ts against the real content file), so that case is
// unimplemented rather than silently wrong.
const USFM_RANGE_PATTERN = /^([1-3]?[A-Z]+)\.(\d+)\.(\d+)(?:-(\d+))?$/;

/** Parses a single-chapter USFM reference. Returns null, never throws, for anything else. */
export function parseUsfmReference(reference: string): UsfmRange | null {
  const match = USFM_RANGE_PATTERN.exec(reference);
  if (!match) return null;

  const [, book, chapterRaw, startRaw, endRaw] = match;
  const chapter = Number(chapterRaw);
  const verseStart = Number(startRaw);
  const verseEnd = endRaw === undefined ? verseStart : Number(endRaw);
  if (verseEnd < verseStart) return null;

  return { book, chapter, verseStart, verseEnd };
}

function verseKey(book: string, chapter: number, verse: number): string {
  return `${book}.${chapter}.${verse}`;
}

/** Concatenates every verse in range from the bundle, or fails if any is missing. */
function resolvePassageText(document: ScriptureBundleDocument, range: UsfmRange): Result<string> {
  const texts: string[] = [];
  for (let verse = range.verseStart; verse <= range.verseEnd; verse += 1) {
    const text = document.verses[verseKey(range.book, range.chapter, verse)];
    if (text === undefined)
      return err(`verse-not-bundled (${verseKey(range.book, range.chapter, verse)})`);
    texts.push(text);
  }
  return ok(texts.join(" "));
}

export function createScriptureProvider(
  document: ScriptureBundleDocument = rawScriptureDocument as ScriptureBundleDocument,
): ScriptureProvider {
  return {
    isStub: false,
    getPassage(reference: string): Promise<PassageResult> {
      const range = parseUsfmReference(reference);
      if (!range) {
        return Promise.resolve({
          status: "unavailable",
          reference,
          reason: SCRIPTURE_UNAVAILABLE_REASON,
        });
      }

      const resolved = resolvePassageText(document, range);
      if (!resolved.ok) {
        return Promise.resolve({
          status: "unavailable",
          reference,
          reason: SCRIPTURE_UNAVAILABLE_REASON,
        });
      }

      return Promise.resolve({
        status: "available",
        reference,
        translation: document.translation,
        text: resolved.value,
      });
    },
  };
}

// --- YouVersion-backed ScriptureProvider (PRD-10) --------------------------
// format=text, X-YVP-App-Key, no hand-rolled HTTP: BibleClient is the
// official typed client (ADR-0002 "Scripture text"), reading `app_key` off
// the ApiClient it is constructed with. `@youversion/usfm-references`
// validates the reference before ever calling the API, the "parsing the USFM
// references" use ADR-0002 names for that package.
export const YOUVERSION_SCRIPTURE_UNAVAILABLE_REASON =
  "The live YouVersion passage is unavailable right now.";

/** The narrow slice of BibleClient this seam calls, so tests can inject a fake. */
export type BiblePassageLookupClient = Pick<BibleClient, "getPassage">;

function isValidUsfmReference(reference: string): boolean {
  return USFMRef.parse(reference) !== null || USFMRefRange.parse(reference) !== null;
}

export interface CreateYouVersionScriptureProviderOptions {
  appKey: string;
  bibleClient?: BiblePassageLookupClient & VersionLookupClient;
  /** Skips version resolution entirely; mainly for tests. */
  version?: ResolvedBibleVersion;
}

/**
 * The real, BibleClient-backed ScriptureProvider. Same async/`unavailable`
 * shape as the bundled one above, so nothing at the call site changes
 * (providers.ts's ScriptureProvider interface). Used directly by nothing
 * outside this module and its tests — `createDefaultScriptureProvider` below
 * is what runtime.ts actually wires, composing this with the bundled
 * fallback.
 */
export function createYouVersionScriptureProvider(
  options: CreateYouVersionScriptureProviderOptions,
): ScriptureProvider {
  const { appKey, bibleClient = new BibleClient(new ApiClient({ appKey })) } = options;

  let cachedVersion: ResolvedBibleVersion | null = options.version ?? null;
  let resolving: Promise<ResolvedBibleVersion | null> | null = null;

  async function resolvedVersion(): Promise<ResolvedBibleVersion | null> {
    if (cachedVersion != null) return cachedVersion;
    if (!resolving) {
      resolving = resolvePreferredVersion(bibleClient).then((version) => {
        cachedVersion = version;
        return version;
      });
    }
    return resolving;
  }

  return {
    isStub: false,
    async getPassage(reference: string): Promise<PassageResult> {
      const unavailable: PassageResult = {
        status: "unavailable",
        reference,
        reason: YOUVERSION_SCRIPTURE_UNAVAILABLE_REASON,
      };

      if (!isValidUsfmReference(reference)) return unavailable;

      const version = await resolvedVersion();
      if (version == null) return unavailable;

      try {
        const passage = await bibleClient.getPassage(version.id, reference, "text");
        if (!passage?.content) return unavailable;
        return {
          status: "available",
          reference,
          // The name the API published for the version actually fetched, never
          // a constant: this label was hard-coded to "World English Bible" and
          // would have mislabelled every live NIV verse.
          translation: version.title,
          text: passage.content,
        };
      } catch {
        return unavailable;
      }
    },
  };
}

export interface CreateDefaultScriptureProviderOptions {
  appKey?: string;
  bundled?: ScriptureProvider;
  youversion?: ScriptureProvider;
}

/**
 * What runtime.ts actually wires as `scripture`. With no `app_key`
 * configured (the no-credentials path PRD-10 requires), this is exactly
 * `createScriptureProvider()` — the bundled WEB implementation, unwrapped —
 * so the no-credentials build has zero YouVersion-shaped indirection in its
 * hot path. With one configured, every passage tries the live fetch first
 * and falls back to the same bundled WEB text on any `unavailable` outcome.
 *
 * The live path reads the NIV (see youversionBibleVersion.ts) while the
 * bundled path is and must remain public-domain WEB, so a fallback here is a
 * *visible* translation switch. ADR-0002 "Scripture text" chose WEB on both
 * paths specifically to avoid that; this is the one place the consequence
 * lands, and it is the operator's call to record.
 */
export function createDefaultScriptureProvider(
  options: CreateDefaultScriptureProviderOptions = {},
): ScriptureProvider {
  const appKey = options.appKey ?? getConfiguredYouVersionAppKey();
  const bundled = options.bundled ?? createScriptureProvider();
  if (!appKey) return bundled;

  const youversion = options.youversion ?? createYouVersionScriptureProvider({ appKey });

  return {
    isStub: false,
    async getPassage(reference: string): Promise<PassageResult> {
      const live = await youversion.getPassage(reference);
      if (live.status === "available") return live;
      return bundled.getPassage(reference);
    },
  };
}
