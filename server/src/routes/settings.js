import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getPricing, setPricing } from '../utils/pricing.js'

const router = Router()
router.use(requireAuth)

// Any authenticated user can read current prices — needed by the booking screen
router.get('/pricing', (req, res) => {
  res.json({ pricing: getPricing() })
})

router.patch('/pricing', requireRole('admin'), (req, res) => {
  try {
    const pricing = setPricing(req.body)
    res.json({ pricing })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

export default router
