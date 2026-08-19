import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { getToken, BASE_URL } from './api'

let socket = null
const readyListeners = new Set()

function notifyReady() {
  for (const fn of readyListeners) fn(socket)
}

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

  notifyReady()
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  notifyReady()
}

export function getSocket() {
  return socket
}

/**
 * React hook that returns the current socket instance and re-renders the caller
 * once it becomes available.
 *
 * The problem this solves: connecting the socket happens *after* an async session-restore
 * network call in AuthContext, but other parts of the app (order tracking, chat, driver
 * dispatch) mount and try to attach their real-time listeners immediately — almost always
 * before that connection exists yet. A plain `getSocket()` call in a mount effect with a
 * stable dependency array just silently returns null and never tries again, so those
 * listeners never attach for the rest of the session. This hook fixes that by turning "is
 * the socket ready" into real React state, so effects that depend on it correctly re-run
 * the moment it becomes available — and again on every reconnect after a network drop.
 */
export function useSocket() {
  const [current, setCurrent] = useState(socket)

  useEffect(() => {
    setCurrent(socket) // in case it connected between render and this effect running
    const listener = (s) => setCurrent(s)
    readyListeners.add(listener)
    return () => readyListeners.delete(listener)
  }, [])

  return current
}
