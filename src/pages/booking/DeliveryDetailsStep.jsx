import { useMemo, useState, useEffect } from 'react'
import { Plus, Minus, Banknote, CreditCard } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { BackHeader } from '../../components/ui/Misc'
import LiveMap from '../../components/ui/LiveMap'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import PlacesAutocompleteInput from '../../components/ui/PlacesAutocomplete'
import { PACKAGE_CATEGORIES, VEHICLE_OPTIONS } from '../../data/mock'
import { CATEGORY_ICONS, VEHICLE_ICONS } from '../../lib/icons'
import { formatNaira } from '../../utils/format'
import { api } from '../../lib/api'

export default function DeliveryDetailsStep() {
  const { draft, updateDraft, requestRider, cancelDraft } = useAppData()
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [estimates, setEstimates] = useState({}) // { bike: {price, distanceKm, minutes}, car: {...}, van: {...} }

  const vehicle = useMemo(() => VEHICLE_OPTIONS.find((v) => v.id === draft.vehicle) || VEHICLE_OPTIONS[0], [draft.vehicle])
  const currentEstimate = estimates[draft.vehicle]

  // Live fare estimate — same formula the server uses to actually charge at booking
  // time, so what's shown here always matches what gets billed. Refetches whenever
  // pickup/dropoff coordinates change (selecting a different address, choosing a
  // different vehicle type doesn't need a refetch since all three are loaded together).
  useEffect(() => {
    let cancelled = false
    Promise.all(
      VEHICLE_OPTIONS.map(async (v) => {
        const qs = new URLSearchParams({
          vehicle: v.id,
          ...(draft.pickupLat != null && { pickupLat: draft.pickupLat, pickupLng: draft.pickupLng }),
          ...(draft.dropoffLat != null && { dropoffLat: draft.dropoffLat, dropoffLng: draft.dropoffLng }),
        }).toString()
        const estimate = await api.get(`/api/orders/estimate?${qs}`).catch(() => null)
        return [v.id, estimate]
      })
    ).then((pairs) => {
      if (cancelled) return
      setEstimates(Object.fromEntries(pairs.filter(([, e]) => e)))
    })
    return () => {
      cancelled = true
    }
  }, [draft.pickupLat, draft.pickupLng, draft.dropoffLat, draft.dropoffLng])

  return (
    <div className="min-h-screen bg-cream-100 pb-28">
      <BackHeader title="Delivery details" onBack={cancelDraft} />

      <LiveMap
        pickup={{ lat: draft.pickupLat, lng: draft.pickupLng }}
        dropoff={{ lat: draft.dropoffLat, lng: draft.dropoffLng }}
        className="mx-5 h-40 rounded-3xl"
      />

      <div className="mt-5 space-y-4 px-5">
        <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-muted">Pickup</p>
              <PlacesAutocompleteInput
                value={draft.pickup || ''}
                onChange={(val) => updateDraft({ pickup: val })}
                onSelect={({ address, lat, lng }) => updateDraft({ pickup: address, pickupLat: lat, pickupLng: lng })}
                placeholder="Current location"
                className="w-full bg-transparent text-sm font-semibold text-navy-950 outline-none placeholder:text-navy-900/35"
              />
            </div>
          </div>
          <div className="my-3 h-px bg-navy-900/8" />
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-navy-900" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-muted">Destination</p>
              <PlacesAutocompleteInput
                value={draft.dropoff || ''}
                onChange={(val) => updateDraft({ dropoff: val })}
                onSelect={({ address, lat, lng }) => updateDraft({ dropoff: address, dropoffLat: lat, dropoffLng: lng })}
                placeholder="Where is this going?"
                className="w-full bg-transparent text-sm font-semibold text-navy-950 outline-none placeholder:text-navy-900/35"
              />
            </div>
          </div>
        </div>

        {/* Category */}
        <div>
          <p className="mb-2.5 text-sm font-bold text-navy-950">What are you sending?</p>
          <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
            {PACKAGE_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICONS[c.id]
              return (
                <button
                  key={c.id}
                  onClick={() => updateDraft({ category: c.id })}
                  className={`tap flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-4 py-3 ${
                    draft.category === c.id ? 'border-amber-500 bg-amber-100' : 'border-navy-900/10 bg-white'
                  }`}
                >
                  <Icon size={20} className="text-navy-900" strokeWidth={1.7} />
                  <span className="text-xs font-semibold text-navy-900">{c.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Vehicle */}
        <div>
          <p className="mb-2.5 text-sm font-bold text-navy-950">Choose a ride</p>
          <div className="space-y-2.5">
            {VEHICLE_OPTIONS.map((v) => {
              const Icon = VEHICLE_ICONS[v.id]
              return (
                <button
                  key={v.id}
                  onClick={() => updateDraft({ vehicle: v.id })}
                  className={`tap flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left ${
                    draft.vehicle === v.id ? 'border-amber-500 bg-amber-100/60' : 'border-navy-900/10 bg-white'
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-navy-900/5">
                    <Icon size={22} className="text-navy-900" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-navy-950">{v.label} · {v.eta}</p>
                    <p className="text-xs text-slate-muted">{v.desc} · {v.capacity}</p>
                  </div>
                  <p className="text-sm font-extrabold text-navy-950">{formatNaira(estimates[v.id]?.price ?? v.price)}</p>
                </button>
              )
            })}
          </div>
        </div>

        {/* Order details toggle */}
        <button
          onClick={() => setShowOrderDetails((s) => !s)}
          className="tap flex w-full items-center justify-between rounded-2xl bg-white p-4 text-sm font-semibold text-navy-900 shadow-[var(--shadow-card)]"
        >
          Enter order details
          {showOrderDetails ? <Minus size={18} className="text-amber-600" /> : <Plus size={18} className="text-amber-600" />}
        </button>
        {showOrderDetails && (
          <div className="animate-slide-up space-y-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
            <Input
              label="Sender's phone number"
              type="tel"
              placeholder="080X XXX XXXX"
              value={draft.senderPhone || ''}
              onChange={(e) => updateDraft({ senderPhone: e.target.value })}
            />
            <Input
              label="Recipient's phone number"
              type="tel"
              placeholder="080X XXX XXXX"
              value={draft.recipientPhone || ''}
              onChange={(e) => updateDraft({ recipientPhone: e.target.value })}
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-navy-900/80">Package description (optional)</span>
              <textarea
                value={draft.note || ''}
                onChange={(e) => updateDraft({ note: e.target.value })}
                maxLength={200}
                rows={3}
                placeholder="Small envelope with fragile documents…"
                className="w-full rounded-2xl border border-navy-900/12 bg-white p-3.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25"
              />
            </label>
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between rounded-2xl bg-amber-100 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-base font-bold text-amber-600">₦</span>
            <div>
              <p className="text-sm font-extrabold text-navy-950">{formatNaira(currentEstimate?.price ?? vehicle.price)}</p>
              <p className="text-xs text-navy-900/60">
                {currentEstimate ? `~${currentEstimate.distanceKm}km · ~${currentEstimate.minutes} min` : 'Estimated fare — set pickup and destination for an exact price'}
              </p>
            </div>
          </div>
        </div>

        {/* Payment method */}
        <div className="flex gap-3">
          {[
            { id: 'cash', label: 'Cash', Icon: Banknote },
            { id: 'online', label: 'Online payment', Icon: CreditCard },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => updateDraft({ paymentMethod: id })}
              className={`tap flex flex-1 items-center justify-center gap-2 rounded-2xl border py-3 text-sm font-semibold ${
                (draft.paymentMethod || 'cash') === id ? 'border-amber-500 bg-amber-100 text-navy-950' : 'border-navy-900/10 bg-white text-navy-900/60'
              }`}
            >
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {draft.error && <p className="text-center text-sm font-medium text-danger">{draft.error}</p>}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md border-t border-navy-900/8 bg-cream-100/95 px-5 py-4 backdrop-blur safe-bottom md:static md:mt-6 md:border-0 md:bg-transparent md:px-0">
        <Button full size="lg" disabled={!draft.dropoff} onClick={requestRider}>
          Confirm delivery
        </Button>
      </div>
    </div>
  )
}
