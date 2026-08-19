import { Router } from 'express'
import path from 'node:path'
import fs from 'node:fs'
import { db, DATA_DIR } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { serializeUser, serializeOrder, serializeTransaction } from '../utils/serialize.js'
import * as bus from '../sockets/bus.js'
import { sendPushToUser } from '../utils/push.js'

const router = Router()
router.use(requireAuth, requireRole('admin'))

// Every list endpoint below queries and paginates at the SQL level (never "load
// the whole table into a JS array and .filter()/.slice() it") so these stay fast
// and bounded in memory regardless of how large the tables grow. pageSize is
// clamped so a client can't force the server to return/scan an unbounded number
// of rows in one request.
function parsePagination(query, defaultPageSize = 20, maxPageSize = 100) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const pageSize = Math.min(maxPageSize, Math.max(1, parseInt(query.pageSize, 10) || defaultPageSize))
  return { page, pageSize, offset: (page - 1) * pageSize }
}

router.get('/stats', (req, res) => {
  const users = db.prepare(`SELECT COUNT(*) n FROM users WHERE role = 'customer'`).get().n
  const drivers = db.prepare(`SELECT COUNT(*) n FROM users WHERE role = 'driver'`).get().n
  const activeDrivers = db.prepare(`SELECT COUNT(*) n FROM users WHERE role = 'driver' AND status = 'active'`).get().n
  const totalOrders = db.prepare('SELECT COUNT(*) n FROM orders').get().n
  // 'completed' = customer confirmed and payment settled. 'delivered' means the driver
  // dropped it off but the customer hasn't confirmed yet, so it's still active, not final.
  const deliveredOrders = db.prepare(`SELECT COUNT(*) n FROM orders WHERE status = 'completed'`).get().n
  const activeOrders = db.prepare(`SELECT COUNT(*) n FROM orders WHERE status NOT IN ('completed','cancelled')`).get().n
  const cancelledOrders = db.prepare(`SELECT COUNT(*) n FROM orders WHERE status = 'cancelled'`).get().n
  const gmv = db.prepare(`SELECT COALESCE(SUM(price),0) n FROM orders WHERE status = 'completed'`).get().n
  const platformRevenue = Math.round(gmv * 0.15)

  const last7 = db
    .prepare(
      `SELECT date(created_at) as day, COUNT(*) as orders, COALESCE(SUM(CASE WHEN status='completed' THEN price ELSE 0 END),0) as revenue
       FROM orders WHERE created_at >= datetime('now', '-7 days') GROUP BY day ORDER BY day ASC`
    )
    .all()

  res.json({
    users,
    drivers,
    activeDrivers,
    totalOrders,
    deliveredOrders,
    activeOrders,
    cancelledOrders,
    gmv,
    platformRevenue,
    last7,
  })
})

router.get('/users', (req, res) => {
  const { role, status, search } = req.query
  const { page, pageSize, offset } = parsePagination(req.query)

  const conditions = []
  const params = []
  if (role && role !== 'all') {
    conditions.push('role = ?')
    params.push(role)
  }
  if (status && status !== 'all') {
    conditions.push('status = ?')
    params.push(status)
  }
  if (search) {
    const like = `%${search.toLowerCase()}%`
    conditions.push('(LOWER(name) LIKE ? OR phone LIKE ? OR LOWER(COALESCE(email, \'\')) LIKE ?)')
    params.push(like, `%${search}%`, like)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = db.prepare(`SELECT COUNT(*) n FROM users ${where}`).get(...params).n
  const rows = db.prepare(`SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset)

  res.json({ users: rows.map(serializeUser), total, page, pageSize })
})

router.get('/users/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user) return res.status(404).json({ error: 'User not found' })
  const orders = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? OR rider_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(user.id, user.id)
  res.json({ user: serializeUser(user), orders: orders.map(serializeOrder) })
})

router.patch('/users/:id/status', (req, res) => {
  const { status } = req.body
  if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status' })
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, req.params.id)
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (status === 'suspended') {
    bus.emitToUser(req.params.id, 'account:suspended', {})
    bus.disconnectUser(req.params.id)
  }
  res.json({ user: serializeUser(user) })
})

router.get('/users/:id/documents', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user || user.role !== 'driver') return res.status(404).json({ error: 'Driver not found' })
  const documents = user.documents_json ? JSON.parse(user.documents_json) : {}
  res.json({ documents })
})

router.get('/users/:id/documents/:type/file', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user || user.role !== 'driver') return res.status(404).json({ error: 'Driver not found' })
  const documents = user.documents_json ? JSON.parse(user.documents_json) : {}
  const doc = documents[req.params.type]
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  const filePath = path.join(DATA_DIR, 'uploads', 'drivers', user.id, doc.filename)
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Document not found' })
  res.setHeader('Content-Type', doc.mimeType)
  res.sendFile(filePath)
})

router.patch('/users/:id/verify-driver', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id)
  if (!user || user.role !== 'driver') return res.status(404).json({ error: 'Driver not found' })
  const onboarding = { personalInfo: true, documents: true, guarantor: true }
  db.prepare('UPDATE users SET onboarding_json = ? WHERE id = ?').run(JSON.stringify(onboarding), user.id)
  sendPushToUser(user.id, {
    title: "You're verified!",
    body: "Your Kaya rider account has been approved — you can now go online and start earning.",
    url: '/driver',
    tag: 'driver-verified',
  }).catch((err) => console.error('[push] verification notify failed:', err.message))
  res.json({ ok: true })
})

router.get('/orders', (req, res) => {
  const { status, search } = req.query
  const { page, pageSize, offset } = parsePagination(req.query)

  const conditions = []
  const params = []
  if (status && status !== 'all') {
    conditions.push('status = ?')
    params.push(status)
  }
  if (search) {
    const like = `%${search.toLowerCase()}%`
    conditions.push('(LOWER(id) LIKE ? OR LOWER(dropoff) LIKE ?)')
    params.push(like, like)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total = db.prepare(`SELECT COUNT(*) n FROM orders ${where}`).get(...params).n
  const rows = db.prepare(`SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, pageSize, offset)

  const paged = rows.map((o) => {
    const customer = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(o.customer_id)
    const rider = o.rider_id ? db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(o.rider_id) : null
    return { ...serializeOrder(o), customer, rider }
  })

  res.json({ orders: paged, total, page, pageSize })
})

router.get('/transactions', (req, res) => {
  const { page, pageSize, offset } = parsePagination(req.query, 30)

  const total = db.prepare('SELECT COUNT(*) n FROM transactions').get().n
  const rows = db.prepare('SELECT * FROM transactions ORDER BY created_at DESC LIMIT ? OFFSET ?').all(pageSize, offset)
  const paged = rows.map((t) => {
    const user = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(t.user_id)
    return { ...serializeTransaction(t), user }
  })

  res.json({ transactions: paged, total, page, pageSize })
})

export default router
