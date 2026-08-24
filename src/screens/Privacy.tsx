import { AppBar } from '../ui/components'

/**
 * The privacy policy, in the app and at a public URL (#/privacy).
 *
 * Both app stores require a reachable policy before they will accept a build
 * that has sign-in. It is written to describe what the app actually does — if
 * the app starts collecting something else, this has to change with it.
 */

/** Change this to a mailbox you actually read before publishing. */
const CONTACT = 'privacy@fairwaygames.example'

export function PrivacyScreen() {
  return (
    <div className="page">
      <AppBar title="Privacy" />

      <div className="stack stack-5 rules-section">
        <p className="t-sm muted">Last updated: 24 August 2026</p>

        <section>
          <h3>The short version</h3>
          <ul>
            <li>
              <span>You can play without an account. Those rounds never leave your phone.</span>
            </li>
            <li>
              <span>
                If you sign in, we store what your golf group needs to see: your name, email,
                handicap, optional photo, and the rounds you share.
              </span>
            </li>
            <li>
              <span>No advertising, no analytics, no tracking, and nothing sold to anybody.</span>
            </li>
            <li>
              <span>You can delete your account, and everything with it, from inside the app.</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>What is stored, and why</h3>
          <ul>
            <li>
              <span>
                <strong>Your email</strong> — to sign you in and to let friends add you. Nobody can
                see it except people you play with.
              </span>
            </li>
            <li>
              <span>
                <strong>Your name, handicap and photo</strong> — shown to the people in your rounds
                and leagues. The photo is optional and is shrunk on your phone before it is sent.
              </span>
            </li>
            <li>
              <span>
                <strong>Your password</strong> — stored only as a scrypt hash. We cannot read it.
              </span>
            </li>
            <li>
              <span>
                <strong>Rounds, scores and leagues</strong> — so a shared round appears on everyone's
                phone and the group can look back at past games.
              </span>
            </li>
            <li>
              <span>
                <strong>A session token</strong> — a cookie in the browser, or a token stored on the
                device in the app, so you stay signed in.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h3>What is not collected</h3>
          <ul>
            <li>
              <span>No location, no contacts, no camera access beyond a photo you pick yourself.</span>
            </li>
            <li>
              <span>No advertising identifiers and no third-party trackers or SDKs.</span>
            </li>
            <li>
              <span>No analytics of how you use the app.</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Who else can see it</h3>
          <ul>
            <li>
              <span>
                <strong>People you play with</strong> — your name, photo, handicap and scores in
                rounds you share, and your name in leagues you join.
              </span>
            </li>
            <li>
              <span>
                <strong>Our hosting providers</strong> — the app runs on Vercel and the database is
                Neon. They process data on our behalf and do not use it for anything else.
              </span>
            </li>
            <li>
              <span>Nobody else. Your data is not sold, shared or used for advertising.</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Where it is stored</h3>
          <ul>
            <li>
              <span>
                On servers in the United States. If you are in Europe, that means your data is
                transferred outside the EEA under the provider's standard contractual clauses.
              </span>
            </li>
            <li>
              <span>Rounds you play without an account stay on your device only.</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Deleting your data</h3>
          <ul>
            <li>
              <span>
                <strong>In the app:</strong> Settings → Edit profile → Delete my account. This removes
                your account, your friends list, the leagues you own and the rounds you started.
              </span>
            </li>
            <li>
              <span>
                Rounds started by somebody else stay with them, since they contain other players'
                scores, but your name is detached from them.
              </span>
            </li>
            <li>
              <span>
                You can also write to {CONTACT} and ask us to delete everything.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Your rights</h3>
          <ul>
            <li>
              <span>
                Under the GDPR and the Swiss FADP you may ask for a copy of your data, ask for it to
                be corrected, or ask for it to be erased.
              </span>
            </li>
            <li>
              <span>Write to {CONTACT} and we will answer within 30 days.</span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Children</h3>
          <ul>
            <li>
              <span>
                The app is not aimed at children under 13, and we do not knowingly collect their
                data.
              </span>
            </li>
          </ul>
        </section>

        <section>
          <h3>Changes</h3>
          <ul>
            <li>
              <span>
                If this policy changes in a way that matters, the date at the top changes and the app
                will say so.
              </span>
            </li>
          </ul>
        </section>

        <p className="t-sm muted">Questions: {CONTACT}</p>
      </div>
    </div>
  )
}
