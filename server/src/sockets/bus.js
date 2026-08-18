let io = null
const onlineDrivers = new Map() // userId -> socketId

export function setIO(instance) {
  io = instance
}

export function markDriverOnline(userId, socketId) {
  onlineDrivers.set(userId, socketId)
}

export function markDriverOffline(userId) {
  onlineDrivers.delete(userId)
}

export function isDriverOnline(userId) {
  return onlineDrivers.has(userId)
}

export function emitToUser(userId, event, payload) {
  if (!io) return
  io.to(`user:${userId}`).emit(event, payload)
}

export function broadcastToOnlineDrivers(event, payload, excludeUserId) {
  if (!io) return
  for (const [userId, socketId] of onlineDrivers.entries()) {
    if (userId === excludeUserId) continue
    io.to(socketId).emit(event, payload)
  }
}

export function onlineDriverIds() {
  return [...onlineDrivers.keys()]
}

// The REST API re-checks account status on every request, but a WebSocket connection
// that was already open when an account got suspended would otherwise keep receiving
// live events (new delivery broadcasts, chat messages) until it happens to drop on its
// own. Call this from wherever an account is suspended to close that gap immediately.
export function disconnectUser(userId) {
  markDriverOffline(userId)
  if (!io) return
  io.in(`user:${userId}`).disconnectSockets(true)
}
