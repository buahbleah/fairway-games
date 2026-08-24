/**
 * WOLF
 *
 * One player is the Wolf on each hole and picks a partner after watching the
 * others tee off — or goes it alone for more points. Rotation moves round the
 * group so everyone is Wolf the same number of times.
 */


import {
  bestBall,
  completedEntries,
  effectiveScores,
  nameOf,
  namesOf,
  netContextFrom,
  rankRows,
  signed,
  sumPoints,
  tidy,
  withMovement,
} from '../../core/scoring'
import {
  choice,
  defaultsFrom,
  grossNetSetting,
  handicapSettings,
  moneyLabel,
  num,
  pointValueSetting,
  toggle,
} from '../../core/settings'
import type {
  ComputedRound,
  FinalResult,
  GameContext,
  GolfGame,
  HoleEntry,
  HoleOutcome,
  PlayerId,
  RulesDoc,
  SettingDef,
  SettingsValues,
  StatusChip,
} from '../../core/types'

export type WolfMode = 'partner' | 'lone' | 'blind'

export interface WolfHolePayload {
  wolfId: PlayerId
  mode: WolfMode
  partnerId?: PlayerId
}

const POINTS_GROUP = 'Points'
const RULES_GROUP = 'Rules'
const ROTATION_GROUP = 'Rotation'

export const wolfSettings: SettingDef[] = [
  num('wolfTeamWinPoints', 'Wolf + Partner win', 2, {
    group: POINTS_GROUP,
    min: 0,
    max: 20,
    presets: [1, 2, 3],
    suffix: 'pts each',
    help: 'Points to the Wolf and the chosen partner when their team wins the hole.',
  }),
  num('hunterWinPoints', 'Hunters win', 3, {
    group: POINTS_GROUP,
    min: 0,
    max: 20,
    presets: [1, 2, 3],
    suffix: 'pts each',
    help: 'Points to each opponent when the Wolf’s team loses the hole.',
  }),
  num('loneWolfWinPoints', 'Lone Wolf wins', 3, {
    group: POINTS_GROUP,
    min: 0,
    max: 30,
    presets: [3, 4, 6],
    suffix: 'pts',
    help: 'Points to the Wolf for beating the whole field alone.',
  }),
  num('loneWolfLossPoints', 'Lone Wolf loses', 2, {
    group: POINTS_GROUP,
    min: 0,
    max: 30,
    presets: [1, 2, 3],
    suffix: 'pts each',
    help: 'Points to each opponent when a Lone Wolf is beaten.',
  }),
  toggle('blindWolf', 'Blind Wolf', true, {
    group: RULES_GROUP,
    help: 'Wolf may declare "blind" before anyone tees off, for bigger stakes.',
  }),
  num('blindWolfMultiplier', 'Blind Wolf multiplier', 2, {
    group: RULES_GROUP,
    min: 1,
    max: 5,
    presets: [2, 3],
    suffix: '×',
    help: 'Lone Wolf points are multiplied by this when the Wolf went blind.',
    visibleWhen: (s) => !!s.blindWolf,
  }),
  choice('tieBehaviour', 'When the hole is tied', 'push', [
    { value: 'push', label: 'No points', help: 'Nothing happens. The hole is a wash.' },
    { value: 'carry', label: 'Carry over', help: 'The hole’s points are added to the next hole.' },
    { value: 'hunters', label: 'Hunters win', help: 'A tie goes to the field. The Wolf must win outright.' },
    { value: 'wolf', label: 'Wolf side wins', help: 'The Wolf’s team only has to tie.' },
  ], { group: RULES_GROUP }),
  num('carryCap', 'Maximum carry', 4, {
    group: RULES_GROUP,
    min: 1,
    max: 10,
    suffix: '× hole value',
    help: 'Stops the pot running away on a long string of tied holes.',
    visibleWhen: (s) => s.tieBehaviour === 'carry',
    advanced: true,
  }),
  grossNetSetting(),
  ...handicapSettings(100, 'Wolf is a match format, so 100% off the low player is the usual allowance.'),
  choice('rotation', 'Wolf rotation', 'sequential', [
    { value: 'sequential', label: 'In player order', help: 'Wolf moves down the tee order, hole by hole.' },
    { value: 'custom', label: 'Custom order', help: 'Set the rotation yourself in Round Setup.' },
  ], { group: ROTATION_GROUP }),
  choice('finalHoles', 'Left-over holes', 'continue', [
    { value: 'continue', label: 'Keep rotating', help: 'The rotation simply carries on.' },
    { value: 'trailing', label: 'Player in last is Wolf', help: 'A chance for the loser to catch up.' },
    { value: 'leader', label: 'Leader is Wolf', help: 'The leader must defend their lead.' },
  ], {
    group: ROTATION_GROUP,
    help: '18 holes does not divide evenly by 4 players — these settings decide holes 17 and 18.',
  }),
  pointValueSetting(),
]

/* ------------------------------------------------------------------ rotation */

export function wolfForHole(
  rotation: PlayerId[],
  holeIndex: number,
  settings: SettingsValues,
  standingsBefore: { playerId: PlayerId; value: number }[],
): PlayerId {
  const n = rotation.length
  if (n === 0) return ''
  const fullCycles = Math.floor(18 / n) * n
  const isLeftOver = holeIndex >= fullCycles
  if (isLeftOver && settings.finalHoles !== 'continue' && standingsBefore.length) {
    const sorted = [...standingsBefore].sort((a, b) => a.value - b.value)
    return settings.finalHoles === 'trailing' ? sorted[0].playerId : sorted[sorted.length - 1].playerId
  }
  return rotation[holeIndex % n]
}

/* ------------------------------------------------------------------- compute */

function pointsFor(settings: SettingsValues, mode: WolfMode, multiplier: number) {
  const blindMult = mode === 'blind' ? Number(settings.blindWolfMultiplier ?? 2) : 1
  return {
    wolfTeamWin: Number(settings.wolfTeamWinPoints ?? 2) * multiplier,
    hunterWin: Number(settings.hunterWinPoints ?? 3) * multiplier,
    loneWin: Number(settings.loneWolfWinPoints ?? 3) * multiplier * blindMult,
    loneLoss: Number(settings.loneWolfLossPoints ?? 2) * multiplier * blindMult,
  }
}

function compute(ctx: GameContext, entries: HoleEntry[]): ComputedRound {
  const net = netContextFrom(ctx)
  const rotation: PlayerId[] = ctx.gameState.rotation ?? ctx.players.map((p) => p.id)
  const done = completedEntries(entries).sort((a, b) => a.hole - b.hole)

  const outcomes: HoleOutcome[] = []
  let carry = 0
  let carriedFromHoles: number[] = []

  for (const entry of done) {
    const payload = (entry.game ?? {}) as WolfHolePayload
    const wolfId = payload.wolfId || rotation[0]
    const scores = effectiveScores(ctx, net, entry)
    const multiplier = Math.min(1 + carry, Number(ctx.settings.carryCap ?? 4))
    const pts = pointsFor(ctx.settings, payload.mode ?? 'partner', multiplier)

    const lone = payload.mode === 'lone' || payload.mode === 'blind'
    const wolfTeam = lone ? [wolfId] : [wolfId, payload.partnerId].filter(Boolean) as PlayerId[]
    const hunters = ctx.players.map((p) => p.id).filter((id) => !wolfTeam.includes(id))

    const wolfScore = bestBall(scores, wolfTeam)
    const hunterScore = bestBall(scores, hunters)

    const points: Record<PlayerId, number> = {}
    for (const p of ctx.players) points[p.id] = 0
    const detail: string[] = []
    if (multiplier > 1) detail.push(`Worth ${multiplier}× — carried from hole ${carriedFromHoles.join(', ')}.`)

    let headline: string
    if (wolfScore == null || hunterScore == null) {
      outcomes.push({ hole: entry.hole, points, headline: 'Waiting for scores', pending: true })
      continue
    }

    const wolfSideWins =
      wolfScore < hunterScore || (wolfScore === hunterScore && ctx.settings.tieBehaviour === 'wolf')
    const huntersWin =
      hunterScore < wolfScore || (wolfScore === hunterScore && ctx.settings.tieBehaviour === 'hunters')
    const tied = wolfScore === hunterScore && !wolfSideWins && !huntersWin

    if (tied && ctx.settings.tieBehaviour === 'carry') {
      carry = Math.min(carry + 1, Number(ctx.settings.carryCap ?? 4) - 1)
      carriedFromHoles = [...carriedFromHoles, entry.hole]
      headline = `Hole tied — points carry to hole ${entry.hole + 1}`
      outcomes.push({ hole: entry.hole, points, headline, detail })
      continue
    }
    if (tied) {
      headline = 'Hole tied — no points'
      outcomes.push({ hole: entry.hole, points, headline, detail })
      carry = 0
      carriedFromHoles = []
      continue
    }

    if (wolfSideWins) {
      if (lone) {
        points[wolfId] = pts.loneWin
        headline = `${payload.mode === 'blind' ? 'Blind Wolf' : 'Lone Wolf'} ${nameOf(ctx.players, wolfId)} wins · ${signed(pts.loneWin)}`
      } else {
        for (const id of wolfTeam) points[id] = pts.wolfTeamWin
        headline = `${namesOf(ctx.players, wolfTeam)} win · ${signed(pts.wolfTeamWin)} each`
      }
    } else {
      const award = lone ? pts.loneLoss : pts.hunterWin
      for (const id of hunters) points[id] = award
      headline = lone
        ? `${payload.mode === 'blind' ? 'Blind Wolf' : 'Lone Wolf'} beaten · ${signed(award)} to ${namesOf(ctx.players, hunters)}`
        : `${namesOf(ctx.players, hunters)} win · ${signed(award)} each`
    }

    detail.push(
      lone
        ? `${nameOf(ctx.players, wolfId)} ${wolfScore} v field ${hunterScore}`
        : `${namesOf(ctx.players, wolfTeam)} ${wolfScore} v ${namesOf(ctx.players, hunters)} ${hunterScore}`,
    )
    carry = 0
    carriedFromHoles = []
    outcomes.push({ hole: entry.hole, points, headline, detail })
  }

  const totals = sumPoints(outcomes.map((o) => o.points), ctx.players)
  const pointValue = Number(ctx.settings.pointValue ?? 0)
  const rows = ctx.players.map((p) => ({
    playerId: p.id,
    value: tidy(totals[p.id] ?? 0),
    display: signed(tidy(totals[p.id] ?? 0)),
    sub: moneyLabel(totals[p.id] ?? 0, pointValue),
  }))
  const standings = rankRows(rows, true)

  const previousTotals = sumPoints(outcomes.slice(0, -1).map((o) => o.points), ctx.players)
  const previous = rankRows(
    ctx.players.map((p) => ({ playerId: p.id, value: previousTotals[p.id] ?? 0, display: '' })),
    true,
  )

  const nextHoleMultiplier = Math.min(1 + carry, Number(ctx.settings.carryCap ?? 4))
  const status: StatusChip[] = []
  if (nextHoleMultiplier > 1) {
    status.push({ label: 'Carry', value: `${nextHoleMultiplier}× points`, tone: 'accent' })
  }

  return {
    outcomes,
    standings: withMovement(standings, previous),
    status,
    extra: { rotation, carryMultiplier: nextHoleMultiplier },
  }
}

/* --------------------------------------------------------------------- rules */

function explain(s: SettingsValues): RulesDoc {
  const tie = {
    push: 'nothing happens — the hole is a wash',
    carry: 'the points carry over and the next hole is worth double',
    hunters: 'the hunters win it — the Wolf has to win outright',
    wolf: 'the Wolf’s side wins it — a tie is good enough for them',
  }[(s.tieBehaviour as string) ?? 'push']

  return {
    summary:
      'Every hole one player is the Wolf. After watching the others drive, the Wolf either picks a partner for that hole — or plays alone against everybody for a bigger prize.',
    sections: [
      {
        title: 'How a hole runs',
        body: [
          'The Wolf tees off first, then each other player drives in turn.',
          'Straight after a player’s drive the Wolf must either take them as partner, or pass and watch the next player.',
          'Pass on everybody and the Wolf plays the hole alone — Lone Wolf.',
          'Each side plays best ball: only the lower score on the team counts.',
        ],
      },
      {
        title: 'Points',
        body: [
          `Wolf and partner win the hole: ${s.wolfTeamWinPoints} points each.`,
          `The other pair wins: ${s.hunterWinPoints} points each.`,
          `Lone Wolf wins: ${s.loneWolfWinPoints} points.`,
          `Lone Wolf loses: ${s.loneWolfLossPoints} points to each opponent.`,
          `Tied hole: ${tie}.`,
        ],
      },
      ...(s.blindWolf
        ? [
            {
              title: 'Blind Wolf',
              body: [
                'Before anyone hits, the Wolf can declare blind — going alone without seeing a single drive.',
                `Lone Wolf points are multiplied by ${s.blindWolfMultiplier}× when the Wolf goes blind.`,
              ],
            },
          ]
        : []),
      {
        title: 'Rotation',
        body: [
          'Wolf passes to the next player each hole so everyone is Wolf the same number of times.',
          s.finalHoles === 'continue'
            ? 'Holes 17 and 18 simply carry the rotation on.'
            : s.finalHoles === 'trailing'
              ? 'On the left-over holes the player in last place is Wolf.'
              : 'On the left-over holes the leader is Wolf and has to defend.',
        ],
      },
    ],
    example: {
      title: 'Hole 4 · Marc is the Wolf and takes Phil',
      rows: [
        { label: 'Marc', value: '4' },
        { label: 'Phil', value: '5', emphasis: false },
        { label: 'Wolf team best ball', value: '4', emphasis: true },
        { label: 'Mike', value: '5' },
        { label: 'John', value: '6' },
        { label: 'Hunters best ball', value: '5', emphasis: true },
      ],
      result: `Marc and Phil win the hole · +${s.wolfTeamWinPoints} each`,
    },
    variations: [
      { name: 'Blind Wolf', text: 'Declare alone before any drive for multiplied points.', active: !!s.blindWolf },
      { name: 'Carry-over ties', text: 'Tied holes roll their points into the next hole.', active: s.tieBehaviour === 'carry' },
      { name: 'Ties to the field', text: 'The Wolf must win the hole outright.', active: s.tieBehaviour === 'hunters' },
      { name: 'Pig / Lone Wolf doubles', text: 'Some groups double every Lone Wolf hole rather than a fixed score. Set the Lone Wolf points to match.' },
    ],
    definitions: [
      { term: 'Wolf', text: 'The player choosing a partner on that hole. Tees off first.' },
      { term: 'Hunters', text: 'The players not on the Wolf’s team.' },
      { term: 'Lone Wolf', text: 'The Wolf plays the hole alone against everyone else.' },
      { term: 'Blind Wolf', text: 'Going alone before seeing any drive, for higher stakes.' },
    ],
  }
}

/* ---------------------------------------------------------------- final result */

function finalResult(ctx: GameContext, entries: HoleEntry[]): FinalResult {
  const c = compute(ctx, entries)
  const top = c.standings[0]
  const winners = c.standings.filter((r) => r.rank === 1).map((r) => r.playerId)
  const played = completedEntries(entries).length
  const loneWins = completedEntries(entries).filter((e) => {
    const p = (e.game ?? {}) as WolfHolePayload
    return p.mode === 'lone' || p.mode === 'blind'
  }).length
  return {
    headline: winners.length > 1 ? 'Tied at the top' : `${nameOf(ctx.players, top.playerId)} takes it`,
    subhead: `${top.display} points over ${played} holes`,
    winners,
    standings: c.standings,
    lines: [
      `${played} holes played`,
      `${loneWins} Lone Wolf ${loneWins === 1 ? 'hole' : 'holes'}`,
      ...(Number(ctx.settings.pointValue) ? [`Point value ${ctx.settings.pointValue}`] : []),
    ],
  }
}

/* --------------------------------------------------------------------- module */

export const wolfGame: GolfGame = {
  meta: {
    id: 'wolf',
    name: 'Wolf',
    emoji: '🐺',
    tagline: 'Choose your partner or go alone.',
    playersLabel: '3–4 Players',
    minPlayers: 3,
    maxPlayers: 4,
    bestFor: '4 golfers',
    complexity: 3,
    strategy: 5,
    complexityLabel: 'Medium',
    strategyLabel: 'High',
    swing: 'High',
    accent: 'wolf',
  },
  settings: wolfSettings,
  defaultSettings: () => defaultsFrom(wolfSettings),
  validatePlayers: (n) => (n < 3 ? 'Wolf needs at least 3 players.' : n > 4 ? 'Wolf works with 3 or 4 players.' : null),
  createRoundState: (ctx) => ({ rotation: ctx.players.map((p) => p.id) }),
  compute,
  finalResult,
  explain,
  preScoreStage: 'wolfPick',
}
