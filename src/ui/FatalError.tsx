/**
 * The defined outcome when authored content fails validation at load. The
 * requirement this satisfies is narrow but real: a schema-violating content
 * file must produce something a person can read, never a blank page.
 */
export function FatalError({ reason }: { reason: string }) {
  return (
    <div className="vv-overlay">
      <section className="vv-panel vv-fatal" role="alert" data-testid="fatal-error">
        <h1 className="vv-fatal__title">The game content could not be loaded</h1>
        <p>
          Verse &amp; Vale validates its authored content before starting, and this build's content
          did not pass. Nothing was saved or overwritten.
        </p>
        <p className="vv-fatal__reason" data-testid="fatal-error-reason">
          {reason}
        </p>
      </section>
    </div>
  );
}
