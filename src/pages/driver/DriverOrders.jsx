import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Package } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, StatusBadge, EmptyState } from '../../components/ui/Misc'
import LoadMoreButton from '../../components/ui/LoadMoreButton'
import { formatNaira, formatDate } from '../../utils/format'
import { PLATFORM_FEE_PCT } from '../../data/mock'

const FILTERS = [
  { label: 'All', status: 'all' },
  { label: 'Delivered', status: 'completed' },
  { label: 'Cancelled', status: 'cancelled' },
]
const PAGE_SIZE = 15

export default function DriverOrders() {
  const [orders, setOrders] = useState([])
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const navigate = useNavigate()

  async function load(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const qs = new URLSearchParams({ status: filter, search: query, page, pageSize: PAGE_SIZE }).toString()
    const { orders: rows, total: newTotal } = await api.get(`/api/orders?${qs}`)
    setOrders((prev) => (append ? [...prev, ...rows] : rows))
    setTotal(newTotal)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    const t = setTimeout(() => load(1, false), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, query])

  return (
    <div className="px-5 pt-6 md:px-0">
      <h1 className="text-xl font-extrabold text-navy-950">Trip history</h1>
      <p className="mt-1 text-sm text-slate-muted">Every delivery you've accepted, with your earnings.</p>

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
        <Search size={16} className="text-slate-muted" strokeWidth={2} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by trip ID or address"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-navy-900/35"
        />
      </div>

      <div className="mt-4 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.status}
            onClick={() => setFilter(f.status)}
            className={`tap rounded-full px-4 py-2 text-sm font-semibold ${
              filter === f.status ? 'bg-navy-900 text-white' : 'bg-white text-navy-900/60 shadow-[var(--shadow-card)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3 pb-6">
        {loading ? (
          <p className="text-sm text-slate-muted">Loading…</p>
        ) : orders.length === 0 ? (
          <EmptyState icon={Package} title="No trips found" desc="Trips you accept will show up here." />
        ) : (
          orders.map((o) => {
            const earning = o.status === 'completed' ? Math.round(o.price * (1 - PLATFORM_FEE_PCT)) : o.price
            return (
              <Card key={o.id} onClick={() => navigate(`/driver/orders/${o.id}`)} className="tap cursor-pointer">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
                    <Package size={18} className="text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy-950">{o.pickup} → {o.dropoff}</p>
                    <p className="text-xs text-slate-muted">{o.id} · {formatDate(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-navy-950">{formatNaira(earning)}</p>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              </Card>
            )
          })
        )}
        {!loading && orders.length > 0 && (
          <LoadMoreButton shown={orders.length} total={total} loading={loadingMore} onClick={() => load(Math.floor(orders.length / PAGE_SIZE) + 1, true)} />
        )}
      </div>
    </div>
  )
}
