import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, MessageCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { BackHeader, StatusBadge, Avatar } from '../../components/ui/Misc'
import LiveMap from '../../components/ui/LiveMap'
import { formatNaira, formatDate, formatTime } from '../../utils/format'
import { PACKAGE_CATEGORIES, PLATFORM_FEE_PCT } from '../../data/mock'
import { CATEGORY_ICONS } from '../../lib/icons'

export default function DriverOrderDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .get(`/api/orders/${id}`)
      .then((res) => alive && setData(res))
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="px-5 pt-6">
        <BackHeader title="Loading…" />
      </div>
    )
  }

  if (!data?.order) {
    return (
      <div className="px-5 pt-6">
        <BackHeader title="Trip not found" />
      </div>
    )
  }

  const { order } = data
  const category = PACKAGE_CATEGORIES.find((c) => c.id === order.category)
  const CategoryIcon = CATEGORY_ICONS[order.category]
  const earning = order.status === 'delivered' ? Math.round(order.price * (1 - PLATFORM_FEE_PCT)) : null
  const fee = order.status === 'delivered' ? order.price - earning : null

  return (
    <div className="min-h-screen pb-10">
      <BackHeader title={order.id} subtitle={formatDate(order.createdAt)} right={<StatusBadge status={order.status} />} />

      <LiveMap
        pickup={{ lat: order.pickupLat, lng: order.pickupLng }}
        dropoff={{ lat: order.dropoffLat, lng: order.dropoffLng }}
        className="mx-5 h-40 rounded-3xl"
      />

      <div className="mt-5 space-y-4 px-5">
        <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
          <Row label="Pickup" value={order.pickup} />
          <div className="my-3 h-px bg-navy-900/8" />
          <Row label="Destination" value={order.dropoff} />
          <div className="my-3 h-px bg-navy-900/8" />
          <Row
            label="Package"
            value={
              <span className="flex items-center gap-1.5">
                {CategoryIcon && <CategoryIcon size={14} />} {category?.label || 'Parcel'}
              </span>
            }
          />
          <div className="my-3 h-px bg-navy-900/8" />
          <Row label="Time" value={formatTime(order.createdAt)} />
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <Avatar name="Customer" size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-navy-950">Customer</p>
              <p className="text-xs text-slate-muted">{order.senderPhone || 'Contact via chat'}</p>
            </div>
            <div className="flex gap-2">
              <a
                href={order.senderPhone ? `tel:${order.senderPhone}` : undefined}
                className={`tap flex h-9 w-9 items-center justify-center rounded-full bg-navy-900/5 ${!order.senderPhone ? 'pointer-events-none opacity-40' : ''}`}
              >
                <Phone size={15} className="text-navy-900" />
              </a>
              <button onClick={() => navigate('/driver/messages')} className="tap flex h-9 w-9 items-center justify-center rounded-full bg-navy-900/5">
                <MessageCircle size={15} className="text-navy-900" />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-muted">Delivery fee</span>
            <span className="font-semibold text-navy-950">{formatNaira(order.price)}</span>
          </div>
          {earning != null && (
            <>
              <div className="flex justify-between py-1 text-sm">
                <span className="text-slate-muted">Platform fee</span>
                <span className="font-semibold text-danger">-{formatNaira(fee)}</span>
              </div>
              <div className="my-2 h-px bg-navy-900/8" />
              <div className="flex justify-between py-1 text-sm">
                <span className="font-semibold text-navy-950">Your earning</span>
                <span className="font-extrabold text-success">{formatNaira(earning)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-muted">Payment method</span>
            <span className="font-semibold capitalize text-navy-950">{order.paymentMethod}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-muted">{label}</span>
      <span className="max-w-[65%] truncate text-right text-sm font-semibold text-navy-950">{value}</span>
    </div>
  )
}
