import { Router } from 'express'
import { db, uid } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { serializeUser } from '../utils/serialize.js'

const router = Router()
router.use(requireAuth, requireRole('driver'))

router.get('/me', (req, res) => {
  res.json({ user: serializeUser(req.user) })
})

// Only 'personalInfo' is self-attested by the driver. 'documents' and 'guarantor'
// represent an admin having actually reviewed and approved submitted material —
// letting a driver set those themselves would mean anyone could mark themselves
// "verified" with zero real vetting. Those two can only change via
// PATCH /api/admin/users/:id/verify-driver.
const SELF_SERVICE_ONBOARDING_FIELDS = ['personalInfo']

router.patch('/onboarding', (req, res) => {
  const current = req.user.onboarding_json ? JSON.parse(req.user.onboarding_json) : {}
  const patch = {}
  for (const key of SELF_SERVICE_ONBOARDING_FIELDS) {
    if (key in req.body) patch[key] = !!req.body[key]
  }
  const next = { ...current, ...patch }
  db.prepare('UPDATE users SET onboarding_json = ? WHERE id = ?').run(JSON.stringify(next), req.user.id)
  res.json({ onboarding: next })
})

router.patch('/vehicle', (req, res) => {
  const { vehicle, plate } = req.body
  db.prepare('UPDATE users SET rider_vehicle = COALESCE(?, rider_vehicle), rider_plate = COALESCE(?, rider_plate) WHERE id = ?').run(
    vehicle || null,
    plate || null,
    req.user.id
  )
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json({ user: serializeUser(user) })
})

router.patch('/bank-details', (req, res) => {
  const { bankName, bankAccountNumber, bankAccountName } = req.body
  db.prepare(
    'UPDATE users SET bank_name = COALESCE(?, bank_name), bank_account_number = COALESCE(?, bank_account_number), bank_account_name = COALESCE(?, bank_account_name) WHERE id = ?'
  ).run(bankName || null, bankAccountNumber || null, bankAccountName || null, req.user.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json({ user: serializeUser(user) })
})

// Request a payout from wallet balance to the rider's registered bank account.
// Debits the wallet immediately and logs a 'pending' transaction for the admin/finance
// team to action — wire this up to Paystack Transfers (or your disbursement provider of
// choice) to complete the payout automatically instead of processing it by hand.
router.post('/withdraw', (req, res) => {
  const amount = Number(req.body.amount)
  if (!amount || amount < 500) return res.status(400).json({ error: 'Minimum withdrawal is ₦500' })
  if (amount > req.user.wallet_balance) return res.status(400).json({ error: 'Insufficient wallet balance' })
  if (!req.user.bank_account_number) return res.status(400).json({ error: 'Add your bank details before requesting a withdrawal' })

  db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(amount, req.user.id)
  const id = uid('txn')
  db.prepare(
    'INSERT INTO transactions (id, user_id, type, label, amount, status) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user.id, 'debit', `Withdrawal to ${req.user.bank_name || 'bank'} •••• ${req.user.bank_account_number.slice(-4)}`, amount, 'pending')

  res.json({ ok: true, walletBalance: req.user.wallet_balance - amount })
})

router.get('/earnings', (req, res) => {
  const today = new Date().toISOString().slice(0, 10)
  const todayRows = db
    .prepare(`SELECT * FROM transactions WHERE user_id = ? AND type = 'credit' AND date(created_at) = ?`)
    .all(req.user.id, today)
  const todayTotal = todayRows.reduce((sum, t) => sum + t.amount, 0)

  const tripsToday = db
    .prepare(`SELECT COUNT(*) as n FROM orders WHERE rider_id = ? AND status = 'delivered' AND date(updated_at) = ?`)
    .get(req.user.id, today)

  res.json({ todayEarnings: todayTotal, tripsToday: tripsToday.n, walletBalance: req.user.wallet_balance })
})

export default router
