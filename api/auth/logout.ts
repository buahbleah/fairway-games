import { handler, json } from '../_lib/http.js'
import { destroySession } from '../_lib/auth.js'

export default handler(['POST'], async (req, res) => {
  await destroySession(req, res)
  json(res, 200, { ok: true })
})
