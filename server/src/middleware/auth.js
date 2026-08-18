import { verifyToken } from '../utils/jwt.js'
import { db } from '../db.js'

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Not authenticated' })

  try {
    const payload = verifyToken(token)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
    if (!user) return res.status(401).json({ error: 'Account no longer exists' })
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended', code: 'ACCOUNT_SUSPENDED' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this resource' })
    }
    next()
  }
}
