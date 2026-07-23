# Normalized Cross-References — YouVersion / USFM format

This directory holds cross-reference data from the raw dataset one level up
(`../daniel-cross-references_josephilipraja-bible-cross-reference-json.json`,
see `../sources.md` for its provenance) after normalizing every verse reference
to the **YouVersion Platform** reference standard.

## Files

| File | Contents |
|------|----------|
| `daniel-1.json` | Daniel 1 (21 verses, 207 cross-references) |

Future chapters follow the same pattern: `daniel-2.json`, … `daniel-12.json`.

## Target format

References use **USFM book codes, dot-separated**: `BOOK.CHAPTER.VERSE`
(e.g. `DAN.1.8`, `GEN.39.8`, `PSA.119.115`). This is the format the YouVersion
Platform uses for references.

The data file is a JSON object **grouped by verse** — each source verse (USFM
key) maps to a **list** of its cross-reference targets (USFM strings), in
canonical Bible order:

```json
{
  "DAN.1.1": ["2KI.23.36", "2KI.24.1", "2KI.24.13", "2CH.36.5", "JER.25.1"],
  "DAN.1.13": []
}
```

Deliberate choices (do not change without reason): USFM references only — **no
version ID**, **no human-readable label**. Every verse in the chapter is present;
a verse with no cross-references is `[]`, not omitted.

## Transformation (how to reproduce / extend to other chapters)

The raw dataset writes references as `BOOK CHAPTER VERSE` (space-separated) using
its own book codes. Normalizing a slice:

1. **Select the slice.** Parse each entry's `v` into book/chapter/verse and keep
   the ones you want (e.g. book `DAN`, chapter `1`). Parse — don't string-match a
   prefix, or `DAN 1` will also catch `DAN 10/11/12`.
2. **Convert each reference** `"BOOK C V"` → `"USFM.C.V"`: remap the book code via
   the table below, then join with dots. Apply this to the **source verse key and
   every target alike** (irrelevant for Daniel since `DAN` is unchanged, but it
   matters if this is reused for a book whose source code differs).
3. **Validate** every output book code against the canonical USFM set (the 66
   `BOOK_CANON` keys in YouVersion's own
   [`usfm_references/books.py`](https://github.com/youversion/usfm-references/blob/master/usfm_references/books.py)).
   An unknown code should raise, not pass silently.
4. **Preserve order.** Emit cross-references sorted by the source's global verse
   index (ascending) so they stay in canonical Bible order.
5. **Uniform shape.** Include every verse in the slice; ref-less verses become `[]`.

### Verify before trusting the output

Count round-trip: the total number of target references in the output must equal
the total in the source slice (Daniel 1 = **207**). This catches silent drops or
duplicates that "all codes are valid USFM" cannot see. For Daniel 1 also assert
21 verse keys and `DAN.1.13 == []`.

## Book-code remap (source → USFM)

37 of the 41 codes in Daniel 1 — and 54 of the 64 codes across all of Daniel —
are **already valid USFM** and pass through unchanged (`GEN`, `2KI`, `2CH`,
`PSA`, `1CO`, `2TI`, `ACT`, …). The codes that differ, verified against every
occurrence in the Daniel dataset:

| Source | USFM | Book |
|--------|------|------|
| `1JO`  | `1JN` | 1 John |
| `2JO`  | `2JN` | 2 John |
| `EZE`  | `EZK` | Ezekiel |
| `JAM`  | `JAS` | James |
| `JDE`  | `JUD` | Jude |
| `JOE`  | `JOL` | Joel |
| `JOH`  | `JHN` | John (Gospel) |
| `MAR`  | `MRK` | Mark |
| `NAH`  | `NAM` | Nahum |
| `SOS`  | `SNG` | Song of Songs |

**Unverified — confirm before relying on these.** Two books are never referenced
anywhere in Daniel's cross-references, so the source's code for them was never
observed:

- **3 John** — predicted `3JO` → `3JN` (following the `1JO`/`2JO` pattern).
- **Philemon** — USFM `PHM`; source code not observed (likely already `PHM`).

If you extend this to a book whose cross-references reach 3 John or Philemon,
confirm the source code and add it above.

## Sources for the standard

- YouVersion USFM reference validator: <https://github.com/youversion/usfm-references>
  (canonical book codes: `usfm_references/books.py`)
- YouVersion USFM Reference docs: <https://developers.youversion.com/usfm-reference>
