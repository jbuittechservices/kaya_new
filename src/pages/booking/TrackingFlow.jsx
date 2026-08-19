import { useState } from 'react'
import { MapPin, Phone, MessageCircle, CheckCircle2, PartyPopper, Star, Wallet, Banknote } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppData } from '../../context/AppDataContext'
import { BackHeader, Avatar } from '../../components/ui/Misc'
import LiveMap from '../../components/ui/LiveMap'
import Button from '../../components/ui/Button'
import { formatNaira } from '../../utils/format'
import { avatarSrc } from '../../lib/api'

const PHASE_COPY = {
  enroute: { title: 'Rider is on the way', desc: 'Heading to your pickup point' },
  arrived: { title: 'Your rider has arrived', desc: 'Waiting at the pickup point' },
  in_transit: { title: 'Package in transit', desc: 'On its way to the destination' },
}

export default function TrackingFlow({ onDone }) {
  const { draft, cancelDraft, acceptFoundRider, rateOrder, confirmDelivery } = useAppData()
  const navigate = useNavigate()
  const { phase } = draft

  return (
    <div className="min-h-screen bg-cream-100 pb-10">
      <BackHeader
        title={
          phase === 'searching' ? 'Finding a rider' :
          phase === 'found' ? 'Rider found' :
          phase === 'delivered' ? 'Confirm delivery' :
          phase === 'completed' || phase === 'rated' ? 'Delivery complete' :
          'Track delivery'
        }
        onBack={phase === 'delivered' || phase === 'completed' || phase === 'rated' ? onDone : cancelDraft}
      />

      <LiveMap
        pickup={{ lat: draft.pickupLat, lng: draft.pickupLng }}
        dropoff={{ lat: draft.dropoffLat, lng: draft.dropoffLng }}
        liveMarker={draft.riderLat != null ? { lat: draft.riderLat, lng: draft.riderLng } : null}
        progress={phase === 'enroute' ? 0.33 : phase === 'arrived' ? 0.66 : phase === 'in_transit' ? 0.9 : phase === 'delivered' ? 1 : null}
        className="mx-5 h-56 rounded-3xl"
      >
        {phase === 'searching' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="pulse-ring absolute inset-0" />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-navy-900">
                <MapPin size={22} className="text-amber-400" />
              </span>
            </div>
          </div>
        )}
      </LiveMap>

      <div className="mt-5 px-5">
        {phase === 'searching' && <SearchingPanel />}
        {phase === 'found' && <FoundPanel draft={draft} onAccept={acceptFoundRider} onCancel={cancelDraft} />}
        {(phase === 'enroute' || phase === 'arrived' || phase === 'in_transit') && <LivePanel draft={draft} phase={phase} navigate={navigate} />}
        {phase === 'delivered' && <ConfirmDeliveryPanel draft={draft} onConfirm={confirmDelivery} />}
        {phase === 'completed' && <CompletedPanel draft={draft} onSkip={onDone} rateOrder={rateOrder} />}
        {phase === 'rated' && <ThankYouPanel onDone={onDone} />}
      </div>
    </div>
  )
}

function SearchingPanel() {
  return (
    <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-bold text-navy-950">Finding the nearest rider…</h2>
      <p className="mt-1.5 text-sm text-slate-muted">This usually takes less than a minute.</p>
      <div className="mx-auto mt-6 flex w-40 justify-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-amber-500" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

function FoundPanel({ draft, onAccept, onCancel }) {
  const rider = draft.rider
  if (!rider) return null
  return (
    <div className="animate-slide-up space-y-4">
      <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <Avatar name={rider.name} size={52} src={avatarSrc(rider.avatarUrl)} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-navy-950">{rider.name}</p>
            <p className="flex items-center gap-1 text-sm text-slate-muted">
              <Star size={14} className="fill-[#FFB800] text-[#FFB800]" /> {rider.rating} · {rider.trips} trips
            </p>
          </div>
          <p className="text-sm font-semibold text-amber-600">{rider.eta ?? 5} min away</p>
        </div>
        <div className="my-3 h-px bg-navy-900/8" />
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-muted">{rider.vehicle}</span>
          <span className="font-semibold text-navy-950">{rider.plate}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" full onClick={onCancel}>
          Cancel
        </Button>
        <Button full onClick={onAccept}>
          Track delivery
        </Button>
      </div>
    </div>
  )
}

function LivePanel({ draft, phase, navigate }) {
  const rider = draft.rider
  const copy = PHASE_COPY[phase]
  const price = draft.order?.price
  return (
    <div className="animate-fade-in space-y-4">
      <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <Avatar name={rider?.name} size={52} src={avatarSrc(rider?.avatarUrl)} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-navy-950">{rider?.name}</p>
            <p className="text-sm text-slate-muted">{rider?.vehicle}</p>
          </div>
          <div className="flex gap-2">
            <a href={rider?.phone ? `tel:${rider.phone}` : undefined} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-navy-900/5">
              <Phone size={16} className="text-navy-900" />
            </a>
            <button
              onClick={() => draft.conversationId && navigate(`/app/messages/${draft.conversationId}`)}
              className="tap flex h-10 w-10 items-center justify-center rounded-full bg-navy-900/5"
            >
              <MessageCircle size={16} className="text-navy-900" />
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-navy-900 p-5 text-center">
        <p className="text-base font-bold text-white">{copy.title}</p>
        <p className="mt-1 text-sm text-white/60">{copy.desc}</p>
        <div className="mx-auto mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-1000"
            style={{ width: phase === 'enroute' ? '33%' : phase === 'arrived' ? '66%' : '92%' }}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 text-sm shadow-[var(--shadow-card)]">
        <div className="flex justify-between py-1">
          <span className="text-slate-muted">Order price</span>
          <span className="font-semibold text-navy-950">{formatNaira(price ?? 0)}</span>
        </div>
        <div className="flex justify-between py-1">
          <span className="text-slate-muted">Destination</span>
          <span className="max-w-[60%] truncate font-semibold text-navy-950">{draft.dropoff || 'Destination'}</span>
        </div>
      </div>
    </div>
  )
}

function ConfirmDeliveryPanel({ draft, onConfirm }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const order = draft.order
  const rider = draft.rider
  const isOnline = order?.paymentMethod === 'online' || order?.paymentMethod === 'wallet'

  async function handleConfirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(order.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-slide-up space-y-4">
      <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
          <CheckCircle2 size={26} className="text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-navy-950">{rider?.name || 'Your rider'} says it's delivered</h2>
        <p className="mt-1 text-sm text-slate-muted">Confirm you've received your package to complete the order.</p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3 rounded-2xl bg-navy-900/5 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
            {isOnline ? <Wallet size={20} className="text-navy-900" /> : <Banknote size={20} className="text-navy-900" />}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-navy-950">{formatNaira(order?.price)}</p>
            <p className="text-xs text-slate-muted">
              {isOnline ? "Deducted from your wallet the moment you confirm" : `Pay ${rider?.name?.split(' ')[0] || 'your rider'} in cash`}
            </p>
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <Button full className="mt-4" disabled={busy} onClick={handleConfirm}>
          {busy ? 'Confirming…' : "Confirm I've received it"}
        </Button>
      </div>
    </div>
  )
}

function CompletedPanel({ draft, onSkip, rateOrder }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const order = draft.order

  return (
    <div className="animate-slide-up space-y-5">
      <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-card)]">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 size={26} className="text-success" />
        </div>
        <h2 className="text-lg font-bold text-navy-950">Delivered successfully</h2>
        <p className="mt-1 text-sm text-slate-muted">Order {order?.id} · {formatNaira(order?.price)}</p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)]">
        <p className="text-center text-base font-bold text-navy-950">Rate your experience</p>
        <p className="mt-1 text-center text-sm text-slate-muted">Your feedback helps us improve.</p>
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
        <Button full className="mt-4" disabled={!rating} onClick={() => rateOrder(order?.id, rating, comment)}>
          Submit rating
        </Button>
        <button onClick={onSkip} className="mt-3 w-full text-center text-sm font-semibold text-slate-muted">
          Skip for now
        </button>
      </div>
    </div>
  )
}

function ThankYouPanel({ onDone }) {
  return (
    <div className="animate-slide-up rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <PartyPopper size={28} className="text-amber-600" />
      </div>
      <h2 className="text-lg font-bold text-navy-950">Thanks for the feedback!</h2>
      <p className="mt-1.5 text-sm text-slate-muted">We'll keep matching you with great riders.</p>
      <Button full className="mt-6" onClick={onDone}>
        Back to home
      </Button>
    </div>
  )
}
