import { useEffect, useState } from 'react'
import { Users, Bike, Package, TrendingUp, Wallet, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { formatNaira } from '../../utils/format'
import { Card } from '../../components/ui/Misc'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/api/admin/stats').then(setStats).catch(() => {})
  }, [])

  if (!stats) return <p className="text-sm text-slate-muted">Loading dashboard…</p>

  const maxRevenue = Math.max(...stats.last7.map((d) => d.revenue), 1)

  const cards = [
    { label: 'Customers', value: stats.users, icon: Users },
    { label: 'Riders', value: `${stats.activeDrivers}/${stats.drivers}`, sub: 'active / total', icon: Bike },
    { label: 'Active deliveries', value: stats.activeOrders, icon: Package },
    { label: 'Completed', value: stats.deliveredOrders, icon: TrendingUp },
    { label: 'Platform revenue', value: formatNaira(stats.platformRevenue), icon: Wallet },
    { label: 'Cancelled', value: stats.cancelledOrders, icon: XCircle },
  ]

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-muted">A live snapshot of the Kaya platform.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-muted">{c.label}</p>
              <p className="mt-1 text-xl font-extrabold text-navy-950">{c.value}</p>
              {c.sub && <p className="text-[11px] text-slate-muted">{c.sub}</p>}
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100">
              <c.icon size={16} className="text-amber-600" />
            </span>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <p className="text-sm font-bold text-navy-950">Revenue — last 7 days</p>
        <div className="mt-6 flex h-40 items-end gap-3">
          {stats.last7.length === 0 && <p className="text-sm text-slate-muted">No orders yet this week.</p>}
          {stats.last7.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-amber-500"
                style={{ height: `${Math.max(6, (d.revenue / maxRevenue) * 100)}%` }}
                title={formatNaira(d.revenue)}
              />
              <span className="text-[10px] text-slate-muted">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
