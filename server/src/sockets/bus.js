let io = null
const onlineDrivers = new Map() // userId -> { socketId, vehicleType }

export function setIO(instance) {
  io = instance
}

export function markDriverOnline(userId, socketId, vehicleType) {
  onlineDrivers.set(userId, { socketId, vehicleType })
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

// When vehicleType is provided, only online drivers whose own vehicle type matches
// receive the event — used so a bike rider never gets pinged for a van-only delivery
// they have no way to actually fulfill.
export function broadcastToOnlineDrivers(event, payload, excludeUserId, vehicleType) {
  if (!io) return
  for (const [userId, driver] of onlineDrivers.entries()) {
    if (userId === excludeUserId) continue
    if (vehicleType && driver.vehicleType !== vehicleType) continue
    io.to(driver.socketId).emit(event, payload)
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
