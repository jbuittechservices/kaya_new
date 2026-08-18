import { useState } from 'react'
import { Eye, EyeOff, ArrowDownLeft, ArrowUpRight, Wallet as WalletIcon, Landmark } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { useAuth } from '../../context/AuthContext'
import { Card } from '../../components/ui/Misc'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { formatNaira, formatDate } from '../../utils/format'
import { api } from '../../lib/api'

export default function DriverWallet() {
  const { walletBalance, transactions, refreshWallet } = useAppData()
  const { user, refreshUser } = useAuth()
  const [hidden, setHidden] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [showBank, setShowBank] = useState(!user?.bankAccountNumber)
  const [amount, setAmount] = useState(1000)
  const [bank, setBank] = useState({ bankName: user?.bankName || '', bankAccountNumber: user?.bankAccountNumber || '', bankAccountName: user?.bankAccountName || '' })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  async function saveBank(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch('/api/drivers/bank-details', bank)
      await refreshUser()
      setShowBank(false)
      setNote('Bank details saved.')
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
      setTimeout(() => setNote(null), 4000)
    }
  }

  async function withdraw() {
    setBusy(true)
    try {
      await api.post('/api/drivers/withdraw', { amount: Number(amount) })
      await refreshWallet()
      setShowWithdraw(false)
      setNote('Withdrawal requested — funds are on their way to your bank.')
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
      setTimeout(() => setNote(null), 5000)
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
        <Button variant="outline-light" size="sm" className="relative mt-4" onClick={() => setShowWithdraw(true)}>
          <ArrowUpRight size={15} /> Withdraw to bank
        </Button>
      </div>

      {note && <div className="mt-4 rounded-2xl bg-navy-900/5 p-3 text-center text-sm font-medium text-navy-900">{note}</div>}

      {showWithdraw && (
        <Card className="mt-4 animate-slide-up">
          <p className="text-sm font-bold text-navy-950">Withdraw to bank</p>
          <p className="mt-1 text-xs text-slate-muted">
            {user?.bankAccountNumber ? `To ${user.bankName || 'bank'} •••• ${user.bankAccountNumber.slice(-4)}` : 'Add your bank details below first.'}
          </p>
          <Input label="Amount" type="number" min={500} max={walletBalance} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-3" />
          <div className="mt-3 flex gap-2">
            <Button variant="outline" full onClick={() => setShowWithdraw(false)}>
              Cancel
            </Button>
            <Button full disabled={busy || !user?.bankAccountNumber || amount > walletBalance} onClick={withdraw}>
              {busy ? 'Processing…' : `Withdraw ${formatNaira(amount)}`}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-5 rounded-2xl bg-white p-4 shadow-[var(--shadow-card)]">
        <button onClick={() => setShowBank((s) => !s)} className="tap flex w-full items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-navy-950">
            <Landmark size={16} /> Bank details
          </span>
          <span className="text-xs font-semibold text-amber-600">{showBank ? 'Hide' : 'Edit'}</span>
        </button>
        {user?.bankAccountNumber && !showBank && (
          <p className="mt-2 text-sm text-slate-muted">
            {user.bankAccountName} · {user.bankName} · •••• {user.bankAccountNumber.slice(-4)}
          </p>
        )}
        {showBank && (
          <form onSubmit={saveBank} className="mt-3 space-y-3">
            <Input label="Bank name" placeholder="e.g. GTBank" value={bank.bankName} onChange={(e) => setBank({ ...bank, bankName: e.target.value })} />
            <Input label="Account number" placeholder="10-digit NUBAN" value={bank.bankAccountNumber} onChange={(e) => setBank({ ...bank, bankAccountNumber: e.target.value })} />
            <Input label="Account name" placeholder="Name on the account" value={bank.bankAccountName} onChange={(e) => setBank({ ...bank, bankAccountName: e.target.value })} />
            <Button type="submit" full disabled={busy}>
              {busy ? 'Saving…' : 'Save bank details'}
            </Button>
          </form>
        )}
      </div>

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
                  {formatDate(t.createdAt)} {t.status === 'pending' ? '· processing' : ''}
                </p>
              </div>
              <p className={`text-sm font-bold ${t.type === 'credit' ? 'text-success' : 'text-navy-950'}`}>
                {t.type === 'credit' ? '+' : '-'}
                {formatNaira(t.amount)}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
