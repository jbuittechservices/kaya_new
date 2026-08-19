import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { useSocket } from '../lib/socket'
import { useAuth } from './AuthContext'

const AppDataContext = createContext(null)

export function AppDataProvider({ children }) {
  const { isAuthenticated, user } = useAuth()

  const [orders, setOrders] = useState([])
  const [transactions, setTransactions] = useState([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [conversations, setConversations] = useState([])
  const [savedLocations, setSavedLocations] = useState([])
  const [draft, setDraft] = useState(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  // A plain ref (not state) so it's checked/set synchronously and can't be raced by
  // two rapid taps that both fire before React re-renders and disables the button.
  const orderRequestInFlightRef = useRef(false)

  const refreshOrders = useCallback(async (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    const { orders } = await api.get(`/api/orders${qs ? `?${qs}` : ''}`)
    setOrders(orders)
    return orders
  }, [])

  const refreshWallet = useCallback(async () => {
    const { balance, transactions } = await api.get('/api/wallet')
    setWalletBalance(balance)
    setTransactions(transactions)
  }, [])

  const refreshConversations = useCallback(async () => {
    const { conversations } = await api.get('/api/messages')
    setConversations(conversations)
  }, [])

  const refreshLocations = useCallback(async () => {
    const { locations } = await api.get('/api/locations')
    setSavedLocations(locations)
  }, [])

  // 'delivered' is included here too — the driver marked it dropped off, but the
  // customer still needs the live screen to confirm delivery and pay, so it's not done yet.
  const ACTIVE_STATUSES = ['searching', 'enroute', 'arrived', 'in_transit', 'delivered']

  const [reconciledOrderId, setReconciledOrderId] = useState(null)

  const resumeTracking = useCallback(async (orderId) => {
    const { order, rider } = await api.get(`/api/orders/${orderId}`)
    const { conversations: convos } = await api.get('/api/messages').catch(() => ({ conversations: [] }))
    const conversationId = convos.find((c) => c.orderId === order.id)?.id

    setDraft({
      phase: order.status === 'searching' ? 'searching' : order.status,
      orderId: order.id,
      order,
      rider,
      conversationId,
      pickup: order.pickup,
      dropoff: order.dropoff,
      pickupLat: order.pickupLat,
      pickupLng: order.pickupLng,
      dropoffLat: order.dropoffLat,
      dropoffLng: order.dropoffLng,
      category: order.category,
      vehicle: order.vehicle,
      paymentMethod: order.paymentMethod,
    })
    return order
  }, [])

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'customer') return
    let cancelled = false

    refreshOrders()
      .then(async (orders) => {
        if (cancelled || draftRef.current) return // don't clobber an already-active in-memory booking
        const active = orders.find((o) => ACTIVE_STATUSES.includes(o.status))
        if (!active) return
        // Rebuild the tracking screen from the server so a refreshed/reopened tab during
        // an active delivery resumes live tracking instead of silently losing it.
        const order = await resumeTracking(active.id)
        if (!cancelled) setReconciledOrderId(order.id)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
    // Runs once per login — subsequent order updates flow through the socket listener below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.role])

  useEffect(() => {
    if (!isAuthenticated || user?.role === 'admin') return
    refreshOrders().catch(() => {})
    refreshWallet().catch(() => {})
    refreshConversations().catch(() => {})
    refreshLocations().catch(() => {})
  }, [isAuthenticated, user?.role, refreshOrders, refreshWallet, refreshConversations, refreshLocations])

  // ---- Real-time order updates while a booking is in progress ----
  const socket = useSocket()
  useEffect(() => {
    if (!socket) return

    function onOrderUpdate({ order, rider, conversationId }) {
      setDraft((d) => {
        if (!d || d.orderId !== order.id) return d
        if (order.status === 'cancelled') return null
        if (order.status === 'enroute' && d.phase === 'searching') {
          return { ...d, phase: 'found', rider, order, conversationId }
        }
        if (['arrived', 'in_transit'].includes(order.status)) {
          return { ...d, phase: order.status, order }
        }
        if (order.status === 'delivered') {
          // Driver says it's dropped off — nothing has been paid yet, this just asks
          // the customer to confirm before money moves.
          return { ...d, phase: 'delivered', order }
        }
        if (order.status === 'completed') {
          // Customer's own confirmation is what actually settles payment — refresh
          // wallet/orders now, not before, since this is when the balance actually changed.
          refreshOrders().catch(() => {})
          refreshWallet().catch(() => {})
          return { ...d, phase: 'completed', order }
        }
        return d
      })
    }

    function onMessageNew() {
      refreshConversations().catch(() => {})
    }

    function onOrderLocation({ orderId, lat, lng }) {
      setDraft((d) => (d && d.orderId === orderId ? { ...d, riderLat: lat, riderLng: lng } : d))
    }

    socket.on('order:update', onOrderUpdate)
    socket.on('message:new', onMessageNew)
    socket.on('order:location', onOrderLocation)
    return () => {
      socket.off('order:update', onOrderUpdate)
      socket.off('message:new', onMessageNew)
      socket.off('order:location', onOrderLocation)
    }
  }, [socket, refreshOrders, refreshWallet, refreshConversations])

  // ---- Booking draft (delivery request) state machine ----
  function startDraft(partial = {}) {
    orderRequestInFlightRef.current = false
    setDraft({
      phase: 'details',
      pickup: 'Current location',
      dropoff: '',
      category: 'parcel',
      vehicle: 'bike',
      paymentMethod: 'cash',
      note: '',
      ...partial,
    })
  }

  function updateDraft(patch) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  // ---- Safety net: even with listeners correctly attached, a live socket event can
  // still be missed during a genuine (if brief) disconnect at exactly the wrong moment
  // — Socket.IO does not queue/replay broadcast events for a socket that was offline
  // when they were sent. Rather than leave the customer stuck on "Finding riders"
  // forever with no way to recover, poll the order directly while it's in a phase a
  // missed event could get stuck in, and reconcile if the server has moved on.
  useEffect(() => {
    if (!draft?.orderId || draft.phase === 'details' || draft.phase === 'completed' || draft.phase === 'rated') return

    const interval = setInterval(async () => {
      try {
        const { order, rider } = await api.get(`/api/orders/${draft.orderId}`)
        setDraft((d) => {
          if (!d || d.orderId !== order.id) return d
          if (order.status === d.phase) return d // already in sync, nothing to reconcile
          if (order.status === 'cancelled') return null
          if (order.status === 'delivered') {
            refreshOrders().catch(() => {})
            refreshWallet().catch(() => {})
            return { ...d, phase: 'completed', order }
          }
          if (['enroute', 'arrived', 'in_transit'].includes(order.status)) {
            return { ...d, phase: d.phase === 'searching' ? 'found' : order.status, rider: rider || d.rider, order }
          }
          return d
        })
      } catch {
        // transient — next poll will retry
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [draft?.orderId, draft?.phase, refreshOrders, refreshWallet])

  async function requestRider() {
    const d = draftRef.current
    if (!d) return
    if (orderRequestInFlightRef.current) return // a duplicate tap while the first request is still in flight
    orderRequestInFlightRef.current = true
    setDraft({ ...d, phase: 'searching' })
    try {
      const { order } = await api.post('/api/orders', {
        pickup: d.pickup,
        dropoff: d.dropoff,
        pickupLat: d.pickupLat,
        pickupLng: d.pickupLng,
        dropoffLat: d.dropoffLat,
        dropoffLng: d.dropoffLng,
        category: d.category,
        vehicle: d.vehicle,
        paymentMethod: d.paymentMethod,
        note: d.note,
        senderPhone: d.senderPhone,
        recipientPhone: d.recipientPhone,
      })
      setDraft((prev) => (prev ? { ...prev, phase: 'searching', orderId: order.id, order } : prev))
    } catch (err) {
      setDraft((prev) => (prev ? { ...prev, phase: 'details', error: err.message } : prev))
    } finally {
      orderRequestInFlightRef.current = false
    }
  }

  function acceptFoundRider() {
    // The rider already committed on the backend; this just moves the customer's view forward.
    setDraft((d) => (d ? { ...d, phase: 'enroute' } : d))
  }

  async function confirmDelivery(orderId) {
    const { order } = await api.post(`/api/orders/${orderId}/confirm-delivery`)
    setDraft((d) => (d && d.orderId === order.id ? { ...d, phase: 'completed', order } : d))
    refreshOrders().catch(() => {})
    refreshWallet().catch(() => {})
    return order
  }

  async function cancelDraft() {
    const d = draftRef.current
    if (d?.orderId && ['searching', 'found'].includes(d.phase)) {
      api.post(`/api/orders/${d.orderId}/cancel`).catch(() => {})
    }
    setDraft(null)
    refreshOrders().catch(() => {})
  }

  async function rateOrder(orderId, rating, comment) {
    await api.post(`/api/orders/${orderId}/rate`, { rating, comment })
    setDraft((d) => (d ? { ...d, phase: 'rated' } : d))
    refreshOrders().catch(() => {})
  }

  async function topUpWallet(amount) {
    const result = await api.post('/api/wallet/topup/initialize', { amount })
    if (result.simulated) {
      await refreshWallet()
    } else if (result.authorizationUrl) {
      window.open(result.authorizationUrl, '_blank', 'noopener')
    }
    return result
  }

  async function verifyTopUp(reference) {
    const result = await api.get(`/api/wallet/topup/verify/${reference}`)
    await refreshWallet()
    return result
  }

  async function sendMessage(conversationId, text) {
    await api.post(`/api/messages/${conversationId}/messages`, { text })
    refreshConversations().catch(() => {})
  }

  async function addSavedLocation(loc) {
    const { location } = await api.post('/api/locations', loc)
    setSavedLocations((prev) => [...prev, location])
  }

  const value = {
    orders,
    transactions,
    walletBalance,
    conversations,
    savedLocations,
    reconciledOrderId,
    draft,
    refreshOrders,
    refreshWallet,
    refreshConversations,
    startDraft,
    updateDraft,
    requestRider,
    acceptFoundRider,
    confirmDelivery,
    resumeTracking,
    cancelDraft,
    rateOrder,
    topUpWallet,
    verifyTopUp,
    sendMessage,
    addSavedLocation,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData() {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider')
  return ctx
}
