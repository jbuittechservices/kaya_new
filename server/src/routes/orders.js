import { Router } from 'express'
import { db, uid } from '../db.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { serializeOrder } from '../utils/serialize.js'
import * as bus from '../sockets/bus.js'
import { sendPushToUser, sendPushToActiveDrivers } from '../utils/push.js'

const router = Router()
router.use(requireAuth)

const VEHICLE_PRICES = { bike: 1200, car: 2400, van: 5600 }
const PLATFORM_FEE_PCT = 0.15
const STATUS_FLOW = ['enroute', 'arrived', 'in_transit', 'delivered']

function priceFor(vehicle) {
  return VEHICLE_PRICES[vehicle] ?? VEHICLE_PRICES.bike
}

// Create a delivery request
router.post('/', (req, res) => {
  const { pickup, dropoff, category, vehicle, paymentMethod, note, senderPhone, recipientPhone, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body
  if (!pickup || !dropoff) return res.status(400).json({ error: 'Pickup and dropoff are required' })

  const id = uid('ord')
  const price = priceFor(vehicle)

  if ((paymentMethod === 'online' || paymentMethod === 'wallet') && req.user.wallet_balance < price) {
    return res.status(400).json({ error: 'Your wallet balance is too low for this fare. Top up or choose cash instead.' })
  }

  db.prepare(
    `INSERT INTO orders (id, customer_id, status, pickup, dropoff, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, category, vehicle, price, payment_method, note, sender_phone, recipient_phone)
     VALUES (?, ?, 'searching', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user.id,
    pickup,
    dropoff,
    pickupLat ?? null,
    pickupLng ?? null,
    dropoffLat ?? null,
    dropoffLng ?? null,
    category || 'parcel',
    vehicle || 'bike',
    price,
    paymentMethod || 'cash',
    note || null,
    senderPhone || null,
    recipientPhone || null
  )

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id)
  const payload = serializeOrder(order)

  // Notify every online driver in real time, and push to any driver who has
  // notifications enabled even if their app is closed/backgrounded right now.
  bus.broadcastToOnlineDrivers('order:incoming', payload)
  sendPushToActiveDrivers({
    title: 'New delivery request',
    body: `${pickup} → ${dropoff} · ₦${price.toLocaleString()}`,
    url: '/driver',
    tag: 'order-incoming',
  }).catch((err) => console.error('[push] driver broadcast failed:', err.message))

  res.status(201).json({ order: payload })
})

// List orders (scoped by role)
router.get('/', (req, res) => {
  const { status, search, availableOnly } = req.query

  if (req.user.role === 'driver' && availableOnly === 'true') {
    const rows = db.prepare(`SELECT * FROM orders WHERE status = 'searching' AND rider_id IS NULL ORDER BY created_at DESC LIMIT 20`).all()
    return res.json({ orders: rows.map(serializeOrder) })
  }

  const column = req.user.role === 'driver' ? 'rider_id' : 'customer_id'
  let rows = db.prepare(`SELECT * FROM orders WHERE ${column} = ? ORDER BY created_at DESC`).all(req.user.id)

  if (status && status !== 'all') rows = rows.filter((o) => o.status === status)
  if (search) {
    const q = search.toLowerCase()
    rows = rows.filter((o) => o.id.toLowerCase().includes(q) || o.dropoff.toLowerCase().includes(q) || o.pickup.toLowerCase().includes(q))
  }

  res.json({ orders: rows.map(serializeOrder) })
})

router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (req.user.role !== 'admin' && order.customer_id !== req.user.id && order.rider_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your order' })
  }

  let rider = null
  if (order.rider_id) {
    const r = db.prepare('SELECT id, name, rider_rating, rider_trips, rider_vehicle, rider_plate, phone FROM users WHERE id = ?').get(order.rider_id)
    if (r) rider = { id: r.id, name: r.name, rating: r.rider_rating, trips: r.rider_trips, vehicle: r.rider_vehicle, plate: r.rider_plate, phone: r.phone }
  }

  res.json({ order: serializeOrder(order), rider })
})

// Driver accepts a request
router.post('/:id/accept', requireRole('driver'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.status !== 'searching' || order.rider_id) {
    return res.status(409).json({ error: 'This request has already been taken' })
  }

  db.prepare(`UPDATE orders SET rider_id = ?, status = 'enroute', updated_at = datetime('now') WHERE id = ?`).run(req.user.id, order.id)
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
  const rider = { id: req.user.id, name: req.user.name, rating: req.user.rider_rating, trips: req.user.rider_trips, vehicle: req.user.rider_vehicle, plate: req.user.rider_plate, phone: req.user.phone }
  const customerRow = db.prepare('SELECT id, name, phone FROM users WHERE id = ?').get(order.customer_id)
  const customer = customerRow ? { id: customerRow.id, name: customerRow.name, phone: customerRow.phone } : null

  // Create the chat channel for this trip up front
  const convoId = uid('conv')
  db.prepare('INSERT INTO conversations (id, order_id, customer_id, rider_id) VALUES (?, ?, ?, ?)').run(convoId, order.id, order.customer_id, req.user.id)

  bus.emitToUser(order.customer_id, 'order:update', { order: serializeOrder(updated), rider, conversationId: convoId })
  bus.broadcastToOnlineDrivers('order:taken', { orderId: order.id }, req.user.id)
  sendPushToUser(order.customer_id, {
    title: 'Rider found!',
    body: `${req.user.name} is on the way to pick up your delivery`,
    url: '/app/booking',
    tag: `order-${order.id}`,
  }).catch((err) => console.error('[push] accept notify failed:', err.message))

  res.json({ order: serializeOrder(updated), customer, conversationId: convoId })
})

// Advance status: enroute -> arrived -> in_transit -> delivered
router.post('/:id/advance', requireRole('driver'), (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your delivery' })

  const currentIndex = STATUS_FLOW.indexOf(order.status)
  if (currentIndex === -1 || currentIndex === STATUS_FLOW.length - 1) {
    return res.status(409).json({ error: 'This delivery cannot be advanced further' })
  }
  const nextStatus = STATUS_FLOW[currentIndex + 1]

  db.prepare(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(nextStatus, order.id)

  if (nextStatus === 'delivered') {
    settleOrder(order)
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
  bus.emitToUser(order.customer_id, 'order:update', { order: serializeOrder(updated) })

  const STATUS_PUSH_COPY = {
    arrived: 'Your rider has arrived at the pickup point',
    in_transit: 'Your package is on its way',
    delivered: 'Delivered! Tap to rate your rider',
  }
  if (STATUS_PUSH_COPY[nextStatus]) {
    sendPushToUser(order.customer_id, {
      title: 'Kaya delivery update',
      body: STATUS_PUSH_COPY[nextStatus],
      url: '/app/booking',
      tag: `order-${order.id}`,
    }).catch((err) => console.error('[push] status notify failed:', err.message))
  }

  res.json({ order: serializeOrder(updated) })
})

function settleOrder(order) {
  const platformFee = Math.round(order.price * PLATFORM_FEE_PCT)
  const riderEarning = order.price - platformFee

  if (order.payment_method === 'online' || order.payment_method === 'wallet') {
    // Never drive a wallet negative. If the customer's balance can't cover the full
    // fare (e.g. it changed between booking and delivery), debit what's available and
    // record the rest as a failed/outstanding transaction rather than silently letting
    // the balance go negative — the rider is still paid in full below either way.
    const customer = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(order.customer_id)
    const available = Math.max(0, customer?.wallet_balance ?? 0)
    const amountToDebit = Math.min(order.price, available)
    const shortfall = order.price - amountToDebit

    if (amountToDebit > 0) {
      db.prepare('UPDATE users SET wallet_balance = wallet_balance - ? WHERE id = ?').run(amountToDebit, order.customer_id)
      db.prepare(
        'INSERT INTO transactions (id, user_id, order_id, type, label, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uid('txn'), order.customer_id, order.id, 'debit', `Delivery — ${order.id}`, amountToDebit, 'successful')
    }
    if (shortfall > 0) {
      db.prepare(
        'INSERT INTO transactions (id, user_id, order_id, type, label, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(uid('txn'), order.customer_id, order.id, 'debit', `Outstanding balance — ${order.id} (insufficient funds at delivery)`, shortfall, 'failed')
    }
  } else {
    db.prepare(
      'INSERT INTO transactions (id, user_id, order_id, type, label, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(uid('txn'), order.customer_id, order.id, 'debit', `Cash payment — ${order.id}`, order.price, 'successful')
  }

  if (order.rider_id) {
    db.prepare('UPDATE users SET wallet_balance = wallet_balance + ?, rider_trips = rider_trips + 1 WHERE id = ?').run(riderEarning, order.rider_id)
    db.prepare(
      'INSERT INTO transactions (id, user_id, order_id, type, label, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(uid('txn'), order.rider_id, order.id, 'credit', `Trip earning — ${order.id}`, riderEarning, 'successful')
  }
}

router.post('/:id/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.customer_id !== req.user.id && order.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your order' })
  if (['delivered', 'cancelled'].includes(order.status)) return res.status(409).json({ error: 'This order can no longer be cancelled' })

  db.prepare(`UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(order.id)
  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
  bus.emitToUser(order.customer_id, 'order:update', { order: serializeOrder(updated) })
  if (order.rider_id) bus.emitToUser(order.rider_id, 'order:update', { order: serializeOrder(updated) })
  res.json({ order: serializeOrder(updated) })
})

router.post('/:id/rate', (req, res) => {
  const rating = Number(req.body.rating)
  const comment = typeof req.body.comment === 'string' ? req.body.comment.slice(0, 500) : null

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number between 1 and 5' })
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.customer_id !== req.user.id) return res.status(403).json({ error: 'Not your order' })
  if (order.status !== 'delivered') return res.status(409).json({ error: 'You can only rate a completed delivery' })
  if (order.rating != null) return res.status(409).json({ error: 'You have already rated this delivery' })

  db.prepare('UPDATE orders SET rating = ?, rating_comment = ? WHERE id = ?').run(rating, comment, order.id)

  if (order.rider_id) {
    const rider = db.prepare('SELECT rider_rating, rider_trips FROM users WHERE id = ?').get(order.rider_id)
    const trips = Math.max(rider.rider_trips, 1)
    const newAvg = (rider.rider_rating * (trips - 1) + rating) / trips
    db.prepare('UPDATE users SET rider_rating = ? WHERE id = ?').run(Math.round(newAvg * 10) / 10, order.rider_id)
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id)
  res.json({ order: serializeOrder(updated) })
})

export default router
