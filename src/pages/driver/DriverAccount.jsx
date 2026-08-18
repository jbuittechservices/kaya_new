import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { LogOut, ChevronRight, Check, Camera, Package, Star } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Card } from '../../components/ui/Misc'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { api } from '../../lib/api'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'security', label: 'Privacy & security' },
]

export default function DriverAccount() {
  const { tab: routeTab } = useParams()
  const [tab, setTab] = useState(routeTab && TABS.some((t) => t.id === routeTab) ? routeTab : 'profile')
  const { user, logout, updateProfile, refreshUser } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="px-5 pt-6 pb-8 md:px-0">
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={user?.name} size={56} />
        <div>
          <h1 className="text-lg font-extrabold text-navy-950">{user?.name}</h1>
          <p className="flex items-center gap-1 text-sm text-slate-muted">
            <Star size={13} className="fill-[#FFB800] text-[#FFB800]" /> {user?.riderRating} · {user?.riderTrips} trips
          </p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar border-b border-navy-900/8 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${tab === t.id ? 'bg-navy-900 text-white' : 'text-navy-900/55 hover:bg-navy-900/5'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'profile' && <ProfileTab user={user} updateProfile={updateProfile} />}
        {tab === 'vehicle' && <VehicleTab user={user} refreshUser={refreshUser} />}
        {tab === 'security' && <SecurityTab />}
      </div>

      <div className="mt-8 space-y-2">
        <Link to="/signin" className="tap flex items-center justify-between rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy-950">
            <Package size={17} /> Send a package instead
          </span>
          <ChevronRight size={18} className="text-navy-900/40" />
        </Link>
        <button
          onClick={() => {
            logout()
            navigate('/driver/signin')
          }}
          className="tap flex w-full items-center justify-between rounded-2xl bg-white p-4 text-left shadow-[var(--shadow-card)]"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-danger">
            <LogOut size={17} /> Log out
          </span>
          <ChevronRight size={18} className="text-danger/50" />
        </button>
      </div>
    </div>
  )
}

function ProfileTab({ user, updateProfile }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function apply(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateProfile(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={apply} className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
        <Avatar name={user?.name} size={56} />
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-navy-950">
            <Camera size={15} /> Upload image
          </p>
          <p className="text-xs text-slate-muted">Min 400×400px, PNG or JPEG</p>
        </div>
      </div>
      <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Input label="Phone number" value={user?.phone || ''} disabled className="opacity-60" />
      <Input label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full disabled={busy}>
        {saved ? (
          <>
            <Check size={16} /> Saved
          </>
        ) : busy ? (
          'Saving…'
        ) : (
          'Apply changes'
        )}
      </Button>
    </form>
  )
}

function VehicleTab({ user, refreshUser }) {
  const [form, setForm] = useState({ vehicle: user?.riderVehicle || '', plate: user?.riderPlate || '' })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch('/api/drivers/vehicle', form)
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card>
        <p className="mb-3 text-sm font-bold text-navy-950">Verification status</p>
        {['personalInfo', 'documents', 'guarantor'].map((key) => {
          const done = !!user?.onboarding?.[key]
          const labels = { personalInfo: 'Personal information', documents: 'Document verification', guarantor: 'Guarantor details' }
          return (
            <div key={key} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-navy-900/70">{labels[key]}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${done ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'}`}>
                {done ? 'Verified' : 'Pending'}
              </span>
            </div>
          )
        })}
      </Card>
      <Input label="Vehicle" placeholder="e.g. Bajaj Boxer · Red" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
      <Input label="Plate number" placeholder="e.g. KJA 442 XL" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
      <Button type="submit" full disabled={busy}>
        {saved ? (
          <>
            <Check size={16} /> Saved
          </>
        ) : busy ? (
          'Saving…'
        ) : (
          'Save vehicle details'
        )}
      </Button>
    </form>
  )
}

function SecurityTab() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [status, setStatus] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (form.next !== form.confirm) {
      setStatus({ type: 'error', text: 'New passwords do not match' })
      return
    }
    setBusy(true)
    setStatus(null)
    try {
      await api.post('/api/auth/change-password', { currentPassword: form.current, newPassword: form.next })
      setStatus({ type: 'success', text: 'Password updated successfully' })
      setForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      setStatus({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-sm font-bold text-navy-950">Change password</p>
      <Input label="Current password" type="password" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} required />
      <Input label="New password" type="password" value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} required minLength={8} />
      <Input label="Confirm new password" type="password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} required />
      {status && <p className={`text-sm font-medium ${status.type === 'error' ? 'text-danger' : 'text-success'}`}>{status.text}</p>}
      <Button type="submit" full disabled={busy}>
        {busy ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
