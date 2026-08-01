# PRD-17: human-readable Scripture references, and no beat counters

## Goal

Two operator copy requests (2026-07-31), fixed as a batch:

1. **Scripture references rendered as machine codes.** Every on-screen
   reference showed the stored USFM form ("DAN.1.1", "2KI.24.1-4") instead
   of the way a person says it ("Daniel 1:1", "2 Kings 24:1-4").
2. **"Beat N of M" progress counters.** The Lamplighter's opening and the
   character/NPC dialogue panels counted their beats on screen ("Beat 1 of
   1"); the button alone should carry the pacing.

## The reference formatter

`src/ui/displayReference` ( `scriptureReference.ts` ) converts at the last
moment before a reference reaches the screen. **USFM stays the one stored
reference format everywhere** — content files, save data, store keys,
lookups — so AGENTS.md §6's no-second-format rule is untouched: this is
display formatting, the way a date is stored one way and shown another.

- The book map covers exactly the sixteen books the game's content uses.
- "Psalm", singular, for a reference into Psalms.
- Anything unrecognised passes through unchanged: a machine code on screen
  is a copy bug, but invented words under a Bible publisher's name would be
  worse.
- A suite test formats every reference in the real refs document, so a new
  cross-reference from an unmapped book fails the build rather than leaking
  a code on screen.

Applied at every render site: the HUD scene tag, home screen, chapter map,
chapter-complete screen, the Lamplighter's opening header and scene passage
card, the Lamplighter's "Next:" line, the proximity prompt, the guide
intro/closing stage, and the encounter panel (header, aria-label, and both
passage cards).

## Addition (operator, 2026-07-31)

The proximity prompt names the persona ("Speak with the Chronicler about
2 Kings 24:1-4") instead of the generic section title ("the OT History
guide"). Persona names carry their own article (or lack of one: "Lady
Wisdom"), so the copy composes for all six; the section title remains only
as the defensive fallback.

## Acceptance criteria

- [x] No USFM code renders anywhere in the UI; every reference the content
      uses formats, enforced by a suite test over the real refs document.
- [x] "Beat N of M" is gone from the Lamplighter opening and the
      character/NPC panel, asserted by their component tests.
- [x] All five quality gates pass.
