import { useEffect, useState } from 'react'
import { Search, Ban, CheckCircle2 } from 'lucide-react'
import { api } from '../../lib/api'
import { formatNaira, formatDate } from '../../utils/format'
import { Avatar, Card } from '../../components/ui/Misc'
import LoadMoreButton from '../../components/ui/LoadMoreButton'

const PAGE_SIZE = 20

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  async function load(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const qs = new URLSearchParams({ role: 'customer', status, search, page, pageSize: PAGE_SIZE }).toString()
    const { users: rows, total: newTotal } = await api.get(`/api/admin/users?${qs}`)
    setUsers((prev) => (append ? [...prev, ...rows] : rows))
    setTotal(newTotal)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    const t = setTimeout(() => load(1, false), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  async function toggleStatus(user) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active'
    await api.patch(`/api/admin/users/${user.id}/status`, { status: nextStatus })
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)))
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Customers</h1>
      <p className="mt-1 text-sm text-slate-muted">Everyone who has signed up to send deliveries.</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <Search size={16} className="text-slate-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, or email" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-navy-900/10 bg-white px-4 py-3 text-sm font-medium">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-muted">Loading…</p>
        ) : users.length === 0 ? (
          <Card className="text-center text-sm text-slate-muted">No customers found.</Card>
        ) : (
          users.map((u) => (
            <Card key={u.id} className="flex items-center gap-3">
              <Avatar name={u.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy-950">{u.name}</p>
                <p className="truncate text-xs text-slate-muted">{u.phone} · {u.email || 'No email'}</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-navy-950">{formatNaira(u.walletBalance)}</p>
                <p className="text-xs text-slate-muted">since {formatDate(u.createdAt)}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {u.status}
              </span>
              <button
                onClick={() => toggleStatus(u)}
                className={`tap flex h-9 w-9 items-center justify-center rounded-full ${u.status === 'active' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}
                title={u.status === 'active' ? 'Suspend account' : 'Reactivate account'}
              >
                {u.status === 'active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
              </button>
            </Card>
          ))
        )}
        {!loading && (
          <LoadMoreButton
            shown={users.length}
            total={total}
            loading={loadingMore}
            onClick={() => load(Math.floor(users.length / PAGE_SIZE) + 1, true)}
          />
        )}
      </div>
    </div>
  )
}
