import { useEffect, useState } from 'react'
import { Bike, Car, Truck, Check } from 'lucide-react'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Misc'
import Button from '../../components/ui/Button'
import { formatNaira } from '../../utils/format'

const VEHICLE_META = [
  { id: 'bike', label: 'Bike', icon: Bike, desc: 'Fast, for small packages' },
  { id: 'car', label: 'Car', icon: Car, desc: 'Bigger loads, AC comfort' },
  { id: 'van', label: 'Van', icon: Truck, desc: 'Bulk & business deliveries' },
]
const FIELDS = [
  { key: 'base', label: 'Base fare', hint: 'Flat starting charge, before distance/time' },
  { key: 'perKm', label: 'Per km', hint: 'Added for every kilometre travelled' },
  { key: 'perMinute', label: 'Per minute', hint: 'Added for every minute the trip takes' },
]

export default function AdminSettings() {
  const [pricing, setPricing] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get('/api/settings/pricing')
      .then(({ pricing }) => {
        setPricing(pricing)
        setForm(pricing)
      })
      .finally(() => setLoading(false))
  }, [])

  function setField(vehicle, field, value) {
    setForm((f) => ({ ...f, [vehicle]: { ...f[vehicle], [field]: value } }))
  }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const { pricing: updated } = await api.patch('/api/settings/pricing', form)
      setPricing(updated)
      setForm(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-muted">Loading…</p>

  const hasChanges =
    pricing && VEHICLE_META.some((v) => FIELDS.some((f) => Number(form[v.id]?.[f.key]) !== pricing[v.id]?.[f.key]))

  function sampleFare(vehicle) {
    const rates = form[vehicle] || {}
    const base = Number(rates.base) || 0
    const perKm = Number(rates.perKm) || 0
    const perMinute = Number(rates.perMinute) || 0
    return Math.round(base + perKm * 5 + perMinute * 15)
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Settings</h1>
      <p className="mt-1 text-sm text-slate-muted">
        Fares are calculated per delivery from real distance and estimated time — set the rates that formula uses for
        each vehicle type. Useful to adjust as fuel prices change.
      </p>

      <form onSubmit={save} className="mt-6 max-w-2xl space-y-4">
        {VEHICLE_META.map((v) => (
          <Card key={v.id}>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100">
                <v.icon size={20} className="text-amber-600" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy-950">{v.label}</p>
                <p className="text-xs text-slate-muted">{v.desc}</p>
              </div>
              <p className="shrink-0 text-xs text-slate-muted">
                ~5km/15min trip: <span className="font-bold text-navy-950">{formatNaira(sampleFare(v.id))}</span>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium text-navy-900/60">{f.label}</span>
                  <div className="flex items-center gap-1 rounded-xl border border-navy-900/12 bg-white px-2.5 py-2">
                    <span className="text-xs font-semibold text-navy-900/40">₦</span>
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={form[v.id]?.[f.key] ?? ''}
                      onChange={(e) => setField(v.id, f.key, e.target.value)}
                      className="w-full bg-transparent text-sm font-semibold text-navy-950 outline-none"
                    />
                  </div>
                </label>
              ))}
            </div>
          </Card>
        ))}

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <Button type="submit" disabled={saving || !hasChanges}>
          {saved ? (
            <>
              <Check size={16} /> Saved
            </>
          ) : saving ? (
            'Saving…'
          ) : (
            'Save pricing'
          )}
        </Button>
      </form>
    </div>
  )
}
