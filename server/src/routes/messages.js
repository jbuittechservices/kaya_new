import { Router } from 'express'
import { db, uid } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { serializeMessage } from '../utils/serialize.js'
import * as bus from '../sockets/bus.js'
import { sendPushToUser } from '../utils/push.js'

const router = Router()
router.use(requireAuth)

function readColumnFor(role) {
  return role === 'driver' ? 'rider_last_read_at' : 'customer_last_read_at'
}

function unreadCountFor(conversationId, viewerId, lastReadAt) {
  const row = lastReadAt
    ? db.prepare('SELECT COUNT(*) n FROM messages WHERE conversation_id = ? AND sender_id != ? AND created_at > ?').get(conversationId, viewerId, lastReadAt)
    : db.prepare('SELECT COUNT(*) n FROM messages WHERE conversation_id = ? AND sender_id != ?').get(conversationId, viewerId)
  return row.n
}

router.get('/', (req, res) => {
  const column = req.user.role === 'driver' ? 'rider_id' : 'customer_id'
  const otherColumn = req.user.role === 'driver' ? 'customer_id' : 'rider_id'
  const readColumn = readColumnFor(req.user.role)

  const rows = db
    .prepare(`SELECT * FROM conversations WHERE ${column} = ? ORDER BY created_at DESC`)
    .all(req.user.id)

  const conversations = rows.map((c) => {
    const other = db.prepare('SELECT id, name, phone, rider_rating, rider_vehicle, avatar_url FROM users WHERE id = ?').get(c[otherColumn])
    const last = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1').get(c.id)
    return {
      id: c.id,
      orderId: c.order_id,
      participant: other ? { id: other.id, name: other.name, phone: other.phone, rating: other.rider_rating, vehicle: other.rider_vehicle, avatarUrl: other.avatar_url } : null,
      lastMessage: last?.text || null,
      lastMessageAt: last?.created_at || c.created_at,
      unreadCount: unreadCountFor(c.id, req.user.id, c[readColumn]),
    }
  })

  res.json({ conversations })
})

// Lightweight total across every conversation — what the nav badge actually needs,
// without pulling full conversation/participant data just to show a number.
router.get('/unread-count', (req, res) => {
  const column = req.user.role === 'driver' ? 'rider_id' : 'customer_id'
  const readColumn = readColumnFor(req.user.role)
  const rows = db.prepare(`SELECT id, ${readColumn} as lastReadAt FROM conversations WHERE ${column} = ?`).all(req.user.id)
  const total = rows.reduce((sum, c) => sum + unreadCountFor(c.id, req.user.id, c.lastReadAt), 0)
  res.json({ unreadCount: total })
})

router.get('/:id/messages', (req, res) => {
  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id)
  if (!convo) return res.status(404).json({ error: 'Conversation not found' })
  if (convo.customer_id !== req.user.id && convo.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your conversation' })

  const rows = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(req.params.id)
  res.json({ messages: rows.map(serializeMessage) })
})

router.post('/:id/messages', (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ error: 'Message cannot be empty' })
  if (text.length > 2000) return res.status(400).json({ error: 'Message is too long (2000 characters max)' })

  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id)
  if (!convo) return res.status(404).json({ error: 'Conversation not found' })
  if (convo.customer_id !== req.user.id && convo.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your conversation' })

  const id = uid('msg')
  db.prepare('INSERT INTO messages (id, conversation_id, sender_id, text) VALUES (?, ?, ?, ?)').run(id, convo.id, req.user.id, text.trim())
  const message = serializeMessage(db.prepare('SELECT * FROM messages WHERE id = ?').get(id))

  // Sending a message also counts as having read up to this point on your own side —
  // otherwise your own message would immediately count as "unread" for you.
  db.prepare(`UPDATE conversations SET ${readColumnFor(req.user.role)} = datetime('now') WHERE id = ?`).run(convo.id)

  const recipientId = convo.customer_id === req.user.id ? convo.rider_id : convo.customer_id
  bus.emitToUser(recipientId, 'message:new', { conversationId: convo.id, message })
  sendPushToUser(recipientId, {
    title: req.user.name,
    body: text.trim().slice(0, 120),
    url: req.user.role === 'driver' ? `/app/messages/${convo.id}` : `/driver/messages/${convo.id}`,
    tag: `chat-${convo.id}`,
  }).catch((err) => console.error('[push] message notify failed:', err.message))

  res.status(201).json({ message })
})

// Marks everything in a conversation as read up to now, for whichever side calls this.
router.post('/:id/read', (req, res) => {
  const convo = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id)
  if (!convo) return res.status(404).json({ error: 'Conversation not found' })
  if (convo.customer_id !== req.user.id && convo.rider_id !== req.user.id) return res.status(403).json({ error: 'Not your conversation' })

  db.prepare(`UPDATE conversations SET ${readColumnFor(req.user.role)} = datetime('now') WHERE id = ?`).run(convo.id)
  res.json({ ok: true })
})

export default router
