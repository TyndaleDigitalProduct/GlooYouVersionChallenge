import { useRuntime, useViewState } from "./RuntimeContext";

/**
 * Recoverable problems, shown rather than swallowed. A corrupt save or a
 * failed write lands here: the game keeps running, and the player is told.
 */
export function NoticeStack() {
  const runtime = useRuntime();
  const notices = useViewState((state) => state.notices);

  if (notices.length === 0) return null;

  return (
    <div className="vv-notices" role="status" aria-live="polite">
      {notices.map((notice) => (
        <div key={notice.id} className={`vv-notice vv-notice--${notice.tone}`} data-testid="notice">
          <p className="vv-notice__message">{notice.message}</p>
          <button
            type="button"
            className="vv-button vv-button--quiet"
            data-testid="notice-dismiss"
            onClick={() => runtime.view.getState().dismissNotice(notice.id)}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
