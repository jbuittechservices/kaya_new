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

  const hasChanges = pricing && VEHICLE_META.some((v) => Number(form[v.id]) !== pricing[v.id])

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Settings</h1>
      <p className="mt-1 text-sm text-slate-muted">Set what customers are charged for each vehicle type.</p>

      <form onSubmit={save} className="mt-6 max-w-lg space-y-3">
        {VEHICLE_META.map((v) => (
          <Card key={v.id} className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <v.icon size={20} className="text-amber-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-950">{v.label}</p>
              <p className="text-xs text-slate-muted">{v.desc}</p>
            </div>
            <div className="flex w-32 shrink-0 items-center gap-1.5 rounded-xl border border-navy-900/12 bg-white px-3 py-2.5">
              <span className="text-sm font-semibold text-navy-900/50">₦</span>
              <input
                type="number"
                min={100}
                step={50}
                value={form[v.id] ?? ''}
                onChange={(e) => setForm({ ...form, [v.id]: e.target.value })}
                className="w-full bg-transparent text-sm font-semibold text-navy-950 outline-none"
              />
            </div>
          </Card>
        ))}

        {error && <p className="text-sm font-medium text-danger">{error}</p>}

        <div className="flex items-center gap-3 pt-2">
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
          {pricing && (
            <p className="text-xs text-slate-muted">
              Current: {VEHICLE_META.map((v) => `${v.label} ${formatNaira(pricing[v.id])}`).join(' · ')}
            </p>
          )}
        </div>
      </form>
    </div>
  )
}
