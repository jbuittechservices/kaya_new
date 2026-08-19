import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Card } from './Misc'
import { getPushSubscriptionStatus, subscribeToPush, unsubscribeFromPush, isPushSupported } from '../../lib/push'

export default function NotificationsToggle() {
  const [status, setStatus] = useState('checking')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isPushSupported()) {
      setStatus('unsupported')
      return
    }
    getPushSubscriptionStatus().then(setStatus)
  }, [])

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      if (status === 'subscribed') {
        await unsubscribeFromPush()
        setStatus('not-subscribed')
      } else {
        await subscribeToPush()
        setStatus('subscribed')
      }
    } catch (err) {
      setError(err.message)
      const fresh = await getPushSubscriptionStatus()
      setStatus(fresh)
    } finally {
      setBusy(false)
    }
  }

  if (status === 'unsupported') return null

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100">
          {status === 'subscribed' ? <Bell size={16} className="text-amber-600" /> : <BellOff size={16} className="text-amber-600" />}
        </span>
        <div>
          <p className="text-sm font-bold text-navy-950">Push notifications</p>
          <p className="text-xs text-slate-muted">
            {status === 'denied'
              ? 'Blocked in your browser settings — enable them there to turn this on.'
              : status === 'subscribed'
                ? "You'll get notified about order updates and messages."
                : 'Get notified about order updates and new messages.'}
          </p>
          {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={busy || status === 'checking' || status === 'denied'}
        className={`tap relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${status === 'subscribed' ? 'bg-amber-500' : 'bg-navy-900/15'}`}
      >
        <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${status === 'subscribed' ? 'left-6' : 'left-1'}`} />
      </button>
    </Card>
  )
}
