import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { pushConfigured, saveSubscription, removeSubscription } from '../utils/push.js'

const router = Router()

// Public — the frontend needs this to construct a subscription, it's not a secret.
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: pushConfigured ? process.env.VAPID_PUBLIC_KEY : null })
})

router.use(requireAuth)

router.post('/subscribe', (req, res) => {
  if (!pushConfigured) return res.status(503).json({ error: 'Push notifications are not configured on this server' })
  try {
    saveSubscription(req.user.id, req.body)
    res.status(201).json({ ok: true })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/unsubscribe', (req, res) => {
  const { endpoint } = req.body
  if (endpoint) removeSubscription(endpoint)
  res.json({ ok: true })
})

export default router
