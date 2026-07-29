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
// PRD-09 replaces this with a YouVersion fetch behind the same
// ScriptureProvider signature, so nothing here may change that shape.
import { err, ok, type Result } from "@/core/result";
import rawScriptureDocument from "../../content/daniel-1.scripture.json";
import type { PassageResult, ScriptureProvider } from "./providers";

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
