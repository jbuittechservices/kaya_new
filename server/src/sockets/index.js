import { Server } from 'socket.io'
import { verifyToken } from '../utils/jwt.js'
import { db } from '../db.js'
import * as bus from './bus.js'
import { isDriverVerified } from '../utils/driverVerification.js'

export function initSockets(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigin, credentials: true },
  })

  bus.setIO(io)

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('Unauthorized'))
      const payload = verifyToken(token)
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub)
      if (!user) return next(new Error('Unauthorized'))
      if (user.status === 'suspended') return next(new Error('Account suspended'))
      socket.user = { id: user.id, role: user.role }
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const { id, role } = socket.user
    socket.join(`user:${id}`)
    if (role === 'admin') socket.join('admins')

    if (role === 'driver') {
      socket.on('driver:online', () => {
        // Re-fetch fresh — the user row cached at connect time could be stale if they
        // were verified or suspended after this socket connection was established.
        const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
        if (!current || !isDriverVerified(current)) {
          socket.emit('driver:not-verified')
          return
        }
        if (!current.vehicle_type) {
          socket.emit('driver:no-vehicle-type')
          return
        }
        bus.markDriverOnline(id, socket.id, current.vehicle_type)
      })
      socket.on('driver:offline', () => bus.markDriverOffline(id))
      socket.on('disconnect', () => bus.markDriverOffline(id))

      // Relay the driver's real device location to the customer on their active order.
      socket.on('driver:location', ({ orderId, lat, lng }) => {
        if (!orderId || lat == null || lng == null) return
        const order = db.prepare('SELECT customer_id, rider_id FROM orders WHERE id = ?').get(orderId)
        if (!order || order.rider_id !== id) return
        bus.emitToUser(order.customer_id, 'order:location', { orderId, lat, lng })
      })
    }

    socket.on('chat:typing', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('chat:typing', { conversationId, userId: id })
    })

    socket.on('conversation:join', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`)
    })
  })

  return io
}
