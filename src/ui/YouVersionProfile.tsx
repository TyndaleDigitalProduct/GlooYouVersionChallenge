// The "who just connected" row, shared by the two places that offer sign-in
// (SetupScreen.tsx and HudMenu.tsx, both PRD-11). One component rather than the
// same markup twice: the two call sites differ only in their label and their
// test ids, and the framing below is fiddly enough that it should not be
// maintained in two places.
//
// Neither field is persisted. They come off the id token's display claims and
// live in component state only, so this row is what a successful sign-in looks
// like in the moment it happens — see providers.ts's YouVersionSignInResult.

export interface YouVersionProfileFields {
  displayName?: string;
  avatarUrl?: string;
}

interface Props {
  profile: YouVersionProfileFields | null;
  /** "Signed in as" in the menu, "Connected as" at setup. */
  label: string;
  /** "menu" or "setup", keeping each screen's existing test ids stable. */
  testIdPrefix: string;
}

/**
 * Renders nothing unless there is something to show: an account may have
 * neither a name nor an avatar, and in that case the plain "Connected" copy the
 * caller already renders is the whole story.
 */
export function YouVersionProfile({ profile, label, testIdPrefix }: Props) {
  if (!profile?.displayName && !profile?.avatarUrl) return null;

  return (
    <div className="vv-yv-profile" data-testid={`${testIdPrefix}-youversion-profile`}>
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          // Decorative: the name beside it already identifies the account, so
          // announcing the image too would just repeat it.
          alt=""
          className="vv-yv-profile__avatar"
          data-testid={`${testIdPrefix}-youversion-avatar`}
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      {profile.displayName ? (
        <p className="vv-yv-profile__name" data-testid={`${testIdPrefix}-youversion-name`}>
          <span className="vv-yv-profile__label">{label}</span>
          <span className="vv-yv-profile__value">{profile.displayName}</span>
        </p>
      ) : null}
    </div>
  );
}
