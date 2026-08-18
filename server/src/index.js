import 'dotenv/config'
import express from 'express'
import http from 'node:http'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'

import { checkEnv } from './utils/checkEnv.js'
import authRoutes from './routes/auth.js'
import locationRoutes from './routes/locations.js'
import orderRoutes from './routes/orders.js'
import walletRoutes from './routes/wallet.js'
import messageRoutes from './routes/messages.js'
import driverRoutes from './routes/drivers.js'
import adminRoutes from './routes/admin.js'
import webhookRoutes from './routes/webhooks.js'
import { initSockets } from './sockets/index.js'

const app = express()
const server = http.createServer(app)

checkEnv()

const PORT = process.env.PORT || 4000
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({ origin: CORS_ORIGIN.split(','), credentials: true }))
app.use(compression())
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

// Webhooks need the raw body for signature verification, so mount before express.json()
app.use('/api/webhooks', express.raw({ type: '*/*' }), webhookRoutes)

app.use(express.json({ limit: '2mb' }))

const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false })
app.use('/api/auth', authLimiter, authRoutes)

// General ceiling on everything else so no single client can hammer the API
const apiLimiter = rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false })
app.use('/api', apiLimiter)

app.use('/api/locations', locationRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/wallet', walletRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/admin', adminRoutes)

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }))

// Unknown API route
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// Central error handler
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong' })
})

initSockets(server, CORS_ORIGIN.split(','))

server.listen(PORT, () => {
  console.log(`🚚 Kaya API listening on http://localhost:${PORT}`)
})
