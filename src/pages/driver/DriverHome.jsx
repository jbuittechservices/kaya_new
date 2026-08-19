import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, CheckCircle2, CreditCard, Radio, MapPin, Phone, MessageCircle, Star, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Card } from '../../components/ui/Misc'
import Button from '../../components/ui/Button'
import LiveMap from '../../components/ui/LiveMap'
import { formatNaira } from '../../utils/format'
import { api, avatarSrc } from '../../lib/api'
import { useSocket } from '../../lib/socket'

const ONLINE_PREF_KEY = 'kaya.driver.onlinePref'

const ONBOARDING_STEPS = [
  { key: 'personalInfo', step: 1, title: 'Personal information', desc: 'Fill out your personal details to get onboarded', icon: ClipboardList, tab: 'profile' },
  { key: 'documents', step: 2, title: 'Document verification', desc: 'Upload your valid ID and license', icon: CheckCircle2, tab: 'documents' },
  { key: 'guarantor', step: 3, title: 'Guarantor details', desc: "Add a guarantor so admin can approve your account", icon: CreditCard, tab: 'guarantor' },
]

const STAGE_LABEL = {
  enroute: { title: 'Head to pickup point', cta: 'Confirm pickup' },
  arrived: { title: 'At pickup — collect the package', cta: 'Start delivery' },
  in_transit: { title: 'Delivering to customer', cta: 'Mark as delivered' },
}

export default function DriverHome() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
  const socket = useSocket()
  // "Online" is a real preference, not just UI state — a refresh (or a brief network
  // drop that silently reconnects the socket) shouldn't quietly demote the driver to
  // offline until they notice deliveries have stopped coming in.
  const [online, setOnline] = useState(() => localStorage.getItem(ONLINE_PREF_KEY) === 'true')
  const [queue, setQueue] = useState([])
  const [active, setActive] = useState(null)
  const [earnings, setEarnings] = useState({ todayEarnings: 0, tripsToday: 0 })
  const [busy, setBusy] = useState(false)
  const [rateCustomerOrder, setRateCustomerOrder] = useState(null)
  const [gateNotice, setGateNotice] = useState(null)

  const onboarding = user?.onboarding || {}
  const stepIncomplete = ONBOARDING_STEPS.some((s) => !onboarding[s.key])
  const canGoOnline = !stepIncomplete && !!user?.vehicleType

  useEffect(() => {
    api.get('/api/drivers/earnings').then(setEarnings).catch(() => {})
  }, [])

  // If a driver was previously online (persisted preference) but is no longer eligible —
  // e.g. an admin reversed their verification — don't keep showing "Online" as if they're
  // still receiving requests, since the server would silently reject it either way.
  useEffect(() => {
    if (online && !canGoOnline) {
      setOnline(false)
      localStorage.setItem(ONLINE_PREF_KEY, 'false')
    }
  }, [online, canGoOnline])

  // Re-assert "online" to the server every time a connection is (re)established —
  // covers the initial page load race (socket not ready yet when this mounts) and
  // any later silent reconnect (network blip, server restart) without the driver
  // having to notice and manually toggle back on.
  useEffect(() => {
    if (!socket || !online || !canGoOnline) return
    socket.emit('driver:online')
  }, [socket, online, canGoOnline])

  // Defensive safety net — the server independently re-checks verification/vehicle type
  // on every 'driver:online' attempt (never trusts the client), so surface a clear reason
  // if it ever rejects one instead of the driver just silently never receiving requests.
  useEffect(() => {
    if (!socket) return
    function onNotVerified() {
      setOnline(false)
      localStorage.setItem(ONLINE_PREF_KEY, 'false')
      setGateNotice('Your account needs to be verified by the Kaya team before you can go online.')
    }
    function onNoVehicleType() {
      setOnline(false)
      localStorage.setItem(ONLINE_PREF_KEY, 'false')
      setGateNotice('Set your vehicle type in Account → Vehicle before you can go online.')
    }
    socket.on('driver:not-verified', onNotVerified)
    socket.on('driver:no-vehicle-type', onNoVehicleType)
    return () => {
      socket.off('driver:not-verified', onNotVerified)
      socket.off('driver:no-vehicle-type', onNoVehicleType)
    }
  }, [socket])

  useEffect(() => {
    if (!socket) return

    function onIncoming(order) {
      setQueue((q) => (q.some((o) => o.id === order.id) ? q : [...q, order]))
    }
    function onTaken({ orderId }) {
      setQueue((q) => q.filter((o) => o.id !== orderId))
    }

    socket.on('order:incoming', onIncoming)
    socket.on('order:taken', onTaken)
    return () => {
      socket.off('order:incoming', onIncoming)
      socket.off('order:taken', onTaken)
    }
  }, [socket])

  // Report real device location to the customer while a delivery is active
  useEffect(() => {
    if (!active || !navigator.geolocation || !socket) return

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit('driver:location', {
          orderId: active.id,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [active?.id, socket])

  function toggleOnline() {
    if (!online && !canGoOnline) {
      setGateNotice(
        stepIncomplete
          ? 'Complete verification (steps below) before you can go online.'
          : 'Set your vehicle type in Account → Vehicle before you can go online.'
      )
      return
    }
    const next = !online
    setOnline(next)
    localStorage.setItem(ONLINE_PREF_KEY, String(next))
    if (socket) socket.emit(next ? 'driver:online' : 'driver:offline')
    if (!next) setQueue([])
  }

  async function acceptRequest(order) {
    setBusy(true)
    try {
      const { order: updated, customer, conversationId } = await api.post(`/api/orders/${order.id}/accept`)
      setActive({ ...updated, customer, conversationId })
      setQueue((q) => q.filter((o) => o.id !== order.id))
    } catch (err) {
      setQueue((q) => q.filter((o) => o.id !== order.id))
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  function declineRequest(orderId) {
    setQueue((q) => q.filter((o) => o.id !== orderId))
  }

  async function advance() {
    if (!active) return
    setBusy(true)
    try {
      const { order } = await api.post(`/api/orders/${active.id}/advance`)
      if (order.status === 'delivered') {
        setRateCustomerOrder({ ...order, customer: active.customer })
        setActive(null)
        api.get('/api/drivers/earnings').then(setEarnings).catch(() => {})
        refreshUser()
      } else {
        setActive((a) => ({ ...a, ...order }))
      }
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function rateCustomer(rating, comment) {
    if (!rateCustomerOrder) return
    setBusy(true)
    try {
      await api.post(`/api/orders/${rateCustomerOrder.id}/rate-customer`, { rating, comment })
    } catch {
      // non-critical — don't block the driver from moving on if this fails
    } finally {
      setBusy(false)
      setRateCustomerOrder(null)
    }
  }

  const incoming = queue[0]

  return (
    <div className="min-h-screen bg-cream-100 pb-10">
      <div className="flex items-center justify-between px-5 pt-6">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} size={48} />
          <div>
            <p className="text-sm text-slate-muted">Welcome back,</p>
            <p className="text-base font-extrabold text-navy-950">{user?.name}</p>
          </div>
        </div>
        <button
          onClick={toggleOnline}
          className={`tap flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${online ? 'bg-success/15 text-success' : 'bg-navy-900/8 text-navy-900/50'}`}
        >
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-success' : 'bg-navy-900/40'}`} />
          {online ? 'Online' : 'Offline'}
        </button>
      </div>

      {gateNotice && (
        <div className="mx-5 mt-4 flex items-start gap-2.5 rounded-2xl bg-amber-100 p-3.5">
          <p className="flex-1 text-sm font-medium text-amber-800">{gateNotice}</p>
          <button onClick={() => setGateNotice(null)} className="tap shrink-0 text-amber-800/60">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 px-5">
        <Card>
          <p className="text-xs text-slate-muted">Today's earnings</p>
          <p className="mt-1 text-xl font-extrabold text-navy-950">{formatNaira(earnings.todayEarnings)}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-muted">Trips completed</p>
          <p className="mt-1 text-xl font-extrabold text-navy-950">{earnings.tripsToday}</p>
        </Card>
      </div>

      {stepIncomplete && (
        <div className="mt-6 px-5">
          <h2 className="text-lg font-extrabold text-navy-950">Get ready to ride and earn!</h2>
          <p className="mt-1 text-sm text-slate-muted">Complete your setup in three simple steps.</p>
          <div className="mt-4 space-y-3">
            {ONBOARDING_STEPS.map((s) => {
              const done = !!onboarding[s.key]
              const Icon = done ? CheckCircle2 : s.icon
              return (
                <Card key={s.step} className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${done ? 'bg-success/10' : 'bg-amber-100'}`}>
                    <Icon size={20} className={done ? 'text-success' : 'text-amber-600'} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Step {s.step} of 3</p>
                    <p className="text-sm font-bold text-navy-950">{s.title}</p>
                    <p className="text-xs text-slate-muted">{s.desc}</p>
                  </div>
                </Card>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-slate-muted">Document and guarantor verification is completed by the Kaya admin team once submitted.</p>
        </div>
      )}

      {!active && online && !incoming && (
        <div className="mt-8 px-5 text-center">
          <div className="relative mx-auto flex h-16 w-16 items-center justify-center">
            <span className="pulse-ring absolute inset-0" />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-navy-900">
              <Radio size={24} className="text-amber-400" />
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-navy-950">Listening for nearby requests…</p>
        </div>
      )}

      {!active && !online && (
        <div className="mt-8 px-5 text-center text-sm text-slate-muted">You're offline. Go online to start receiving delivery requests nearby.</div>
      )}

      {incoming && !active && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md animate-slide-up rounded-t-3xl bg-white p-5 shadow-2xl safe-bottom">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-amber-600">New delivery request</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-base font-extrabold text-navy-950">{incoming.category} delivery</p>
              <p className="text-xs text-slate-muted">{incoming.vehicle}</p>
            </div>
            <p className="text-lg font-extrabold text-navy-950">{formatNaira(incoming.price)}</p>
          </div>
          <div className="mt-3 space-y-1.5 rounded-2xl bg-navy-900/5 p-3 text-sm">
            <p className="flex items-start gap-1.5">
              <MapPin size={14} className="mt-0.5 shrink-0 text-navy-900/50" />
              <span><span className="text-slate-muted">From: </span>{incoming.pickup}</span>
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin size={14} className="mt-0.5 shrink-0 text-amber-600" />
              <span><span className="text-slate-muted">To: </span>{incoming.dropoff}</span>
            </p>
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="outline" full onClick={() => declineRequest(incoming.id)} disabled={busy}>
              Decline
            </Button>
            <Button full onClick={() => acceptRequest(incoming)} disabled={busy}>
              Accept
            </Button>
          </div>
        </div>
      )}

      {active && (
        <div className="mt-6 px-5">
          <LiveMap
            pickup={{ lat: active.pickupLat, lng: active.pickupLng }}
            dropoff={{ lat: active.dropoffLat, lng: active.dropoffLng }}
            progress={active.status === 'enroute' ? 0.33 : active.status === 'arrived' ? 0.66 : 0.9}
            className="h-44 rounded-3xl"
          />
          <Card className="mt-4">
            <div className="flex items-center gap-3">
              <Avatar name={active.customer?.name} size={44} src={avatarSrc(active.customer?.avatarUrl)} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy-950">{active.customer?.name || 'Customer'}</p>
                <p className="text-xs text-slate-muted">{active.status === 'in_transit' ? active.dropoff : active.pickup}</p>
              </div>
              <div className="flex gap-2">
                <a
                  href={active.customer?.phone ? `tel:${active.customer.phone}` : undefined}
                  className="tap flex h-10 w-10 items-center justify-center rounded-full bg-navy-900/5"
                  aria-disabled={!active.customer?.phone}
                >
                  <Phone size={16} className="text-navy-900" />
                </a>
                <button
                  onClick={() => active.conversationId && navigate(`/driver/messages/${active.conversationId}`)}
                  className="tap flex h-10 w-10 items-center justify-center rounded-full bg-navy-900/5"
                >
                  <MessageCircle size={16} className="text-navy-900" />
                </button>
              </div>
            </div>
            <div className="my-3 h-px bg-navy-900/8" />
            <p className="text-sm font-bold text-navy-950">{STAGE_LABEL[active.status]?.title}</p>
            <div className="my-3 h-px bg-navy-900/8" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-muted">Fare</span>
              <span className="font-semibold text-navy-950">{formatNaira(active.price)}</span>
            </div>
            <Button full className="mt-4" onClick={advance} disabled={busy}>
              {busy ? 'Updating…' : STAGE_LABEL[active.status]?.cta}
            </Button>
          </Card>
        </div>
      )}

      {rateCustomerOrder && <RateCustomerSheet order={rateCustomerOrder} busy={busy} onSubmit={rateCustomer} onSkip={() => setRateCustomerOrder(null)} />}
    </div>
  )
}

function RateCustomerSheet({ order, busy, onSubmit, onSkip }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md animate-slide-up rounded-t-3xl bg-white p-5 shadow-2xl safe-bottom">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <CheckCircle2 size={26} className="text-success" />
      </div>
      <p className="text-center text-base font-bold text-navy-950">Delivered — how was {order.customer?.name?.split(' ')[0] || 'the customer'}?</p>
      <p className="mt-1 text-center text-sm text-slate-muted">Your feedback helps keep the platform trustworthy for every rider.</p>
      <div className="mt-4 flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className="tap">
            <Star size={30} className={n <= rating ? 'fill-[#FFB800] text-[#FFB800]' : 'text-navy-900/20'} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)"
        rows={2}
        className="mt-4 w-full rounded-2xl border border-navy-900/12 p-3 text-sm outline-none focus:border-amber-500"
      />
      <Button full className="mt-4" disabled={!rating || busy} onClick={() => onSubmit(rating, comment)}>
        {busy ? 'Submitting…' : 'Submit rating'}
      </Button>
      <button onClick={onSkip} className="mt-3 w-full text-center text-sm font-semibold text-slate-muted">
        Skip for now
      </button>
    </div>
  )
}
