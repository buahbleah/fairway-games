# Fairway Games

Six golf betting games, scored in seconds between two shots.

**Wolf · Skins · Nassau · Vegas · Dots · Team Match Play**

Open phone → enter result → put phone away.

---

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173. Use a phone-sized viewport — the app is built
for a phone held in one hand.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build into `dist/`, including the offline service worker |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the full test suite once |
| `npm run test:watch` | Tests in watch mode |
| `node scripts-gen-icons.mjs` | Re-rasterise the app icons from their source SVGs |
| `node scripts-screenshots.mjs` | Capture the key screens into `screenshots/` (dev server must be running) |
| `node scripts-offline-check.mjs` | Prove the built app plays a hole with the network switched off (`npm run preview` must be running) |

## Playing together

Sign in with an email and the group can share a round: everyone scores from their
own phone and the card fills in on every screen. Around that sit a friends list
(add by email), leagues with a join code and their full round history, and round
invitations.

**Signing in is optional.** A solo round needs no account and no connection —
that path is unchanged.

Handicaps are per player: only you can edit yours, and Round Setup has a single
"even it up with handicaps" control that shows what each player will play off
before anyone tees off. Underneath, that is the same net-scoring engine the six
games already used — shots are given on the hardest holes by stroke index.

## Offline

The app is offline-first, not offline-capable-if-you-are-lucky. Rounds, players,
presets and preferences live in `localStorage`; the production build precaches
every asset with a service worker. Once the app has been opened while online, it
works with the phone in aeroplane mode.

Shared rounds keep that property. Writes go to a local mirror and a queue, and
the queue flushes when the signal comes back. Hole scores are merged **key by
key** in Postgres, so a queued write replayed twenty minutes later never wipes
out what somebody else entered in the meantime — it only replaces its own
players' numbers. That is the single behaviour live scoring rests on and it has
a dedicated integration test.

This is verified, not assumed. `scripts-offline-check.mjs` loads the production
build, switches the network off, reloads, plays a hole of Skins and reloads again:

```
service worker registered: true
offline reload rendered the app: true
offline hole scored: true
offline round resumed after reload: true
```

## Deploying

The web app is static; `api/` is a set of Vercel Node functions backed by Neon
Postgres.

1. Import the repository at [vercel.com/new](https://vercel.com/new). Vercel
   detects Vite; `vercel.json` pins the function region next to the database.
2. Add one environment variable — `DATABASE_URL`, the Neon connection string —
   for Production, Preview and Development.
3. Deploy. Every push to `main` redeploys from then on.

The schema lives in `db/schema.sql`. Run it once against a fresh database.

## Installing on a phone

**As a PWA (works today, no build tools needed):** serve `dist/` over HTTPS,
open it in Chrome on Android or Safari on iOS, and use "Add to Home Screen". It
installs with the app icon, runs full-screen with no browser chrome, and works
offline.

**As an APK:** the project is set up for [Capacitor](https://capacitorjs.com),
which wraps the built app in a native Android shell. Producing the APK needs a
JDK 17+ and the Android SDK, neither of which is installed on this machine — so
the Android project has not been generated here. Once those are installed:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap add android
npm run cap:sync
cd android && ./gradlew assembleDebug
```

The APK lands in `android/app/build/outputs/apk/debug/`. `capacitor.config.ts` is
already in the repo with the app id, name and `dist` web directory set.

---

## How the code is arranged

```
api/             Vercel functions — accounts, friends, leagues, rounds, sync
  _lib/          database, sessions, password hashing, request plumbing
src/
  core/          domain types, handicap maths, course data, shared scoring helpers
  games/
    wolf/        each game owns its rules, its settings, its HUD and its tests
    skins/
    nassau/
    vegas/
    dots/
    team_match_play/
    registry.ts  the only file that knows all six games exist
    hudRegistry.ts
  design/        tokens, base styles, components, screens — no colour is hardcoded elsewhere
  net/           the only module that talks to the server
  state/         local store, account, shared-round sync, and a small hash router
  ui/            shared components, icon system, course artwork
  screens/       home, game select, rules, setup, play, results, history, settings
```

### The one idea worth knowing

A round is stored as **setup plus a list of hole entries**. Everything else —
standings, match status, presses, carries, final results — is derived by a pure
fold over those entries every time they change.

That single decision is what makes undo, hole editing, resuming a round and the
whole history view fall out for free. No game keeps hidden running state, which
is also why the games are straightforward to test: build an array of holes, call
`compute`, check the numbers.

### Adding a seventh game

1. Create `src/games/<name>/index.ts` exporting a `GolfGame`.
2. Declare which settings it needs using the shared setting builders in
   `src/core/settings.ts`. Do not invent new controls.
3. Add a HUD component if the game needs something above the hole.
4. Add one line to `registry.ts` and one to `hudRegistry.ts`.
5. Write the tests.

Nothing else in the app needs to change. See `GAME_RESEARCH.md` for what game #7
should be and why.

---

## Tests

```bash
npm test
```

138 tests covering all six scoring engines, the handicap maths and the offline
write queue: every Wolf scenario, skins carries and validation, Nassau presses
and re-presses, Vegas number construction and flips, every Dots rule variation,
and match-play result notation including dormie and closeouts.

A further 17 integration tests exercise the API against a real database, and run
only when `DATABASE_URL` is set:

```bash
DATABASE_URL="postgres://..." npm test
```

They cover registration, sign-in (including that a wrong password and an unknown
address give the same answer, so accounts cannot be enumerated), friend requests,
league join codes, round access control, and the score merge two phones depend
on.

---

## Documentation

- **`DESIGN_SYSTEM.md`** — palette, typography, motion, accessibility, the three
  design reviews and what each one changed.
- **`GAME_RESEARCH.md`** — twenty golf formats surveyed and ranked, with the
  recommendation for games #7, #8 and #9.
- **`db/schema.sql`** — the database schema, with the trigger that powers the
  cheap version-poll.
