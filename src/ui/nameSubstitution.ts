// PRD-11: every `{name}` placeholder in dialogue and intro copy is replaced
// with the player's saved name, unconditionally. Name entry is required
// (storyboard-v2.md §2, item 14) precisely so no fallback form of address
// needs to exist here: by the time any copy carrying `{name}` can render,
// setup has already enforced a non-blank name.
const NAME_PLACEHOLDER = /\{name\}/g;

export function substituteName(text: string, name: string): string {
  return text.replace(NAME_PLACEHOLDER, name);
}
