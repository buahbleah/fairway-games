# Design System

The visual and interaction rules behind Fairway Games, and the reasoning for them.

Everything documented here exists as tokens in `src/design/tokens.css`. Nothing in
the app hardcodes a colour, a radius, a duration or a font size.

---

## 1. The brief, restated

The app is used standing on a tee box, one-handed, in sunlight, by someone who
wants to put the phone away again. Every design decision below was tested against
one question:

> Can a golfer understand this screen in under two seconds and hit the one thing
> they need with a thumb?

The second goal is that it should look like a golf product someone paid for —
premium, not a developer prototype. Where the two goals conflict, speed wins.

---

## 2. Visual direction

**What we are drawing from:** premium golf equipment, course signage, modern
tournament graphics, sand, early-morning light on a fairway, the materials of a
clubhouse.

**What we deliberately avoided:** cartoon golf graphics, fake grass textures,
generic green gradients, golf balls and flags scattered as decoration, casino
visuals for Vegas, old-fashioned country-club ornament, and the traditional
cluttered scorecard.

The golf reference is carried almost entirely by three things: the fairway-green
and sand palette, abstract contour geometry used sparingly behind hero areas, and
a condensed display typeface that reads like course signage and leaderboards. No
screen needs a golf-ball illustration to feel like golf.

---

## 3. Colour

### Palette selection

Four palettes were considered:

| Direction | Verdict |
| --- | --- |
| Bright fairway green + white | Rejected. Reads as a generic sports app; saturated green on white is fatiguing in sunlight |
| Monochrome charcoal + one accent | Rejected. Premium, but nothing about it says golf |
| **Deep fairway green + clubhouse cream + sand** | **Chosen** |
| Navy + gold "tournament" | Rejected. Handsome, but reads as sailing or motorsport before it reads as golf |

The chosen direction wins on three grounds: deep green on warm cream holds up in
direct sun far better than saturated green on pure white; sand is a golf-native
accent that is not green, which the interface badly needs for highlights; and the
warm off-white ground stops the app feeling clinical.

### Semantic tokens

Games never reference a raw ramp colour. They reference semantic tokens, which the
theme swaps.

| Token | Light | Dark | Used for |
| --- | --- | --- | --- |
| `--bg` | `#f8f4ea` | `#0a1310` | Page ground |
| `--surface` | `#fffdf8` | `#12201a` | Cards, rows, sheets |
| `--text` | `#14170f` | `#f1ede3` | Body text |
| `--text-muted` | `#5c6259` | `#a3b0a8` | Secondary text |
| `--brand` | `#1a5540` | `#3fa277` | Primary actions |
| `--accent` | `#a9823a` | `#d9b472` | Highlights, pots, carries |
| `--good` / `--bad` | green / clay | lighter variants | Gains and losses |

### Per-game accents

Each game gets one accent so the six read as siblings rather than six apps:

| Game | Accent | Reasoning |
| --- | --- | --- |
| Wolf | Deep forest `#1f4536` | Darkest, most serious of the set |
| Skins | Sand `#a9823a` | The prize colour — matches the pot |
| Nassau | Sky `#3e7ca6` | The only cool accent; three segments read as bars |
| Vegas | Clay `#8e4033` | Heat and risk without going near casino red |
| Dots | Olive `#6b6a2f` | Reads as enamel pin metal |
| Team Match | Mid green `#2f5d4a` | Team green, paired against team sand |

### Accessibility

- All body text meets WCAG AA against its surface in both themes. Display numbers
  meet AAA.
- **Colour is never the only signal.** The Wolf is marked by a badge with an icon
  *and* the word WOLF. Team sides carry a name and a distinct fill, not just a
  colour. Leaderboard movement shows an arrow *and* a number. Gains and losses
  carry a sign, not just red or green.
- Avatar colours were checked against deuteranopia and protanopia: the six are
  distinguishable by lightness as well as hue, and each avatar carries initials.
- `prefers-reduced-motion` collapses every animation to ~0ms.

### Sunlight mode

An optional third layer on top of light or dark. It raises contrast to near-maximum,
removes soft fills and all shadows, and darkens the brand colour so buttons stay
legible when the screen is washed out. It is a toggle rather than a default because
it is genuinely uglier — it exists for the day it is needed.

---

## 4. Typography

Two families, no web fonts. Web fonts were rejected outright: the app must work
with no signal, and shipping font binaries costs more than a system stack gives.

| Role | Stack | Why |
| --- | --- | --- |
| Display | `Bahnschrift` → `DIN Alternate` → `Roboto Condensed` → system | Condensed grotesque. Reads like course signage and tournament boards. Present on Windows, macOS and Android |
| Text | `Segoe UI Variable Text` → `Segoe UI` → system | Optimised for reading rules and settings |
| Numbers | Display stack with `tabular-nums` | Scores must not jitter as they change |

### Scale

`11 · 12 · 14 · 16 · 18 · 22 · 28 · 36 · 48 · 68 · 88`

**16px is the floor for body text.** 11px is permitted only for uppercase tracked
labels, never for content. Hole numbers render at 68px, results at 88px — a
glanceable hole number is the single most important piece of type in the app.

Hierarchy on the hole screen, deliberately steep:

```
HOLE            11px  tracked label
12              68px  display
PAR 4 · SI 7    14px  muted
```

---

## 5. Space, radius, elevation

- **Space:** a 4pt grid — `4 8 12 16 20 24 32 40 56 72`.
- **Radius:** `6 10 14 20 28` plus a pill. Cards use 20, buttons 14, sheets 28.
  Larger radii on larger surfaces, so nothing looks like a bubble.
- **Elevation:** three levels only. Level 1 for resting cards, 2 for primary
  buttons and floating cards, 3 for sheets. Sunlight mode removes all three.

---

## 6. Touch targets

| Target | Size |
| --- | --- |
| Minimum anything | 48px |
| Comfortable (steppers, chips, list rows) | 56px |
| Primary on-course action | 64px |

The score stepper's − and + are 56px squares, not the small controls most golf
apps ship. They are the most-tapped controls in the product and they are used with
a glove on.

---

## 7. Motion

| Band | Duration | Used for |
| --- | --- | --- |
| Instant | 90ms | Button press scale |
| Quick | 140ms | Chips, toggles, hover states |
| Card | 220ms | Screen and card transitions |
| Emphasis | 420ms | A result landing, points settling |
| Celebrate | 700ms | The flag rising on the results screen |

Easing: `cubic-bezier(0.22, 1, 0.36, 1)` for entrances, a light spring for
anything that should feel like it *lands* (points, the Vegas number).

**Nothing animates for longer than it takes to read it.** A hole result settles in
under half a second because the golfer is holding a putter.

---

## 8. Component decisions worth recording

**The hole screen is a state machine, not a form.** It shows exactly one stage at
a time — Wolf pick, then teams if they changed, then scores, then the result — and
each stage has one dominant action. This is the single most important interaction
decision in the app. Showing partner selection and score entry together would be
faster to build and much slower to use.

**Score entry defaults to par.** Tapping the number jumps straight to par, which
is the most common score for most golfers most of the time. From there − and + are
one tap each to bogey or birdie. Quick "Par / Birdie / Bogey" chips were prototyped
and cut: they added a row of chrome to save at most one tap, and they made the row
taller than a thumb's comfortable reach.

**Nothing advances underneath you.** Confirming a hole does not jump to the next
hole. The result stays on screen until the golfer taps on. This was a real bug
during build — the result screen was invisible because the app helpfully advanced —
and the fix is now a rule.

**Undo is always one tap from the hole screen** and is labelled with what it will
undo. Every mutation that matters pushes a snapshot; the undo stack survives a
reload.

**The leaderboard shows movement, not just position.** ▲2 next to a name tells a
story that a rank number alone does not.

**Sheets, not screens, for anything secondary.** Leaderboard, scorecard, hole log,
settings and presses are all bottom sheets. They open over the hole, dismiss with a
tap outside, and never lose the golfer's place.

---

## 9. Dark mode

Dark mode is a separate composition, not an inversion. The ground is a very dark
green-black (`#0a1310`) rather than neutral grey; panels are muted green; type is
warm off-white; highlights are sand. It is designed for the clubhouse and for an
evening nine, and it was checked at low screen brightness where pure black
surfaces would have banded against the green gradients.

---

## 10. Design reviews

Three reviews were run against the built product. Each produced changes.

### Review 1 — Golf brand identity

*Does this look like golf? Is it premium? Is it distinctive?*

| Finding | Action |
| --- | --- |
| Emoji were standing in as game marks on the home screen and game cards | Replaced with a custom six-mark icon set drawn on one 24px grid at one weight. Emoji now survive only inside the Dot Builder, where they are user-chosen content rather than interface |
| The palette read generic-sports in early drafts | Warmed the ground to clubhouse cream and pushed the green deeper; introduced sand as a real accent rather than a highlight |
| Nothing tied the screens together visually | Added the contour-line backdrop and the fairway/green geometry, used at low opacity behind heroes and empty states only |

### Review 2 — On-course UX

*Speed, one-handed use, button sizing, glanceability.*

| Finding | Action |
| --- | --- |
| Primary actions sat at the top of long screens, out of thumb reach | Every screen now has a sticky action bar pinned to the bottom, above the safe area |
| Confirming a hole silently skipped the result | Fixed — see §8. The result is a stage the golfer leaves deliberately |
| Fast successive taps on different players lost scores | Real bug, found by tapping four rows in one frame. Score writes now merge inside the state updater rather than from a render closure |
| Settings screens were long enough to need scrolling before the round | Advanced settings collapsed behind "More options"; the common path is now short |
| The Vegas visualisation pushed score entry below the fold | Rebuilt as one compact row per team. The number build is still the hero, but the steppers are now reachable without scrolling |
| The Dots "anything extra?" step needed scrolling past two players | Chips moved to a two-column grid at the 48px minimum, and the stat strip is hidden during that step. Three to four players now fit on one screen |
| Every hole screen showed the same fact twice — once as a status chip, once in the game's HUD | Status chips now carry only what the HUD cannot: the carry count in Skins, live press count in Nassau, holes won in Team Match, who is up in Vegas |

### Review 3 — Product polish

*Consistency, animation, empty states, transitions, app icon, dark mode.*

| Finding | Action |
| --- | --- |
| The app icon lost its flag at 48px and the dimples turned to mush | Redrawn: ball moved off-centre, flagstick enlarged and offset right, dimples enlarged. Now reads as two shapes at 48px and still holds detail at 1024px |
| Empty history said "no data" | Rewritten as an intentional empty state with course art and a real first line |
| Result screen was a list | Rebuilt around a hero with a rising flag, a dawn-light gradient and a settling score |
| Every screen was missing its left and right margin | A child rule's `padding` shorthand was silently cancelling the page padding. The layout was inverted: the page is now always padded and the few full-bleed elements pull themselves out with a negative margin |
| The result hero's flagstick drew straight through the winner's name | Moved off-centre and dropped to 50% opacity |
| The launch screen never cleared in a background tab | It was removed on `requestAnimationFrame`, which does not fire while a tab is hidden. Now a timer |
| Share was text only | Added a designed share card with two templates — leaderboard and winner — alongside the text share |

---

## 11. Final quality assessment

Rated after the three reviews. The bar set for shipping was 8/10.

| Category | Score | Note |
| --- | --- | --- |
| Golf identity | 9 | Palette, type and geometry carry it without a single cartoon golf ball |
| Premium appearance | 8 | Holds up. The honest gap is illustration depth — the game cards use marks where a commercial product would eventually use custom artwork |
| Ease of use | 9 | Progressive disclosure works: deep customisation before the round, one decision at a time during it |
| On-course usability | 9 | 56–64px targets, bottom-anchored actions, sunlight mode, one-tap undo |
| Visual consistency | 9 | Everything routes through tokens; one icon family; one settings renderer for all six games |
| Clarity | 9 | Every game states its status in words on the hole screen |
| Game understanding | 9 | Every game has a rules screen with a worked example that reflects the settings actually chosen |
| Fun | 8 | The Vegas number build and the Lone Wolf treatment land. More could be made of hole-win moments |
| App icon quality | 8 | Legible at every size, distinctly golf, not Wolf-specific |
| Overall desirability | 8 | |

**Nothing scored below 8.** The two 8s that came closest to failing — premium
appearance and fun — are both illustration-depth problems rather than structural
ones, and both are listed as the first things to invest in next.

---

## 12. What would be next

1. Custom illustration for each of the six game cards, replacing the icon marks.
2. Richer hole-win microinteractions, particularly for Skins pot wins and match
   closeouts.
3. Share-card image export — the text share works today, an image does not.
4. A second display face, if a licence-clean condensed variable font can be
   bundled without hurting offline load.
