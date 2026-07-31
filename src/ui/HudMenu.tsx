import { useState } from "react";
import { useGameState, useRuntime, useViewState } from "./RuntimeContext";
import { reportSignInFailure, SignInFailureReason } from "./signInFailureReason";
import { YouVersionProfile, type YouVersionProfileFields } from "./YouVersionProfile";

type SignInStatus = "idle" | "pending" | "failed";

/**
 * The in-game HUD menu (PRD-11, storyboard-v2.md §3 and §2). Two jobs, both
 * of which storyboard-v2.md puts "behind the HUD menu" rather than anywhere
 * mid-scene: reopening the intro, so a player who skipped it is not left
 * with no route to the rules; and offering the YouVersion connection a
 * player may have declined at setup, since "connect later" (§2) has to lead
 * somewhere. Editing the player's name is deliberately not here: PRD-11
 * treats the name as write-once (see the PRD handoff), so there is nothing
 * to edit.
 */
export function HudMenu() {
  const runtime = useRuntime();
  const menuOpen = useViewState((state) => state.menuOpen);

  return (
    <>
      <button
        type="button"
        className="vv-button vv-button--quiet"
        data-testid="hud-menu-toggle"
        onClick={() =>
          menuOpen ? runtime.view.getState().closeMenu() : runtime.view.getState().openMenu()
        }
      >
        Menu
      </button>
      {menuOpen ? <HudMenuPanel /> : null}
    </>
  );
}

function HudMenuPanel() {
  const runtime = useRuntime();
  const session = useGameState((state) => state.session);
  const [signInStatus, setSignInStatus] = useState<SignInStatus>("idle");
  const [connectedProfile, setConnectedProfile] = useState<YouVersionProfileFields | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const connect = async () => {
    setSignInStatus("pending");
    const result = await runtime.session.signIn();
    if (result.ok) {
      runtime.store.getState().setSession(result.value.yvpId);
      setConnectedProfile({
        displayName: result.value.displayName,
        avatarUrl: result.value.avatarUrl,
      });
      setSignInStatus("idle");
    } else {
      setFailureReason(reportSignInFailure(result.reason));
      setSignInStatus("failed");
    }
  };

  return (
    <div className="vv-scrim">
      <section
        className="vv-panel vv-hud-menu"
        role="dialog"
        aria-label="Menu"
        data-testid="hud-menu"
      >
        {/* PRD-13 phase 5: the chapter map's in-play home. It is a progress view
            and a door back into finished scenes, not a step in the loop, so behind
            the menu is exactly where it belongs — see ChapterMapScreen.tsx for the
            open question this defaults. */}
        <button
          type="button"
          className="vv-button"
          data-testid="menu-chapter-map"
          onClick={() => runtime.view.getState().openChapterMap()}
        >
          Chapter map
        </button>

        <button
          type="button"
          className="vv-button"
          data-testid="menu-replay-intro"
          onClick={() => runtime.view.getState().reopenIntro()}
        >
          Replay intro
        </button>

        <div className="vv-hud-menu__youversion">
          {session ? (
            <>
              <p data-testid="menu-youversion-status">Connected to YouVersion.</p>
              <YouVersionProfile
                profile={connectedProfile}
                label="Signed in as"
                testIdPrefix="menu"
              />
              <button
                type="button"
                className="vv-button vv-button--quiet"
                data-testid="menu-disconnect-youversion"
                onClick={() => {
                  runtime.store.getState().clearSession();
                  setConnectedProfile(null);
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <>
              <p>
                Connecting saves a highlight to your YouVersion account for every verse you read.
              </p>
              {runtime.session.isStub ? (
                <p className="vv-placeholder-tag">
                  Running against a stub sign-in — no real account is contacted
                </p>
              ) : null}
              <button
                type="button"
                className="vv-button"
                data-testid="menu-connect-youversion"
                disabled={signInStatus === "pending"}
                onClick={connect}
              >
                Connect YouVersion
              </button>
              {signInStatus === "failed" ? (
                <>
                  <p data-testid="menu-signin-message">
                    Couldn't connect right now. You can try again later — this never blocks play.
                  </p>
                  <SignInFailureReason reason={failureReason} />
                </>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          className="vv-button vv-button--quiet"
          data-testid="menu-close"
          onClick={() => runtime.view.getState().closeMenu()}
        >
          Close
        </button>
      </section>
    </div>
  );
}
