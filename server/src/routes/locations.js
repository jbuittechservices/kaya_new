import { Router } from 'express'
import { db, uid } from '../db.js'
import { requireAuth } from '../middleware/auth.js'
import { serializeLocation } from '../utils/serialize.js'

const router = Router()
router.use(requireAuth)

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM saved_locations WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id)
  res.json({ locations: rows.map(serializeLocation) })
})

router.post('/', (req, res) => {
  const { label, address, icon, lat, lng } = req.body
  if (!label || !address) return res.status(400).json({ error: 'Label and address are required' })
  const id = uid('loc')
  db.prepare('INSERT INTO saved_locations (id, user_id, label, address, icon, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id,
    req.user.id,
    label,
    address,
    icon || 'map-pin',
    lat ?? null,
    lng ?? null
  )
  const row = db.prepare('SELECT * FROM saved_locations WHERE id = ?').get(id)
  res.status(201).json({ location: serializeLocation(row) })
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM saved_locations WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

export default router
