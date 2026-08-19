import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Package, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useAppData } from '../context/AppDataContext'
import { Card, StatusBadge, Avatar } from '../components/ui/Misc'
import Button from '../components/ui/Button'
import PlacesAutocompleteInput from '../components/ui/PlacesAutocomplete'
import { formatNaira, formatDate } from '../utils/format'
import { avatarSrc } from '../lib/api'
import { PACKAGE_CATEGORIES } from '../data/mock'
import { CATEGORY_ICONS, LOCATION_ICONS, MapPin } from '../lib/icons'

export default function Home() {
  const { user } = useAuth()
  const { orders, savedLocations, startDraft } = useAppData()
  const navigate = useNavigate()
  const [pickup, setPickup] = useState('Current location')
  const [pickupCoords, setPickupCoords] = useState(null)
  const [dropoff, setDropoff] = useState('')
  const [dropoffCoords, setDropoffCoords] = useState(null)

  // Use the browser's real location for pickup when the person allows it
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setPickupCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { timeout: 5000 }
    )
  }, [])

  const firstName = user?.name?.split(' ')[0] || 'there'
  const recent = orders.slice(0, 3)

  function beginBooking(prefill = {}) {
    startDraft({
      pickup,
      pickupLat: pickupCoords?.lat,
      pickupLng: pickupCoords?.lng,
      dropoff,
      dropoffLat: dropoffCoords?.lat,
      dropoffLng: dropoffCoords?.lng,
      ...prefill,
    })
    navigate('/app/booking')
  }

  return (
    <div className="px-5 pt-6 md:px-0">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-muted">Good to see you,</p>
          <h1 className="text-xl font-extrabold text-navy-950">{firstName}</h1>
        </div>
        <Avatar name={user?.name} src={avatarSrc(user?.avatarUrl)} />
      </div>

      {/* Booking card */}
      <div className="relative overflow-hidden rounded-3xl bg-navy-900 p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15">
            <Package size={18} className="text-amber-400" />
          </span>
          <h2 className="text-lg font-extrabold text-white">Got a package to send?</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            beginBooking()
          }}
          className="space-y-2.5"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <PlacesAutocompleteInput
              value={pickup}
              onChange={setPickup}
              onSelect={({ lat, lng }) => setPickupCoords({ lat, lng })}
              placeholder="Pickup location"
              dark
            />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.08] px-4 py-3">
            <span className="h-2 w-2 rounded-full bg-white/50" />
            <PlacesAutocompleteInput
              value={dropoff}
              onChange={setDropoff}
              onSelect={({ lat, lng }) => setDropoffCoords({ lat, lng })}
              placeholder="Where to?"
              dark
            />
          </div>
          <Button type="submit" full size="lg" className="mt-3" disabled={!dropoff}>
            Book your delivery
          </Button>
        </form>
      </div>

      {/* Saved locations */}
      <div className="mt-6 flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {savedLocations.map((loc) => {
          const Icon = LOCATION_ICONS[loc.icon] || MapPin
          return (
            <button
              key={loc.id}
              onClick={() => {
                setDropoff(loc.address)
                setDropoffCoords(loc.lat != null ? { lat: loc.lat, lng: loc.lng } : null)
              }}
              className="tap flex shrink-0 items-center gap-2 rounded-2xl border border-navy-900/10 bg-white px-3.5 py-2.5"
            >
              <Icon size={16} className="text-navy-900/70" />
              <span className="text-sm font-semibold text-navy-900">{loc.label}</span>
            </button>
          )
        })}
        <button
          onClick={() => navigate('/app/account/locations')}
          className="tap flex shrink-0 items-center gap-1.5 rounded-2xl border border-dashed border-navy-900/20 px-3.5 py-2.5 text-sm font-semibold text-navy-900/60"
        >
          <Plus size={15} /> Add
        </button>
      </div>

      {/* Package categories quick pick */}
      <p className="mb-3 mt-7 text-sm font-bold text-navy-950">What are you sending?</p>
      <div className="grid grid-cols-3 gap-3">
        {PACKAGE_CATEGORIES.slice(0, 6).map((c) => {
          const Icon = CATEGORY_ICONS[c.id] || Package
          return (
            <button
              key={c.id}
              onClick={() => beginBooking({ category: c.id })}
              className="tap flex flex-col items-center gap-1.5 rounded-2xl bg-white p-3 text-center shadow-[var(--shadow-card)]"
            >
              <Icon size={22} className="text-navy-900" strokeWidth={1.7} />
              <span className="text-xs font-semibold text-navy-900">{c.label}</span>
            </button>
          )
        })}
      </div>

      {/* Recent orders */}
      <div className="mb-4 mt-8 flex items-center justify-between">
        <p className="text-sm font-bold text-navy-950">Recent orders</p>
        <button onClick={() => navigate('/app/orders')} className="flex items-center text-sm font-semibold text-amber-600">
          View all <ChevronRight size={16} />
        </button>
      </div>

      {recent.length === 0 ? (
        <Card className="text-center text-sm text-slate-muted">No recent orders yet — your next delivery will show up here.</Card>
      ) : (
        <div className="space-y-3">
          {recent.map((o) => (
            <Card key={o.id} onClick={() => navigate(`/app/orders/${o.id}`)} className="tap flex cursor-pointer items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
                <Package size={18} className="text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy-950">{o.dropoff}</p>
                <p className="text-xs text-slate-muted">{formatDate(o.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-navy-950">{formatNaira(o.price)}</p>
                <StatusBadge status={o.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
