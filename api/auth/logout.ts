import { handler, json } from '../_lib/http'
import { destroySession } from '../_lib/auth'

export default handler(['POST'], async (req, res) => {
  await destroySession(req, res)
  json(res, 200, { ok: true })
})
