# Sources — Daniel Cross-References Dataset

## Dataset

**File:** `daniel-cross-references_josephilipraja-bible-cross-reference-json.json`

A single JSON file containing every verse of the book of Daniel (all 357 verses across 12 chapters) with its cross-references, extracted verbatim from the source repository described below. The filename embeds the source repository name (`josephilipraja/bible-cross-reference-json`) so the provenance of this specific dataset is identifiable at a glance.

## Origin

| | |
|---|---|
| **Source repository** | [josephilipraja/bible-cross-reference-json](https://github.com/josephilipraja/bible-cross-reference-json) (GitHub, `master` branch) |
| **Upstream origin** | Cloned by its author from https://bitbucket.org/josephilipraja/bible-cross-reference-json/ |
| **Cross-reference data credit** | [SoulLiberty / MetaV](https://github.com/souliberty/MetaV), per the source repository's README |
| **Bible text basis** | King James Version (KJV) versification |
| **License** | GNU General Public License v2.0 (GPL-2.0), per the source repository. README adds: "Free to use/modify, as long as it stays free." |
| **Source last updated** | 2014-01-20 (last push to the GitHub repository) |
| **Retrieved** | 2026-07-12 |
| **Source files used** | `22.json` (Daniel 1:1 – 9:22, global indices 21739–21999) and `23.json` (Daniel 9:23 – 12:13, global indices 22000–22095) |

The source repository splits the whole Bible (31,102 verses) into 32 JSON files of 1,000 verses each, keyed by a global verse index (Genesis 1:1 = `1` … Revelation 22:21 = `31102`). The book of Daniel spans two of those chunks; this dataset merges the Daniel portions of both into one file. No cross-reference data was added, removed, or altered.

## Data format

Keys are the global (whole-Bible) verse index numbers, preserved from the source. Each entry contains:

- `v` — the verse this entry describes, as `BOOK CHAPTER VERSE` (e.g., `"DAN 1 8"`)
- `r` — (optional) the cross-references for that verse: a map from the target verse's global index to its `BOOK CHAPTER VERSE` reference

```json
"21746": {
  "v": "DAN 1 8",
  "r": {
    "1252": "GEN 39 8",
    "14618": "PSA 119 115",
    "23306": "MAT 6 31",
    ...
  }
}
```

## Contents summary

- **357 verses** (Daniel 1:1 – 12:13), contiguous global indices 21739–22095, no gaps
- **5,174 total cross-references**
- 3 verses have no cross-references (no `r` key)

| Chapter | Verses | Cross-refs | Chapter | Verses | Cross-refs |
|---------|--------|------------|---------|--------|------------|
| DAN 1 | 21 | 207 | DAN 7 | 28 | 428 |
| DAN 2 | 49 | 644 | DAN 8 | 27 | 374 |
| DAN 3 | 30 | 401 | DAN 9 | 27 | 676 |
| DAN 4 | 37 | 572 | DAN 10 | 21 | 290 |
| DAN 5 | 31 | 388 | DAN 11 | 45 | 551 |
| DAN 6 | 28 | 419 | DAN 12 | 13 | 224 |

## Reproducing the extraction

1. Download `22.json` and `23.json` from the source repository (raw URLs: `https://raw.githubusercontent.com/josephilipraja/bible-cross-reference-json/master/22.json`, `.../23.json`).
2. Filter entries whose `v` value begins with `DAN `.
3. Merge, sort by numeric key, and write as a single JSON object (this file uses 2-space indentation; the source files are minified).
