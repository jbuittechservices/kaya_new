import { Router } from 'express'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { db, uid, DATA_DIR } from '../db.js'
import { createOtp, verifyOtp, OtpError } from '../utils/otp.js'
import { signToken } from '../utils/jwt.js'
import { serializeUser } from '../utils/serialize.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

const AVATAR_DIR = path.join(DATA_DIR, 'uploads', 'avatars')
fs.mkdirSync(AVATAR_DIR, { recursive: true })
const ALLOWED_AVATAR_MIME = new Set(['image/jpeg', 'image/png', 'image/webp'])

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.join(AVATAR_DIR, req.user.id)
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '') || '.jpg'
      cb(null, `avatar-${Date.now()}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_AVATAR_MIME.has(file.mimetype)) {
      const err = new Error('Only JPEG, PNG, or WebP images are allowed')
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

function handleAvatarUpload(req, res, next) {
  avatarUpload.single('file')(req, res, (err) => {
    if (!err) return next()
    if (err instanceof multer.MulterError || err.status === 400) return res.status(400).json({ error: err.message })
    next(err)
  })
}

function normalizePhone(phone = '') {
  return phone.replace(/[^\d+]/g, '')
}

// ---- Sign up ----
router.post('/signup/request-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone)
  if (!phone) return res.status(400).json({ error: 'Phone number is required' })

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (existing) return res.status(409).json({ error: 'An account with this phone number already exists' })

  try {
    await createOtp(phone, 'signup')
    res.json({ ok: true })
  } catch (err) {
    if (err instanceof OtpError) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Something went wrong sending your code' })
  }
})

router.post('/signup/verify-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const { code } = req.body
  const result = verifyOtp(phone, code, 'signup')
  if (!result.ok) return res.status(400).json({ error: result.reason })
  res.json({ ok: true })
})

router.post('/signup/complete', async (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const { name, email, password, role } = req.body
  if (!phone || !name || !password) return res.status(400).json({ error: 'Missing required fields' })
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (existing) return res.status(409).json({ error: 'An account with this phone number already exists' })

  const passwordHash = await bcrypt.hash(password, 10)
  const id = uid('usr')
  const isDriver = role === 'driver'

  db.prepare(
    `INSERT INTO users (id, name, phone, email, password_hash, role, wallet_balance, rider_vehicle, rider_plate, onboarding_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    phone,
    email || null,
    passwordHash,
    isDriver ? 'driver' : 'customer',
    0,
    isDriver ? 'Bajaj Boxer' : null,
    isDriver ? null : null,
    isDriver ? JSON.stringify({ personalInfo: true, documents: false, guarantor: false }) : null
  )

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  const token = signToken({ sub: id, role: user.role })
  res.status(201).json({ token, user: serializeUser(user) })
})

// ---- Log in ----
router.post('/login', async (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const { password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  if (!user) return res.status(401).json({ error: 'No account found for this phone number' })

  const valid = await bcrypt.compare(password || '', user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Incorrect password' })
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account has been suspended' })

  const token = signToken({ sub: user.id, role: user.role })
  res.json({ token, user: serializeUser(user) })
})

// ---- Password reset ----
router.post('/reset/request-otp', async (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (!user) return res.status(404).json({ error: 'No account found for this phone number' })

  try {
    await createOtp(phone, 'reset')
    res.json({ ok: true })
  } catch (err) {
    if (err instanceof OtpError) return res.status(err.status).json({ error: err.message })
    console.error(err)
    res.status(500).json({ error: 'Something went wrong sending your code' })
  }
})

router.post('/reset/verify-otp', (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const { code } = req.body
  const result = verifyOtp(phone, code, 'reset')
  if (!result.ok) return res.status(400).json({ error: result.reason })

  // Re-issue a single-use confirmation code the client sends back on the final step.
  db.prepare(
    'INSERT INTO otp_codes (id, phone, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uid('otp'), phone, code, 'reset-confirmed', new Date(Date.now() + 10 * 60_000).toISOString())
  res.json({ ok: true })
})

router.post('/reset/complete', async (req, res) => {
  const phone = normalizePhone(req.body.phone)
  const { code, password } = req.body
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })

  const result = verifyOtp(phone, code, 'reset-confirmed')
  if (!result.ok) return res.status(400).json({ error: 'Please verify your code again' })

  const passwordHash = await bcrypt.hash(password, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE phone = ?').run(passwordHash, phone)
  res.json({ ok: true })
})

// ---- Session ----
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) })
})

router.patch('/me', requireAuth, (req, res) => {
  const { name, email, avatarUrl } = req.body
  db.prepare('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url) WHERE id = ?').run(
    name || null,
    email || null,
    avatarUrl || null,
    req.user.id
  )
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.json({ user: serializeUser(user) })
})

router.post('/me/avatar', requireAuth, handleAvatarUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  // Clean up the previous avatar file so re-uploading doesn't accumulate orphaned images
  if (req.user.avatar_url) {
    const oldFilename = path.basename(req.user.avatar_url)
    fs.rm(path.join(AVATAR_DIR, req.user.id, oldFilename), { force: true }, () => {})
  }

  const avatarUrl = `/uploads/avatars/${req.user.id}/${req.file.filename}`
  db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)
  res.status(201).json({ user: serializeUser(user) })
})

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' })
  const valid = await bcrypt.compare(currentPassword || '', req.user.password_hash)
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' })
  const hash = await bcrypt.hash(newPassword, 10)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id)
  res.json({ ok: true })
})

export default router
