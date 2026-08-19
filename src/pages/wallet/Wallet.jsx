import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, RefreshCw } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { Card } from '../../components/ui/Misc'
import Button from '../../components/ui/Button'
import { formatNaira, formatDate } from '../../utils/format'
import { QUICK_TOPUP_AMOUNTS } from '../../data/mock'

export default function Wallet() {
  const { walletBalance, transactions, topUpWallet, verifyTopUp } = useAppData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [hidden, setHidden] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)
  const [amount, setAmount] = useState(2500)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const [checkingRef, setCheckingRef] = useState(null)

  const isValidAmount = Number(amount) >= 100 && Number(amount) <= 1000000
  const amountError = amount !== '' && !isValidAmount ? 'Enter an amount between ₦100 and ₦1,000,000' : null

  // Paystack redirects back here with ?reference=... (or ?trxref=...) after checkout —
  // this is what actually confirms and credits the payment. Without this, a top-up
  // would show up in the transaction list as "pending" forever and never reach the
  // wallet balance, even though the money was genuinely charged.
  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref')
    if (!reference) return

    verifyTopUp(reference)
      .then((result) => {
        setNote(result.status === 'success' ? 'Payment confirmed — your wallet has been credited.' : 'We could not confirm that payment. If you were charged, use "Check status" below on the pending transaction.')
      })
      .catch(() => setNote('Could not verify that payment right now. Try "Check status" on the transaction below in a moment.'))
      .finally(() => {
        setTimeout(() => setNote(null), 6000)
        // Clean the reference out of the URL so refreshing doesn't re-trigger verification
        setSearchParams({}, { replace: true })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function confirmTopUp() {
    if (!isValidAmount) return
    setBusy(true)
    try {
      const result = await topUpWallet(Number(amount))
      setNote(result.simulated ? 'Wallet topped up successfully.' : 'Complete your payment in the new tab, then come back here.')
      setShowTopUp(false)
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
      setTimeout(() => setNote(null), 4000)
    }
  }

  async function checkStatus(reference) {
    setCheckingRef(reference)
    try {
      const result = await verifyTopUp(reference)
      setNote(result.status === 'success' ? 'Confirmed — your wallet has been credited.' : "Still not confirmed on Paystack's side yet. Try again shortly.")
    } catch (err) {
      setNote(err.message)
    } finally {
      setCheckingRef(null)
      setTimeout(() => setNote(null), 4000)
    }
  }

  return (
    <div className="px-5 pt-6 pb-6 md:px-0">
      <h1 className="text-xl font-extrabold text-navy-950">Wallet</h1>

      <div className="relative mt-5 overflow-hidden rounded-3xl bg-navy-900 p-5">
        <svg className="absolute inset-0 h-full w-full opacity-10" viewBox="0 0 300 140">
          <path d="M-10 100 Q 60 40 150 80 T 320 40" stroke="#00ABFD" strokeWidth="2" fill="none" />
          <path d="M-10 60 Q 80 110 160 50 T 320 90" stroke="#00ABFD" strokeWidth="2" fill="none" />
        </svg>
        <div className="relative flex items-center justify-between">
          <p className="text-sm font-medium text-white/60">Wallet balance</p>
          <button onClick={() => setHidden((h) => !h)} className="tap text-white/60">
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="relative mt-2 text-3xl font-extrabold text-white">{hidden ? '₦••••••' : formatNaira(walletBalance)}</p>
        <Button variant="outline-light" size="sm" className="relative mt-4" onClick={() => setShowTopUp(true)}>
          <ArrowDownLeft size={15} /> Deposit funds
        </Button>
      </div>

      {note && <div className="mt-4 rounded-2xl bg-navy-900/5 p-3 text-center text-sm font-medium text-navy-900">{note}</div>}

      {showTopUp && (
        <Card className="mt-4 animate-slide-up">
          <p className="text-sm font-bold text-navy-950">Top up wallet</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {QUICK_TOPUP_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`tap rounded-xl py-2 text-xs font-semibold ${amount === a ? 'bg-amber-500 text-navy-950' : 'bg-navy-900/5 text-navy-900/70'}`}
              >
                {formatNaira(a)}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="mb-1.5 block text-xs font-medium text-navy-900/60">Or enter a custom amount</span>
            <div className="flex items-center gap-2 rounded-xl border border-navy-900/12 bg-white px-3 py-2.5">
              <span className="text-sm font-semibold text-navy-900/50">₦</span>
              <input
                type="number"
                min={100}
                max={1000000}
                step={100}
                value={amount}
                onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-transparent text-sm font-semibold text-navy-950 outline-none"
              />
            </div>
          </label>
          {amountError && <p className="mt-2 text-xs font-medium text-danger">{amountError}</p>}
          <div className="mt-3 flex gap-2">
            <Button variant="outline" full onClick={() => setShowTopUp(false)}>
              Cancel
            </Button>
            <Button full disabled={busy || !isValidAmount} onClick={confirmTopUp}>
              {busy ? 'Processing…' : `Add ${formatNaira(amount || 0)}`}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-7 flex items-center justify-between">
        <p className="text-sm font-bold text-navy-950">Recent transactions</p>
      </div>

      <div className="mt-3 space-y-2">
        {transactions.length === 0 ? (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <WalletIcon size={28} className="text-navy-900/30" />
            <p className="text-sm text-slate-muted">No transactions yet.</p>
          </Card>
        ) : (
          transactions.map((t) => (
            <div key={t.id} className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-[var(--shadow-card)]">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${t.type === 'credit' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {t.type === 'credit' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-navy-950">{t.label}</p>
                <p className="text-xs text-slate-muted">
                  {formatDate(t.createdAt)}
                  {t.status === 'pending' && ' · Awaiting confirmation'}
                </p>
              </div>
              {t.status === 'pending' && t.reference ? (
                <button
                  onClick={() => checkStatus(t.reference)}
                  disabled={checkingRef === t.reference}
                  className="tap flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-700"
                >
                  <RefreshCw size={12} className={checkingRef === t.reference ? 'animate-spin' : ''} />
                  {checkingRef === t.reference ? 'Checking…' : 'Check status'}
                </button>
              ) : (
                <p className={`text-sm font-bold ${t.type === 'credit' ? 'text-success' : 'text-navy-950'}`}>
                  {t.type === 'credit' ? '+' : '-'}
                  {formatNaira(t.amount)}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
