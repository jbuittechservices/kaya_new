import { useEffect, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react'
import { api } from '../../lib/api'
import { Card, EmptyState } from '../../components/ui/Misc'
import { formatNaira, formatDate } from '../../utils/format'
import LoadMoreButton from '../../components/ui/LoadMoreButton'

const PAGE_SIZE = 30

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  async function load(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const qs = new URLSearchParams({ page, pageSize: PAGE_SIZE }).toString()
    const { transactions: rows, total: newTotal } = await api.get(`/api/admin/transactions?${qs}`)
    setTransactions((prev) => (append ? [...prev, ...rows] : rows))
    setTotal(newTotal)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    load(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Transactions</h1>
      <p className="mt-1 text-sm text-slate-muted">Every wallet credit and debit across the platform.</p>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-muted">Loading…</p>
        ) : transactions.length === 0 ? (
          <EmptyState icon={Receipt} title="No transactions yet" />
        ) : (
          transactions.map((t) => (
            <Card key={t.id} className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.type === 'credit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {t.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-950">{t.label}</p>
                <p className="text-xs text-slate-muted">
                  {t.user?.name || 'Unknown user'} · {formatDate(t.createdAt)}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.status === 'successful' ? 'bg-success/10 text-success' : t.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-danger/10 text-danger'}`}>
                {t.status}
              </span>
              <p className={`text-sm font-bold ${t.type === 'credit' ? 'text-success' : 'text-navy-950'}`}>
                {t.type === 'credit' ? '+' : '-'}
                {formatNaira(t.amount)}
              </p>
            </Card>
          ))
        )}
        {!loading && transactions.length > 0 && (
          <LoadMoreButton
            shown={transactions.length}
            total={total}
            loading={loadingMore}
            onClick={() => load(Math.floor(transactions.length / PAGE_SIZE) + 1, true)}
          />
        )}
      </div>
    </div>
  )
}
