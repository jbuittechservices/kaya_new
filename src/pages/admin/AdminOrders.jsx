import { useEffect, useState } from 'react'
import { Search, Package } from 'lucide-react'
import { api } from '../../lib/api'
import { StatusBadge, Card, EmptyState } from '../../components/ui/Misc'
import { formatNaira, formatDate } from '../../utils/format'
import LoadMoreButton from '../../components/ui/LoadMoreButton'

const STATUSES = ['all', 'searching', 'enroute', 'arrived', 'in_transit', 'delivered', 'completed', 'cancelled']
const PAGE_SIZE = 20

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  async function load(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const qs = new URLSearchParams({ status, search, page, pageSize: PAGE_SIZE }).toString()
    const { orders: rows, total: newTotal } = await api.get(`/api/admin/orders?${qs}`)
    setOrders((prev) => (append ? [...prev, ...rows] : rows))
    setTotal(newTotal)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    const t = setTimeout(() => load(1, false), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status])

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Orders</h1>
      <p className="mt-1 text-sm text-slate-muted">Every delivery request across the platform.</p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
          <Search size={16} className="text-slate-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by order ID or address" className="flex-1 bg-transparent text-sm outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-navy-900/10 bg-white px-4 py-3 text-sm font-medium capitalize">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'all' ? 'All statuses' : s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-muted">Loading…</p>
        ) : orders.length === 0 ? (
          <EmptyState icon={Package} title="No orders found" desc="Try a different filter or search term." />
        ) : (
          orders.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                <Package size={16} className="text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-navy-950">{o.pickup} → {o.dropoff}</p>
                <p className="text-xs text-slate-muted">
                  {o.id} · {formatDate(o.createdAt)} · {o.customer?.name || 'Unknown customer'}
                  {o.rider ? ` · rider: ${o.rider.name}` : ''}
                </p>
              </div>
              <p className="text-sm font-bold text-navy-950">{formatNaira(o.price)}</p>
              <StatusBadge status={o.status} />
            </Card>
          ))
        )}
        {!loading && orders.length > 0 && (
          <LoadMoreButton
            shown={orders.length}
            total={total}
            loading={loadingMore}
            onClick={() => load(Math.floor(orders.length / PAGE_SIZE) + 1, true)}
          />
        )}
      </div>
    </div>
  )
}
