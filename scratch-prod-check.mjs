/** End-to-end check against the live deployment. Creates and deletes test data. */
const BASE = process.argv[2]
const stamp = Date.now().toString(36)
const jars = new Map()

async function call(who, path, init = {}) {
  const cookie = jars.get(who)
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    redirect: 'manual',
  })
  const setCookie = res.headers.getSetCookie?.() ?? []
  for (const c of setCookie) {
    if (c.startsWith('fairway_session=')) jars.set(who, c.split(';')[0])
  }
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

console.log(`Testing ${BASE}\n`)

// 1. Register two accounts
const marcEmail = `prodcheck-marc-${stamp}@fairway.test`
const philEmail = `prodcheck-phil-${stamp}@fairway.test`

const reg1 = await call('marc', '/auth/register', {
  method: 'POST',
  body: { email: marcEmail, name: 'Marc', password: 'longenough1', handicapIndex: 11.4 },
})
check('register an account', reg1.status === 201, `status ${reg1.status}`)
const marcId = reg1.data?.user?.id

const reg2 = await call('phil', '/auth/register', {
  method: 'POST',
  body: { email: philEmail, name: 'Phil', password: 'longenough1', handicapIndex: 18.2 },
})
check('register a second account', reg2.status === 201, `status ${reg2.status}`)

// 2. Session survives
const me1 = await call('marc', '/auth/me')
check('session works', me1.data?.user?.name === 'Marc', `got ${me1.data?.user?.name}`)
check('handicap stored', me1.data?.user?.handicapIndex === 11.4, `got ${me1.data?.user?.handicapIndex}`)

// 3. Wrong password rejected
const bad = await call('nobody', '/auth/login', {
  method: 'POST',
  body: { email: marcEmail, password: 'wrongpassword' },
})
check('wrong password rejected', bad.status === 401, `status ${bad.status}`)

// 4. Friends
const fr = await call('marc', '/friends', { method: 'POST', body: { email: philEmail } })
check('send friend request', fr.status === 201, `status ${fr.status}`)
const inbox = await call('phil', '/friends')
const reqId = inbox.data?.incoming?.[0]?.id
check('request arrives for the other player', !!reqId)
if (reqId) {
  const acc = await call('phil', '/friends/respond', {
    method: 'POST',
    body: { id: reqId, action: 'accept' },
  })
  check('accept friend request', acc.data?.status === 'accepted')
  const list = await call('marc', '/friends')
  check('friend appears in the list', list.data?.friends?.some((f) => f.name === 'Phil'))
}

// 5. League
const lg = await call('marc', '/leagues', { method: 'POST', body: { name: `Prod Check ${stamp}` } })
check('create a league', lg.status === 201, `status ${lg.status}`)
const code = lg.data?.league?.joinCode
const join = await call('phil', '/leagues/join', { method: 'POST', body: { code } })
check('join with the code', join.status === 200, `code ${code}`)

// 6. Shared round + the score merge
const round = await call('marc', '/rounds', {
  method: 'POST',
  body: {
    gameId: 'skins',
    players: [
      { id: 'a', userId: marcId, name: 'Marc', handicapIndex: 11.4, colorIndex: 0 },
      { id: 'b', userId: null, name: 'Phil', handicapIndex: 18.2, colorIndex: 1 },
    ],
    settings: { skinValue: 1, carryRule: 'carry' },
    course: { id: 'c', name: 'Test', holes: [{ number: 1, par: 4, strokeIndex: 1 }] },
    gameState: {},
    currentHole: 1,
    leagueId: lg.data?.league?.id ?? null,
  },
})
check('create a shared round', round.status === 201, `status ${round.status}`)
const roundId = round.data?.round?.id
const version = round.data?.round?.version

const inv = await call('marc', `/rounds/${roundId}/invite`, {
  method: 'POST',
  body: { email: philEmail },
})
check('invite the other player', inv.data?.status === 'seated', `status ${inv.data?.status}`)

await call('marc', `/rounds/${roundId}/hole`, {
  method: 'PUT',
  body: { hole: 1, scores: { a: 4 } },
})
const merged = await call('phil', `/rounds/${roundId}/hole`, {
  method: 'PUT',
  body: { hole: 1, scores: { b: 5 } },
})
const entry = merged.data?.round?.entries?.find((e) => e.hole === 1)
check(
  'two phones scoring the same hole both survive',
  entry?.scores?.a === 4 && entry?.scores?.b === 5,
  JSON.stringify(entry?.scores),
)

// 7. Cheap poll
const poll = await call('marc', `/rounds/${roundId}?version=${version}`)
check('poll reports a change', poll.data?.changed === true)
const fresh = await call('marc', `/rounds/${roundId}`)
const poll2 = await call('marc', `/rounds/${roundId}?version=${fresh.data?.round?.version}`)
check('poll is cheap when nothing changed', poll2.data?.changed === false && !poll2.data?.round)

// 8. Access control
const outsiderEmail = `prodcheck-out-${stamp}@fairway.test`
await call('out', '/auth/register', {
  method: 'POST',
  body: { email: outsiderEmail, name: 'Outsider', password: 'longenough1' },
})
const denied = await call('out', `/rounds/${roundId}`)
check('strangers are kept out', denied.status === 403, `status ${denied.status}`)

// 9. League history shows the round
const detail = await call('phil', `/leagues/${lg.data?.league?.id}`)
check('round appears in league history', detail.data?.rounds?.some((r) => r.id === roundId))

// 10. Invites feed
const invites = await call('phil', '/invites')
check('invites endpoint responds', invites.status === 200, `status ${invites.status}`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
console.log(`CLEANUP_EMAILS=${[marcEmail, philEmail, outsiderEmail].join(',')}`)
process.exit(failed.length ? 1 : 0)
