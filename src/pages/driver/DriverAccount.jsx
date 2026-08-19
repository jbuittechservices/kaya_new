import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { LogOut, ChevronRight, Check, Camera, Package, Star, Upload, FileCheck2, Clock, UserCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar, Card } from '../../components/ui/Misc'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { api, BASE_URL, getToken, avatarSrc } from '../../lib/api'
import NotificationsToggle from '../../components/ui/NotificationsToggle'
import { VEHICLE_OPTIONS } from '../../data/mock'
import { VEHICLE_ICONS } from '../../lib/icons'

const TABS = [
  { id: 'profile', label: 'Profile' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'documents', label: 'Documents' },
  { id: 'guarantor', label: 'Guarantor' },
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
        <Avatar name={user?.name} size={56} src={avatarSrc(user?.avatarUrl)} />
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
        {tab === 'profile' && <ProfileTab user={user} updateProfile={updateProfile} refreshUser={refreshUser} />}
        {tab === 'vehicle' && <VehicleTab user={user} refreshUser={refreshUser} />}
        {tab === 'documents' && <DocumentsTab user={user} refreshUser={refreshUser} />}
        {tab === 'guarantor' && <GuarantorTab user={user} refreshUser={refreshUser} />}
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

function ProfileTab({ user, updateProfile, refreshUser }) {
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' })
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
      await updateProfile(form)
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
  const [form, setForm] = useState({ vehicle: user?.riderVehicle || '', plate: user?.riderPlate || '', vehicleType: user?.vehicleType || '' })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!form.vehicleType) {
      setError('Select a vehicle type — this determines which delivery requests you receive.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await api.patch('/api/drivers/vehicle', form)
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err.message)
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

      <div>
        <p className="mb-2 text-sm font-bold text-navy-950">Vehicle type</p>
        <p className="mb-2.5 text-xs text-slate-muted">This determines which delivery requests you'll be offered — required before you can go online.</p>
        <div className="grid grid-cols-3 gap-2.5">
          {VEHICLE_OPTIONS.map((v) => {
            const Icon = VEHICLE_ICONS[v.id]
            const active = form.vehicleType === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setForm({ ...form, vehicleType: v.id })}
                className={`tap flex flex-col items-center gap-1.5 rounded-2xl border py-3 ${active ? 'border-amber-500 bg-amber-100' : 'border-navy-900/10 bg-white'}`}
              >
                <Icon size={20} className="text-navy-900" strokeWidth={1.7} />
                <span className="text-xs font-semibold text-navy-900">{v.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Input label="Vehicle" placeholder="e.g. Bajaj Boxer · Red" value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} />
      <Input label="Plate number" placeholder="e.g. KJA 442 XL" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
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

function GuarantorTab({ user, refreshUser }) {
  const [form, setForm] = useState({
    name: user?.guarantorName || '',
    phone: user?.guarantorPhone || '',
    relationship: user?.guarantorRelationship || '',
    address: user?.guarantorAddress || '',
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const submitted = !!(user?.guarantorName && user?.guarantorPhone)
  const verified = !!user?.onboarding?.guarantor

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.patch('/api/drivers/guarantor', form)
      await refreshUser()
      setSaved(true)
      setTimeout(() => setSaved(false), 1800)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck size={16} className="text-navy-900/60" />
          <p className="text-sm font-bold text-navy-950">Guarantor status</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-success/10 text-success' : submitted ? 'bg-amber-100 text-amber-700' : 'bg-navy-900/8 text-navy-900/50'}`}>
          {verified ? 'Verified' : submitted ? 'Pending review' : 'Not submitted'}
        </span>
      </Card>
      <p className="text-xs text-slate-muted">
        A guarantor is someone who can vouch for you — Kaya's team may contact them as part of verifying your account.
      </p>
      <Input label="Guarantor's full name" placeholder="e.g. Adaeze Okonkwo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Input label="Guarantor's phone number" type="tel" placeholder="080X XXX XXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <Input label="Relationship" placeholder="e.g. Uncle, Former employer" value={form.relationship} onChange={(e) => setForm({ ...form, relationship: e.target.value })} />
      <Input label="Guarantor's address" placeholder="Street, area, city" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      {error && <p className="text-sm font-medium text-danger">{error}</p>}
      <Button type="submit" full disabled={busy}>
        {saved ? (
          <>
            <Check size={16} /> Saved
          </>
        ) : busy ? (
          'Saving…'
        ) : (
          'Save guarantor details'
        )}
      </Button>
    </form>
  )
}

const DOC_TYPES = [
  { id: 'id', label: 'Government-issued ID', desc: "National ID, driver's license, or international passport" },
  { id: 'license', label: "Driver's license", desc: 'A clear photo or scan of a valid license' },
]

function DocumentsTab({ user, refreshUser }) {
  const [uploading, setUploading] = useState(null)
  const [error, setError] = useState(null)
  const documents = user?.documents || {}
  const verified = !!user?.onboarding?.documents

  async function handleFile(type, file) {
    if (!file) return
    setError(null)
    setUploading(type)
    try {
      const form = new FormData()
      // 'type' must be appended before 'file' — the server reads it while streaming
      // the upload and uses it to name the file as it's written to disk.
      form.append('type', type)
      form.append('file', file)
      const res = await fetch(`${BASE_URL}/api/drivers/documents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Upload failed')
      await refreshUser()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-navy-950">Verification status</p>
          <p className="text-xs text-slate-muted">Reviewed by the Kaya team after both documents are submitted</p>
        </div>
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'}`}>
          {verified ? <FileCheck2 size={13} /> : <Clock size={13} />} {verified ? 'Verified' : 'Pending review'}
        </span>
      </Card>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {DOC_TYPES.map((doc) => {
        const uploaded = documents[doc.id]
        const isUploading = uploading === doc.id
        return (
          <Card key={doc.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy-950">{doc.label}</p>
                <p className="text-xs text-slate-muted">{doc.desc}</p>
                {uploaded && <p className="mt-1 text-xs font-medium text-success">Uploaded — {new Date(uploaded.uploadedAt).toLocaleDateString()}</p>}
              </div>
              <label className="tap flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl border border-navy-900/15 px-3.5 py-2.5 text-xs font-semibold text-navy-900">
                {isUploading ? (
                  'Uploading…'
                ) : (
                  <>
                    <Upload size={14} /> {uploaded ? 'Replace' : 'Upload'}
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="hidden"
                  disabled={isUploading}
                  onChange={(e) => handleFile(doc.id, e.target.files?.[0])}
                />
              </label>
            </div>
          </Card>
        )
      })}
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
    </div>
  )
}
