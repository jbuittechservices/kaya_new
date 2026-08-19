import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Bike, LogOut, ChevronRight, Check, Camera, Plus } from 'lucide-react'
import { LOCATION_ICONS, MapPin } from '../../lib/icons'
import { api, BASE_URL, getToken, avatarSrc } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { Avatar, Card } from '../../components/ui/Misc'
import Input from '../../components/ui/Input'
import PlacesAutocompleteInput from '../../components/ui/PlacesAutocomplete'
import Button from '../../components/ui/Button'
import NotificationsToggle from '../../components/ui/NotificationsToggle'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'locations', label: 'Saved locations' },
  { id: 'security', label: 'Privacy & security' },
]

export default function Account() {
  const { tab: routeTab } = useParams()
  const [tab, setTab] = useState(routeTab && TABS.some((t) => t.id === routeTab) ? routeTab : 'profile')
  const { user, logout, updateProfile } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="px-5 pt-6 pb-8 md:px-0">
      <div className="mb-6 flex items-center gap-3">
        <Avatar name={user?.name} size={56} src={avatarSrc(user?.avatarUrl)} />
        <div>
          <h1 className="text-lg font-extrabold text-navy-950">{user?.name}</h1>
          <p className="text-sm text-slate-muted">{user?.email}</p>
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
        {tab === 'locations' && <LocationsTab />}
        {tab === 'security' && <SecurityTab />}
      </div>

      <div className="mt-8 space-y-2">
        <Link to="/driver/signin" className="tap flex items-center justify-between rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <span className="flex items-center gap-2 text-sm font-semibold text-navy-950">
            <Bike size={17} /> Ride and earn with Kaya
          </span>
          <ChevronRight size={18} className="text-navy-900/40" />
        </Link>
        <button
          onClick={() => {
            logout()
            navigate('/')
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
  const { refreshUser } = useAuth()
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', email: user?.email || '' })
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState(null)

  async function apply(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateProfile({ name: form.name, email: form.email })
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleAvatarChange(file) {
    if (!file) return
    setAvatarError(null)
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE_URL}/api/auth/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      await refreshUser()
    } catch (err) {
      setAvatarError(err.message)
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <form onSubmit={apply} className="space-y-4">
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
        <Avatar name={user?.name} size={56} src={avatarSrc(user?.avatarUrl)} />
        <div className="min-w-0">
          <label className="tap flex w-fit cursor-pointer items-center gap-1.5 text-sm font-semibold text-navy-950">
            <Camera size={15} /> {avatarUploading ? 'Uploading…' : user?.avatarUrl ? 'Change photo' : 'Upload image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={avatarUploading}
              onChange={(e) => handleAvatarChange(e.target.files?.[0])}
            />
          </label>
          <p className="text-xs text-slate-muted">Min 400×400px, PNG or JPEG</p>
          {avatarError && <p className="mt-1 text-xs font-medium text-danger">{avatarError}</p>}
        </div>
      </div>
      <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Input label="Phone number" value={form.phone} disabled className="opacity-60" />
      <Input label="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" full onClick={() => setForm({ name: user?.name || '', phone: user?.phone || '', email: user?.email || '' })}>
          Discard
        </Button>
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
      </div>
    </form>
  )
}

function LocationsTab() {
  const { savedLocations, addSavedLocation } = useAppData()
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ label: '', address: '', lat: null, lng: null })
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.label || !form.address) return
    setBusy(true)
    try {
      await addSavedLocation(form)
      setForm({ label: '', address: '', lat: null, lng: null })
      setAdding(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {savedLocations.map((loc) => {
        const Icon = LOCATION_ICONS[loc.icon] || MapPin
        return (
          <Card key={loc.id} className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Icon size={18} className="text-amber-700" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-950">{loc.label}</p>
              <p className="truncate text-xs text-slate-muted">{loc.address}</p>
            </div>
          </Card>
        )
      })}

      {adding ? (
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
          <Input label="Label" placeholder="e.g. Mum's house" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-navy-900/80">Address</span>
            <div className="flex items-center rounded-2xl border border-navy-900/12 bg-white px-4 py-3.5">
              <PlacesAutocompleteInput
                value={form.address}
                onChange={(address) => setForm((f) => ({ ...f, address }))}
                onSelect={({ address, lat, lng }) => setForm((f) => ({ ...f, address, lat, lng }))}
                placeholder="Street, area, city"
                className="w-full bg-transparent text-sm text-navy-950 outline-none placeholder:text-navy-900/35"
              />
            </div>
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" full onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" full disabled={busy}>
              {busy ? 'Saving…' : 'Save location'}
            </Button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAdding(true)} className="tap flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-navy-900/20 py-4 text-sm font-semibold text-navy-900/60">
          <Plus size={16} /> Add a new saved location
        </button>
      )}
    </div>
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
    <div className="space-y-5">
      <NotificationsToggle />
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

      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-navy-950">Two-factor authentication</p>
          <p className="text-xs text-slate-muted">Add an extra layer of security</p>
        </div>
        <span className="rounded-full bg-navy-900/8 px-2.5 py-1 text-xs font-semibold text-navy-900/60">Off</span>
      </Card>
    </div>
  )
}
