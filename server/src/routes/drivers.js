import { Router } from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { db, uid, DATA_DIR } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { serializeUser } from '../utils/serialize.js'

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads', 'drivers')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const ALLOWED_DOC_TYPES = ['id', 'license']
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(UPLOADS_DIR, req.user.id)
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const type = ALLOWED_DOC_TYPES.includes(req.body.type) ? req.body.type : 'doc'
      const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '')
      cb(null, `${type}-${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_DOC_TYPES.includes(req.body.type)) {
      const err = new Error('Invalid document type')
      err.status = 400
      return cb(err)
    }
    if (!ALLOWED_MIME.has(file.mimetype)) {
      const err = new Error('Only JPEG, PNG, WebP, or PDF files are allowed')
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

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

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError || err.status === 400) {
      return res.status(400).json({ error: err.message })
    }
    next(err)
  })
}

router.post('/documents', handleUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })
  const type = req.body.type

  const current = req.user.documents_json ? JSON.parse(req.user.documents_json) : {}
  // Remove any previous file for this document type so we don't accumulate orphans on re-upload
  if (current[type]?.filename) {
    const oldPath = path.join(UPLOADS_DIR, req.user.id, current[type].filename)
    fs.rm(oldPath, { force: true }, () => {})
  }
  current[type] = { filename: req.file.filename, mimeType: req.file.mimetype, uploadedAt: new Date().toISOString() }
  db.prepare('UPDATE users SET documents_json = ? WHERE id = ?').run(JSON.stringify(current), req.user.id)

  res.status(201).json({ documents: current })
})

router.get('/documents', (req, res) => {
  const documents = req.user.documents_json ? JSON.parse(req.user.documents_json) : {}
  res.json({ documents })
})

// Serves a driver's own uploaded document. Admin access to any driver's documents is a
// separate route in admin.js with its own admin-role check — this one only ever serves
// the requesting driver's own file.
router.get('/documents/:type/file', (req, res) => {
  const documents = req.user.documents_json ? JSON.parse(req.user.documents_json) : {}
  const doc = documents[req.params.type]
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  const filePath = path.join(UPLOADS_DIR, req.user.id, doc.filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Document not found' })
  res.setHeader('Content-Type', doc.mimeType)
  res.sendFile(filePath)
})

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

const VALID_VEHICLE_TYPES = ['bike', 'car', 'van']

router.patch('/vehicle', (req, res) => {
  const { vehicle, plate, vehicleType } = req.body
  if (vehicleType !== undefined && !VALID_VEHICLE_TYPES.includes(vehicleType)) {
    return res.status(400).json({ error: 'Vehicle type must be one of: bike, car, van' })
  }
  db.prepare(
    'UPDATE users SET rider_vehicle = COALESCE(?, rider_vehicle), rider_plate = COALESCE(?, rider_plate), vehicle_type = COALESCE(?, vehicle_type) WHERE id = ?'
  ).run(vehicle || null, plate || null, vehicleType || null, req.user.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json({ user: serializeUser(user) })
})

router.patch('/guarantor', (req, res) => {
  const { name, phone, relationship, address } = req.body
  db.prepare(
    'UPDATE users SET guarantor_name = COALESCE(?, guarantor_name), guarantor_phone = COALESCE(?, guarantor_phone), guarantor_relationship = COALESCE(?, guarantor_relationship), guarantor_address = COALESCE(?, guarantor_address) WHERE id = ?'
  ).run(name || null, phone || null, relationship || null, address || null, req.user.id)
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
