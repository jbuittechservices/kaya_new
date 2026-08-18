import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { getSocket } from '../lib/socket'
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

  useEffect(() => {
    if (!isAuthenticated || user?.role === 'admin') return
    refreshOrders().catch(() => {})
    refreshWallet().catch(() => {})
    refreshConversations().catch(() => {})
    refreshLocations().catch(() => {})
  }, [isAuthenticated, user?.role, refreshOrders, refreshWallet, refreshConversations, refreshLocations])

  // ---- Real-time order updates while a booking is in progress ----
  useEffect(() => {
    const socket = getSocket()
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
  }, [refreshOrders, refreshWallet, refreshConversations])

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
    draft,
    refreshOrders,
    refreshWallet,
    refreshConversations,
    startDraft,
    updateDraft,
    requestRider,
    acceptFoundRider,
    cancelDraft,
    rateOrder,
    topUpWallet,
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
