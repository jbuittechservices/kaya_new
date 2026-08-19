import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { ArrowLeft, Package } from 'lucide-react'
import { initials } from '../../utils/format'

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ${className}`} {...props}>
      {children}
    </div>
  )
}

const STATUS_STYLE = {
  completed: 'bg-success/10 text-success',
  delivered: 'bg-amber-500/15 text-amber-600',
  in_transit: 'bg-amber-500/15 text-amber-600',
  enroute: 'bg-amber-500/15 text-amber-600',
  arrived: 'bg-amber-500/15 text-amber-600',
  searching: 'bg-navy-900/8 text-navy-700',
  cancelled: 'bg-danger/10 text-danger',
  pending: 'bg-navy-900/8 text-navy-700',
}

const STATUS_LABEL = {
  completed: 'Delivered',
  delivered: 'Awaiting your confirmation',
  in_transit: 'In transit',
  enroute: 'Rider en route',
  arrived: 'Rider arrived',
  searching: 'Finding rider',
  cancelled: 'Cancelled',
  pending: 'Pending',
}

export function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[status] || STATUS_STYLE.pending}`}>
      {STATUS_LABEL[status] || status}
    </span>
  )
}

export function BackHeader({ title, subtitle, onBack, right, transparent, avatar }) {
  const navigate = useNavigate()
  return (
    <div className={`safe-top flex items-center gap-3 px-5 pb-3 pt-5 ${transparent ? '' : 'bg-cream-100'}`}>
      <button
        onClick={() => (onBack ? onBack() : navigate(-1))}
        className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)]"
        aria-label="Go back"
      >
        <ArrowLeft size={18} strokeWidth={2.2} color="#0A0A0A" />
      </button>
      {avatar}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold text-navy-950">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Avatar({ name, size = 44, tone = 'amber', src }) {
  const [imgFailed, setImgFailed] = useState(false)
  const bg = tone === 'amber' ? 'bg-amber-500 text-navy-950' : 'bg-navy-900 text-white'

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={name || 'Profile picture'}
        onError={() => setImgFailed(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${bg}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(name) || '?'}
    </div>
  )
}

export function EmptyState({ icon: Icon = Package, title, desc, action }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-navy-900/5">
        <Icon size={32} strokeWidth={1.6} className="text-navy-900/50" />
      </div>
      <h3 className="text-lg font-bold text-navy-950">{title}</h3>
      {desc && <p className="mt-1.5 max-w-xs text-sm text-slate-muted">{desc}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
