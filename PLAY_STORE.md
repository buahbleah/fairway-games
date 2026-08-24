# Getting Fairway Games onto the Play Store

Everything the repository can do is done. What is left needs a browser, a card,
and one command on a machine with a JDK.

---

## 1. Create the signing key — once, and never lose it

Google identifies your app by this key forever. Lose it and you cannot update
the app; you would have to publish a new listing under a new name.

On any machine with a JDK (Android Studio installs one; `keytool` comes with it):

```bash
keytool -genkeypair -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias fairway
```

It asks for a password and a few name fields. Answer them, then **back the
`upload.jks` file up somewhere safe** — a password manager, not just the laptop.

Turn it into text so GitHub can hold it:

```bash
base64 -w0 upload.jks > upload.jks.base64
```

On Windows PowerShell:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("upload.jks")) | Set-Content upload.jks.base64
```

## 2. Add four repository secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | the contents of `upload.jks.base64` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password you chose |
| `ANDROID_KEY_ALIAS` | `fairway` |
| `ANDROID_KEY_PASSWORD` | the key password (usually the same one) |

Then delete `upload.jks.base64` from your disk. The `.jks` itself is already in
`.gitignore` and cannot be committed by accident.

## 3. Build the bundle

**Actions → Play Store release → Run workflow**, and give it a version like
`1.0.0`. It runs the tests, builds the web app, signs the bundle and hands you
`app-release.aab` as an artifact.

Play wants an **AAB**, not the APK — the APK is only for your own testing.

## 4. Play Console

1. Create a developer account — **$25, one-time**, at
   [play.google.com/console](https://play.google.com/console).
2. **Create app** → name, language, "App", "Free".
3. Upload the AAB under **Production → Create new release** (or start with
   **Internal testing**, which is faster to get in front of your golf group).

### The forms it will ask for

| Item | What to say |
| --- | --- |
| **Privacy policy URL** | `https://<your-app>/#/privacy` — it is in the app already |
| **Data safety** | Collected: email, name, approximate "other" data (handicap), photos, app activity. All linked to the user, none shared with third parties, all deletable in-app. Encrypted in transit: yes |
| **Account deletion** | In-app: Settings → Edit profile → Delete my account. Also give the same URL as the web route |
| **Content rating** | Questionnaire — no gambling (points are not real money), no violence, no user-generated content shown publicly |
| **Target audience** | 18+ is simplest; the app is not aimed at children |
| **Ads** | No |
| **App category** | Sports |

### Store listing assets

| Asset | Size | Status |
| --- | --- | --- |
| App icon | 512×512 PNG | `public/icons/icon-512.png` ✅ |
| Feature graphic | 1024×500 | **needs making** |
| Phone screenshots | at least 2, 16:9 or 9:16 | `screenshots/` has 23 at 780×1688 ✅ |
| Short description | 80 chars | e.g. "Six golf betting games, scored in seconds between two shots." |
| Full description | 4000 chars | draft from the README |

## 5. The timing surprise

If your Play account is a **personal** account created after November 2023,
Google requires **12 testers opted in for 14 continuous days** before you may
publish to production. Plan two weeks, not two days.

Organisation accounts skip that, but need a D-U-N-S number, which takes its own
time to obtain.

Either way, **Internal testing** has none of these restrictions and gets a link
you can send to your group immediately. That is the sensible first step.

---

## Already done in the repo

- Signed-release Gradle config, reading the keystore from the environment so
  nothing sensitive is ever committed
- `Play Store release` workflow producing the AAB
- Version code from the build number, so each upload is a genuine update
- Privacy policy at `#/privacy`, linked from Settings
- In-app account deletion, which both stores require
- App icons at every density, including maskable
