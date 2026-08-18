import { Router } from 'express'
import { db, uid } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { serializeTransaction } from '../utils/serialize.js'

const router = Router()
router.use(requireAuth)

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id)
  res.json({ balance: req.user.wallet_balance, transactions: rows.map(serializeTransaction) })
})

// Step 1: start a top-up. Returns a Paystack checkout URL when PAYSTACK_SECRET_KEY is configured;
// otherwise credits the wallet immediately so the flow is testable without live keys.
router.post('/topup/initialize', async (req, res) => {
  const amount = Number(req.body.amount)
  if (!amount || amount < 100 || amount > 1_000_000) {
    return res.status(400).json({ error: 'Enter an amount between ₦100 and ₦1,000,000' })
  }

  const reference = uid('kaya_topup')

  if (!PAYSTACK_SECRET) {
    creditWallet(req.user.id, amount, reference, 'Wallet top-up (simulated — add PAYSTACK_SECRET_KEY for live payments)')
    return res.json({ simulated: true, reference, balance: getBalance(req.user.id) })
  }

  try {
    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: req.user.email || `${req.user.phone}@kaya.app`,
        amount: Math.round(amount * 100), // kobo
        reference,
        metadata: { userId: req.user.id, purpose: 'wallet_topup' },
        callback_url: process.env.PAYSTACK_CALLBACK_URL,
      }),
    })
    const data = await resp.json()
    if (!data.status) return res.status(502).json({ error: data.message || 'Could not start payment' })

    db.prepare(
      'INSERT INTO transactions (id, user_id, type, label, amount, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(uid('txn'), req.user.id, 'credit', 'Wallet top-up — Card', amount, reference, 'pending')

    res.json({ simulated: false, authorizationUrl: data.data.authorization_url, reference })
  } catch (err) {
    console.error('[paystack] initialize failed:', err.message)
    res.status(502).json({ error: 'Payment provider is unreachable right now' })
  }
})

// Step 2: client redirects back here (or the webhook below fires) — verify & credit.
router.get('/topup/verify/:reference', async (req, res) => {
  const { reference } = req.params

  if (!PAYSTACK_SECRET) {
    return res.json({ status: 'success', balance: getBalance(req.user.id) })
  }

  try {
    const resp = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
    })
    const data = await resp.json()
    const txn = db.prepare('SELECT * FROM transactions WHERE reference = ?').get(reference)

    if (data.status && data.data.status === 'success' && txn && txn.status === 'pending') {
      db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(txn.amount, txn.user_id)
      db.prepare(`UPDATE transactions SET status = 'successful' WHERE id = ?`).run(txn.id)
    }

    res.json({ status: data.data?.status || 'failed', balance: getBalance(req.user.id) })
  } catch (err) {
    console.error('[paystack] verify failed:', err.message)
    res.status(502).json({ error: 'Could not verify payment' })
  }
})

function creditWallet(userId, amount, reference, label) {
  db.prepare('UPDATE users SET wallet_balance = wallet_balance + ? WHERE id = ?').run(amount, userId)
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, label, amount, reference, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(uid('txn'), userId, 'credit', label, amount, reference, 'successful')
}

function getBalance(userId) {
  return db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(userId).wallet_balance
}

export default router
