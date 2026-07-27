// Structural subset of the DOM Storage interface (window.localStorage /
// sessionStorage both satisfy this shape). src/core never references
// `window` or `localStorage` directly; callers inject an implementation, and
// tests inject an in-memory double (see fixtures.ts).
export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
