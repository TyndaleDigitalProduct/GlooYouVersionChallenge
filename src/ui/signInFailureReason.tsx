// Makes a failed YouVersion sign-in diagnosable without weakening the copy a
// player sees.
//
// The two connect() call sites (SetupScreen.tsx, HudMenu.tsx) deliberately show
// one generic sentence on failure: a sign-in that did not work is never the
// player's problem to debug, and PRD-10 requires it never block play. But that
// left the `Result.reason` completely swallowed, so "it just says it cannot
// connect" was unactionable — a cancelled popup, an unserved /api route, and a
// rejected token exchange all looked identical.
//
// So: log it always, and in a dev build also render it. A console line alone
// proved too easy to miss (DevTools filters warnings out by default in some
// setups, and a stale bundle looks the same as no error at all), and the one
// person who needs this string is whoever is running the dev server.
// `import.meta.env.DEV` is false in the production bundle, so a player never
// sees a reason code.
/** Logs the reason and returns it for display, or null in a production build. */
export function reportSignInFailure(reason: string): string | null {
  console.warn(`YouVersion sign-in failed: ${reason}`);
  return import.meta.env.DEV ? reason : null;
}

/**
 * The dev-only reason line rendered under the generic failure copy. Returns
 * nothing at all when there is no reason to show (production, or no failure).
 * The `DEV` check is deliberately repeated here rather than left to
 * `reportSignInFailure`: this component is the thing that would put a reason
 * code in front of a player, so it enforces that itself instead of trusting
 * every present and future caller to have passed null.
 */
export function SignInFailureReason({ reason }: { reason: string | null }) {
  if (!import.meta.env.DEV || !reason) return null;
  return (
    <p className="vv-placeholder-tag" data-testid="signin-failure-reason">
      Dev only: {reason}
    </p>
  );
}
