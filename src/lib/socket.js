import { io } from 'socket.io-client'
import { getToken, BASE_URL } from './api'

let socket = null

export function connectSocket() {
  const token = getToken()
  if (!token) return null

  if (socket) {
    socket.disconnect()
  }

  socket = io(BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })

  // Socket auth failures (expired/invalid token, or a status check rejecting a
  // suspended account) and explicit suspension notices should react the same way
  // a 401 from a REST call does — a live tab shouldn't just sit there silently
  // still "connected" to nothing useful.
  socket.on('connect_error', (err) => {
    if (err?.message === 'Unauthorized' || err?.message === 'Account suspended') {
      window.dispatchEvent(new CustomEvent('kaya:unauthorized'))
    }
  })
  socket.on('account:suspended', () => {
    window.dispatchEvent(new CustomEvent('kaya:unauthorized'))
  })

  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export function getSocket() {
  return socket
}
