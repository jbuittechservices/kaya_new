import { useEffect, useState } from 'react'
import { Search, Ban, CheckCircle2, BadgeCheck, Star } from 'lucide-react'
import { api } from '../../lib/api'
import { Avatar, Card } from '../../components/ui/Misc'
import LoadMoreButton from '../../components/ui/LoadMoreButton'

const PAGE_SIZE = 20

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  async function load(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const qs = new URLSearchParams({ role: 'driver', search, page, pageSize: PAGE_SIZE }).toString()
    const { users, total: newTotal } = await api.get(`/api/admin/users?${qs}`)
    setDrivers((prev) => (append ? [...prev, ...users] : users))
    setTotal(newTotal)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    const t = setTimeout(() => load(1, false), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function toggleStatus(user) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active'
    await api.patch(`/api/admin/users/${user.id}/status`, { status: nextStatus })
    setDrivers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)))
  }

  async function verify(user) {
    await api.patch(`/api/admin/users/${user.id}/verify-driver`)
    setDrivers((prev) => prev.map((u) => (u.id === user.id ? { ...u, onboarding: { personalInfo: true, documents: true, guarantor: true } } : u)))
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Riders</h1>
      <p className="mt-1 text-sm text-slate-muted">Everyone onboarded to deliver on Kaya.</p>

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
        <Search size={16} className="text-slate-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-muted">Loading…</p>
        ) : drivers.length === 0 ? (
          <Card className="text-center text-sm text-slate-muted">No riders found.</Card>
        ) : (
          drivers.map((u) => {
            const verified = u.onboarding?.personalInfo && u.onboarding?.documents && u.onboarding?.guarantor
            return (
              <Card key={u.id} className="flex flex-wrap items-center gap-3">
                <Avatar name={u.name} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-navy-950">{u.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-muted">
                    <Star size={12} className="fill-[#FFB800] text-[#FFB800]" /> {u.riderRating} · {u.riderTrips} trips · {u.phone}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'}`}>
                  {verified ? 'Verified' : 'Pending verification'}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                  {u.status}
                </span>
                {!verified && (
                  <button onClick={() => verify(u)} className="tap flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white">
                    <BadgeCheck size={14} /> Verify
                  </button>
                )}
                <button
                  onClick={() => toggleStatus(u)}
                  className={`tap flex h-9 w-9 items-center justify-center rounded-full ${u.status === 'active' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}
                  title={u.status === 'active' ? 'Suspend account' : 'Reactivate account'}
                >
                  {u.status === 'active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                </button>
              </Card>
            )
          })
        )}
        {!loading && (
          <LoadMoreButton
            shown={drivers.length}
            total={total}
            loading={loadingMore}
            onClick={() => load(Math.floor(drivers.length / PAGE_SIZE) + 1, true)}
          />
        )}
      </div>
    </div>
  )
}
