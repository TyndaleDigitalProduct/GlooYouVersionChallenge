// Human-readable Scripture references for the UI (PRD-17).
//
// USFM codes ("DAN.1.1") remain the one stored reference format everywhere —
// content files, save data, the store, and every lookup key (AGENTS.md §6's
// no-second-format rule is about data, and this introduces none). This is
// display formatting only, applied at the last moment before a reference
// reaches the screen, the same way a date is stored one way and shown
// another.
//
// The map covers exactly the books the game's content uses (Daniel 1 plus
// the twenty-four cross-references). An unmapped book or an unrecognised
// shape passes through unchanged: a machine code on screen is a copy bug,
// but wrong or invented words under a Bible publisher's name would be worse.
const BOOK_NAMES: Record<string, string> = {
  GEN: "Genesis",
  DEU: "Deuteronomy",
  "1SA": "1 Samuel",
  "2KI": "2 Kings",
  EST: "Esther",
  // Singular on purpose: a reference is always to one psalm ("Psalm 106"),
  // while the book as a whole is "Psalms".
  PSA: "Psalm",
  PRO: "Proverbs",
  ISA: "Isaiah",
  JER: "Jeremiah",
  EZK: "Ezekiel",
  DAN: "Daniel",
  MAT: "Matthew",
  LUK: "Luke",
  ACT: "Acts",
  HEB: "Hebrews",
  JAS: "James",
};

/** "DAN.1.3-5" -> "Daniel 1:3-5". Unrecognised input passes through unchanged. */
export function displayReference(usfm: string): string {
  const match = /^([0-9A-Z]+)\.(\d+)\.(\d+(?:-\d+)?)$/.exec(usfm.trim());
  if (!match) return usfm;
  const book = BOOK_NAMES[match[1]];
  if (!book) return usfm;
  return `${book} ${match[2]}:${match[3]}`;
}
