import { Router } from 'express'
import crypto from 'node:crypto'
import { db } from '../db.js'

const router = Router()

// Mounted with express.raw() in index.js so we can verify the exact byte signature Paystack sent.
router.post('/paystack', (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return res.status(200).end() // webhooks are a no-op until live keys are configured

  const signature = req.headers['x-paystack-signature']
  const expected = crypto.createHmac('sha512', secret).update(req.body).digest('hex')
  const signaturesMatch =
    typeof signature === 'string' &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!signaturesMatch) return res.status(401).end()

  let event
  try {
    event = JSON.parse(req.body.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Malformed payload' })
  }

  if (event.event === 'charge.success') {
    const { reference } = event.data
    const txn = db.prepare('SELECT * FROM transactions WHERE reference = ?').get(reference)
    if (txn && txn.status === 'pending') {
      db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(txn.amount, txn.user_id)
      db.prepare(`UPDATE transactions SET status = 'successful' WHERE id = ?`).run(txn.id)
    }
  }

  res.status(200).end()
})

export default router
