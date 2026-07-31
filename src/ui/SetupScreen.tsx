import { useState } from "react";
import { useRuntime } from "./RuntimeContext";
import { reportSignInFailure, SignInFailureReason } from "./signInFailureReason";
import { YouVersionProfile, type YouVersionProfileFields } from "./YouVersionProfile";

/**
 * Sized to the dialogue box (52rem max-width, ~0.95em text): long enough for
 * a real name plus dialogue's own "{name}, ..." framing to still read
 * comfortably on one line. Enforced at input (via the `maxLength` attribute
 * and the `onChange` slice below), not only on submit (storyboard-v2.md §2).
 */
export const NAME_MAX_LENGTH = 24;

type SignInStatus = "idle" | "pending" | "failed" | "succeeded";

/**
 * Setup (PRD-11, storyboard-v2.md §2): required name entry plus the optional
 * YouVersion sign-in offer. Reached from the home screen's *Enter* (no save)
 * or a confirmed *New game* (existing save) — never from *Continue*, which
 * skips straight to "playing" because the name is already on the save.
 */
export function SetupScreen() {
  const runtime = useRuntime();
  const [name, setName] = useState("");
  const [touched, setTouched] = useState(false);
  const [signInStatus, setSignInStatus] = useState<SignInStatus>("idle");
  const [connectedProfile, setConnectedProfile] = useState<YouVersionProfileFields | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);

  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  const submit = () => {
    if (!isValid) {
      setTouched(true);
      return;
    }
    runtime.store.getState().setPlayerName(trimmed);
    runtime.view.getState().beginIntro();
  };

  const connect = async () => {
    setSignInStatus("pending");
    const result = await runtime.session.signIn();
    if (result.ok) {
      runtime.store.getState().setSession(result.value.yvpId);
      setConnectedProfile({
        displayName: result.value.displayName,
        avatarUrl: result.value.avatarUrl,
      });
      setSignInStatus("succeeded");
    } else {
      setFailureReason(reportSignInFailure(result.reason));
      setSignInStatus("failed");
    }
  };

  return (
    <div className="vv-setup" data-testid="setup-screen">
      <section className="vv-panel vv-setup__panel">
        <h1 className="vv-setup__title">Before you begin</h1>

        <label className="vv-setup__label" htmlFor="player-name-input">
          What should we call you?
        </label>
        <input
          id="player-name-input"
          type="text"
          className="vv-setup__input"
          data-testid="player-name-input"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          onChange={(event) => setName(event.target.value.slice(0, NAME_MAX_LENGTH))}
          onBlur={() => setTouched(true)}
        />
        {touched && !isValid ? (
          <p className="vv-setup__error" data-testid="player-name-error">
            Enter a name to continue.
          </p>
        ) : null}

        <div className="vv-setup__signin">
          <h2 className="vv-setup__subhead">Connect YouVersion (optional)</h2>
          <p>
            Connecting saves a highlight to your YouVersion account for every verse you read in this
            game. If you skip this, you still get the full game — nothing is withheld — and you can
            connect later from the in-game menu.
          </p>
          {runtime.session.isStub ? (
            <p className="vv-placeholder-tag">
              Running against a stub sign-in — no real account is contacted
            </p>
          ) : null}
          <button
            type="button"
            className="vv-button"
            data-testid="setup-connect-youversion"
            disabled={signInStatus === "pending" || signInStatus === "succeeded"}
            onClick={connect}
          >
            {signInStatus === "succeeded" ? "Connected" : "Connect YouVersion"}
          </button>
          {signInStatus === "succeeded" ? (
            <YouVersionProfile
              profile={connectedProfile}
              label="Connected as"
              testIdPrefix="setup"
            />
          ) : null}
          {signInStatus === "failed" ? (
            <>
              <p data-testid="setup-signin-message">
                Couldn't connect right now. You can try again later from the menu — this never
                blocks play.
              </p>
              <SignInFailureReason reason={failureReason} />
            </>
          ) : null}
        </div>

        <button
          type="button"
          className="vv-button vv-button--primary"
          data-testid="setup-continue"
          disabled={!isValid}
          onClick={submit}
        >
          Continue
        </button>
      </section>
    </div>
  );
}
