// The one credential AGENTS.md §6 permits in the browser bundle: the
// YouVersion `app_key`, a public OAuth client identifier (ADR-0002 "Scripture
// text"; PRD-10). It is not a secret — there is nothing here for
// glooCredentialBoundary.test.ts's discipline to police — but every
// YouVersion-backed seam (sign-in, Scripture, highlight sync) needs to read it
// identically and degrade identically when it is absent, which is the whole
// point of the no-credentials path PRD-10 requires: with nothing configured,
// every one of those seams falls back to its stub or bundled behaviour
// honestly, exactly as an outage or a signed-out player would see.
//
// Read via Vite's `import.meta.env`, so it must be prefixed `VITE_` to reach
// the client bundle at all (Vite's own rule, not this project's). See
// .env.example.
export function getConfiguredYouVersionAppKey(): string | undefined {
  const key = import.meta.env.VITE_YOUVERSION_APP_KEY;
  return typeof key === "string" && key.length > 0 ? key : undefined;
}
