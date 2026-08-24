# Game Research

Survey of golf side-game formats considered for Fairway Games, with a ranking and
a recommendation for what should become games #7, #8 and #9.

The six formats already shipped — Wolf, Skins, Nassau, Vegas, Dots and Team Match
Play — were chosen to cover the four things a group actually asks for: a partner
game, a hole-by-hole prize game, a bet structure, and a team match. Everything
below is judged against what those six already give you.

---

## Scoring the candidates

Every format is rated on five things that matter for *this* app:

| Criterion | What it means |
| --- | --- |
| **Popularity** | How often a normal group actually plays it |
| **Distinct** | Does it add something the six existing games do not already cover? |
| **Speed** | Taps per hole. Anything needing more than the score is a cost |
| **Flexibility** | Player counts it supports |
| **Effort** | Implementation cost against the existing engine |

Scores are 1–5. **Fit** is the weighted total, with Speed and Distinct weighted
double because on-course speed is the product's whole reason for existing.

---

## The ranking

| # | Format | Players | Popularity | Distinct | Speed | Flexibility | Effort | **Fit** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | **Stableford** | 1–4 | 5 | 5 | 5 | 5 | Low | **29** |
| 2 | **Bingo Bango Bongo** | 3–4 | 4 | 5 | 3 | 4 | Low | **24** |
| 3 | **Nines (5-3-1)** | 3 | 4 | 4 | 5 | 2 | Low | **24** |
| 4 | **Quota** | 1–4 | 3 | 4 | 5 | 5 | Low | **26** |
| 5 | **Hammer** | 2–4 | 3 | 5 | 3 | 4 | Medium | **23** |
| 6 | **Banker / Chairman** | 3–4 | 3 | 4 | 3 | 3 | Medium | **20** |
| 7 | **Scramble / Shamble** | 2–4 | 5 | 2 | 5 | 4 | Low | **23** |
| 8 | **Chapman / Pinehurst** | 4 | 2 | 3 | 5 | 2 | Low | **20** |
| 9 | **Rabbit** | 2–4 | 3 | 3 | 5 | 4 | Low | **23** |
| 10 | **Acey Deucey** | 4 | 2 | 3 | 5 | 2 | Low | **20** |
| 11 | **Daytona** | 4 | 2 | 2 | 4 | 2 | Low | **16** |
| 12 | **Defender** | 3–4 | 2 | 3 | 4 | 3 | Medium | **17** |
| 13 | **Train** | 2–4 | 1 | 3 | 3 | 4 | Medium | **15** |
| 14 | **Chicago** | 1–4 | 2 | 2 | 5 | 5 | Low | **21** |
| 15 | **Portuguese Caddy** | 3–4 | 1 | 3 | 2 | 3 | Medium | **13** |
| 16 | **Scotch (Bridge)** | 4 | 2 | 2 | 2 | 2 | High | **12** |
| — | *Sixes / Round Robin* | 4 | 4 | 1 | 5 | 2 | — | *already shipped* |
| — | *Alternate Shot / Foursomes* | 4 | 4 | 1 | 5 | 2 | — | *already shipped* |

Two candidates from the original list are struck through because the app already
covers them: **Sixes / Round Robin** ships as the rotate-every-six-holes option
inside Team Match Play and Vegas, and **Alternate Shot** ships as the Foursomes
format inside Team Match Play. Building either as a separate game would add a
tile to the home screen without adding a game.

---

## Recommendations

### Game #7 — Stableford

**Why it wins.** It is the most-played format in the world outside the United
States, it is the default for club competitions across Europe, and it is the one
format a group is likely to want *alongside* a betting game rather than instead of
one. It also solves a real gap: every current game is a wager. Stableford is a
score.

**Rules.** Points are awarded against a fixed target, normally net par:

| Result | Points |
| --- | --- |
| Double bogey or worse | 0 |
| Bogey | 1 |
| Par | 2 |
| Birdie | 3 |
| Eagle | 4 |
| Albatross | 5 |

Highest total wins. A blow-up hole costs at most two points, so the round stays
alive — which is exactly why clubs like it.

**Implementation cost: low.** No extra taps at all; it reads the scores that are
already entered. The handicap machinery, the net-score engine and the leaderboard
all exist. The settings it needs — Modified Stableford point tables, and whether
to score gross or net — are existing setting types.

**Variations to support:** Modified Stableford (the US Tour table: eagle 5,
birdie 2, par 0, bogey −1, double −3), and a configurable custom table.

---

### Game #8 — Bingo Bango Bongo

**Why it wins.** It is the best format in golf for a group with wildly different
handicaps, because the three points on every hole have nothing to do with total
score — a 24-handicapper can beat a 6-handicapper on any given hole. It is also
genuinely distinct: no existing game rewards *order of play*.

**Rules.** Three points on every hole:

- **Bingo** — first ball on the green
- **Bango** — closest to the pin once every ball is on the green
- **Bongo** — first ball in the hole

Honour is strict: the player furthest from the hole always plays first, which is
what keeps the game fair.

**Implementation cost: low.** The entry pattern already exists — this is the Dots
"anything extra?" step with three buttons and a single winner each. The Dots
architecture was deliberately built so individual achievements could become
side-game modules; Bingo Bango Bongo is the first real test of that.

**Risk:** three extra taps per hole. Mitigation is the same as Dots — one row of
three large chips, tap the player, done. If testing shows it slows a group down,
the honour-order prompt should be dropped rather than the game.

---

### Game #9 — Nines (also called 5-3-1)

**Why it wins.** It fills the app's real remaining gap: **three-ball golf.** Wolf
is the only current game built for three, and Nines is its natural companion —
where Wolf is about partnership and nerve, Nines is a pure per-hole points split
that runs itself.

**Rules.** Nine points are on offer every hole, divided by finishing position:

| Situation | Split |
| --- | --- |
| Outright 1st / 2nd / 3rd | 5 / 3 / 1 |
| Two tied for best | 4 / 4 / 1 |
| Two tied for worst | 5 / 2 / 2 |
| All three tied | 3 / 3 / 3 |

The total is always nine, which makes the leaderboard trivially checkable at the
turn — a genuinely nice property on a scorecard.

**Implementation cost: low.** Pure function of the three scores. No extra taps.
The tie tables are the only real logic and they are small enough to test
exhaustively.

---

## Honourable mentions

**Quota** scored well and is nearly free to build once Stableford exists — each
player's target is 36 minus their course handicap, and they play to beat it. It
is a strong candidate for #10 precisely *because* it shares Stableford's engine.

**Hammer** is the most fun format on the list and the most distinct: either side
can "throw the hammer" at any point to double the hole, and the other side must
accept or forfeit. It is the only candidate that needs live, in-the-moment
interaction rather than after-the-fact entry, which makes it both the most
interesting and the riskiest for a phone that is supposed to stay in a pocket.
Worth prototyping, not worth committing to yet.

**Rabbit** is a lovely little game — win a hole outright and you "own the rabbit"
until someone else wins a hole outright, and whoever holds it at the turn and at
the 18th collects. The holder mechanic is already built for the Dots snake, so it
would be cheap. It is simply less asked for than the three above.

**Scramble and Shamble** are formats a group *plays*, not games a group *bets*.
Scramble already exists inside Team Match Play as a format option. A standalone
Scramble mode would mostly be a scorecard, and the app is not trying to be a
scorecard.

---

## What we chose not to pursue

**Scotch / Bridge** needs bidding, doubling and a running contract between two
pairs. It is a genuinely good game and completely wrong for a phone in a golf
bag — the interaction cost is several times anything else on this list.

**Portuguese Caddy** (where the group votes on which shot to hit) is a talking
game, not a scoring game. There is nothing for the app to do.

**Daytona** is a Vegas variant — the losing team's number is built high-score-first
instead of low. It belongs as a Vegas setting, not a game. Adding it as
`numberOrder: 'lowFirst' | 'daytona'` in the Vegas settings is a ten-line change
and is the right way to ship it.

**Chicago** is a quota game with a fixed points table and is close enough to Quota
that shipping both would confuse more than it adds.

---

## Sources of variation

Every format above is played differently by different groups, which is the single
strongest argument for the settings architecture this app uses. During research the
same format was found with materially different rules under the same name —
Sandies, Greenies, presses, Vegas flips and Wolf's lone-wolf multiplier all vary
by region and by group. The app's answer is not to pick a winner but to name the
variations, show which ones are switched on, and let the group decide on the first
tee.
