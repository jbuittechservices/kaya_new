import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { api, avatarSrc } from '../../lib/api'
import { useAppData } from '../../context/AppDataContext'
import { BackHeader, StatusBadge, Avatar } from '../../components/ui/Misc'
import LiveMap from '../../components/ui/LiveMap'
import Button from '../../components/ui/Button'
import { formatNaira, formatDate, formatTime } from '../../utils/format'
import { PACKAGE_CATEGORIES } from '../../data/mock'
import { CATEGORY_ICONS } from '../../lib/icons'

export default function OrderDetails() {
  const { id } = useParams()
  const { startDraft, resumeTracking } = useAppData()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const ACTIVE_STATUSES = ['searching', 'enroute', 'arrived', 'in_transit', 'delivered']

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .get(`/api/orders/${id}`)
      .then(async (res) => {
        if (!alive) return
        if (ACTIVE_STATUSES.includes(res.order.status)) {
          // Still in progress — resume live tracking instead of showing the static
          // "completed order" view with a "book again" button, which made no sense
          // for a delivery that's literally still happening right now.
          await resumeTracking(res.order.id)
          if (alive) navigate('/app/booking', { replace: true })
          return
        }
        setData(res)
      })
      .catch(() => alive && setData(null))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <BackHeader title="Order not found" />
      </div>
    )
  }

  const { order, rider } = data
  const category = PACKAGE_CATEGORIES.find((c) => c.id === order.category)
  const CategoryIcon = CATEGORY_ICONS[order.category]

  function reorder() {
    startDraft({ pickup: order.pickup, dropoff: order.dropoff, category: order.category, vehicle: order.vehicle })
    navigate('/app/booking')
  }

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

        {rider && (
          <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
            <p className="mb-3 text-sm font-bold text-navy-950">Rider</p>
            <div className="flex items-center gap-3">
              <Avatar name={rider.name} size={48} src={avatarSrc(rider.avatarUrl)} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-navy-950">{rider.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-muted">
                  <Star size={12} className="fill-[#FFB800] text-[#FFB800]" />{' '}
                  {rider.trips > 0 ? `${rider.rating} · ${rider.vehicle}` : `New rider · ${rider.vehicle}`}
                </p>
              </div>
              {order.rating ? (
                <span className="flex items-center gap-1 text-sm font-semibold text-amber-600">
                  <Star size={14} className="fill-[#FFB800] text-[#FFB800]" /> {order.rating}
                </span>
              ) : null}
            </div>
          </div>
        )}

        <div className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-muted">Delivery fee</span>
            <span className="font-semibold text-navy-950">{formatNaira(order.price)}</span>
          </div>
          <div className="flex justify-between py-1 text-sm">
            <span className="text-slate-muted">Payment method</span>
            <span className="font-semibold capitalize text-navy-950">{order.paymentMethod}</span>
          </div>
        </div>

        <Button full size="lg" onClick={reorder}>
          Book this delivery again
        </Button>
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
