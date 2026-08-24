# Store listing copy

Ready to paste into the Play Console. Character limits are Google's.

---

## App name — 30 characters max

```
Fairway Games
```

*(13 characters. "Fairway Games: Golf Betting" also fits at 27 if you want the
extra search term, but a clean name reads better on a home screen.)*

---

## Short description — 80 characters max

```
Six golf side games, scored in seconds between two shots.
```

*(57 characters.)*

Alternatives, if you want to test which converts:

```
Wolf, Skins, Nassau, Vegas and more. Score the game, not just the card.
```
*(70 characters.)*

```
The golf games your group actually plays — scored fast, works with no signal.
```
*(76 characters.)*

---

## Full description — 4000 characters max

```
Your group already plays these games. Now the maths is somebody else's problem.

Fairway Games scores the six side games golfers actually bet on, and gets out of
the way between shots. Open the phone, tap a number, put it back in your pocket.


SIX GAMES, PROPERLY BUILT

🐺 WOLF — Every hole one player is the Wolf. Watch the drives, pick a partner,
or take everyone on alone for more points. Blind Wolf, carry-overs and the
rotation on the closing holes are all yours to set.

🏆 SKINS — Every hole is a prize. Tie it and nobody wins, so the pot rolls into
the next hole. Carry-overs, progressive skins, validation skins, custom hole
values.

🇺🇸 NASSAU — Three bets in one round: front nine, back nine and the eighteen.
Presses, automatic presses and re-presses, played as singles or as teams.

🎰 VEGAS — Two pairs. Your scores go side by side to make one number: a 4 and a
5 make 45, not 9. The difference is the damage. Birdie flips, point caps and
rotating partners.

⭐ DOTS — Also called Junk, Trash or Garbage. Points for birdies, greenies,
sandies, chip-ins and the dreaded snake. Every dot is editable: rename it,
change what it pays, add your own.

⚔️ TEAM MATCH — Two teams, hole by hole. Four-Ball, Foursomes or Scramble, with
proper match play — 1 UP, all square, dormie and a match that ends 4 & 3.


NOBODY HAS TO KNOW THE RULES

Every game has a rules screen written for someone who has never played it: what
happens on a hole, what the points are, and a worked example using the settings
your group actually chose. Read it on the first tee in two minutes.


EVEN IT UP WITH HANDICAPS

One switch turns any game into a fair contest. Shots are given on the hardest
holes first, off the lowest handicap in the group, and the app shows exactly
what each player will receive before anyone tees off. A 6 and a 24 can have a
real match.


PLAY TOGETHER

Add friends by email. Start a league for your regular group and keep every round
you have ever played in one place. Invite people to a round and everyone scores
from their own phone — the card fills in on every screen as it happens.


IT WORKS WHERE YOU PLAY

Golf courses have dead spots. Fairway Games is built for that. Scores you enter
with no signal are saved on your phone and sent on the moment it comes back, and
nothing you enter is ever lost — even when four people are scoring the same hole
from four phones in patchy coverage.

You can also play the whole thing with no account and no connection at all.


BUILT FOR ONE HAND, IN THE SUN

Big numbers, big buttons, one decision on screen at a time. A dark mode designed
for early tee times, and a high-contrast sunlight mode for when you cannot see a
thing.


NO NONSENSE

No adverts. No tracking. No analytics. Points are points — there is no real
money anywhere in the app. Delete your account and everything with it from
inside Settings, whenever you like.
```

*(About 2,650 characters — comfortably inside the limit.)*

---

## Assets

| Asset | File | Status |
| --- | --- | --- |
| App icon 512×512 | `public/icons/icon-512.png` | ✅ |
| Feature graphic 1024×500 | `store/feature-graphic-1024x500.png` | ✅ |
| Phone screenshots 1080×1920 | `store/screenshot-*.png` (7) | ✅ |

Play needs **at least 2** screenshots and allows up to 8. All seven are ready;
`01-home`, `10-vegas`, `23-handicaps` and `05-wolf-pick` are the four that
explain the app fastest, so put those first.

Regenerate any of it with:

```bash
node scripts-store-assets.mjs
```

---

## A note on language

The app itself is entirely in English, so this listing is in English. Play lets
you add a German listing, but a German store page leading to an English app
reads badly and reviewers notice.

If you want the Swiss market properly, the app should be localised first — that
is a real piece of work (roughly 400 strings, most of them the rules text, which
is the part that needs a golfer's German rather than a translator's). Worth
doing, but as its own job rather than a store field.
