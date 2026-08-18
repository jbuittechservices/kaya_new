import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import AuthShell from '../../components/layout/AuthShell'
import DarkInput from '../../components/ui/DarkInput'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'

export default function ResetPassword() {
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', ''])
  const [pw, setPw] = useState({ next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { requestResetOtp, verifyResetOtp, completeReset } = useAuth()
  const navigate = useNavigate()

  async function submitPhone(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestResetOtp(phone)
      setStep(2)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await verifyResetOtp(phone, otp.join(''))
      setStep(3)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitPassword(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await completeReset(phone, otp.join(''), pw.next)
      setStep(4)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (step === 1) {
    return (
      <AuthShell title="Reset your password" subtitle="Enter the phone number linked to your account." onBack={() => navigate('/signin')}>
        <form onSubmit={submitPhone} className="flex h-full flex-col gap-4">
          <DarkInput label="Phone number" type="tel" placeholder="080X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <div className="mt-auto pt-6">
            <Button type="submit" full size="lg" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset code'}
            </Button>
          </div>
        </form>
      </AuthShell>
    )
  }

  if (step === 2) {
    return (
      <AuthShell title="Verify it's you" subtitle={`Enter the 4-digit code sent to ${phone || 'your phone'}.`} onBack={() => setStep(1)}>
        <form onSubmit={submitOtp} className="flex h-full flex-col gap-6">
          <div className="flex justify-between gap-3">
            {otp.map((digit, i) => (
              <input
                key={i}
                value={digit}
                onChange={(e) => {
                  if (!/^\d?$/.test(e.target.value)) return
                  const next = [...otp]
                  next[i] = e.target.value
                  setOtp(next)
                }}
                inputMode="numeric"
                maxLength={1}
                className="h-16 w-16 rounded-2xl border border-white/15 bg-white/[0.06] text-center text-2xl font-bold text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25"
              />
            ))}
          </div>
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <div className="mt-auto pt-6">
            <Button type="submit" full size="lg" disabled={otp.some((d) => !d) || loading}>
              {loading ? 'Verifying…' : 'Verify code'}
            </Button>
          </div>
        </form>
      </AuthShell>
    )
  }

  if (step === 3) {
    return (
      <AuthShell title="Set a new password" subtitle="Choose something secure you haven't used before." onBack={() => setStep(2)}>
        <form onSubmit={submitPassword} className="flex h-full flex-col gap-4">
          <DarkInput label="New password" type="password" placeholder="At least 8 characters" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} />
          <DarkInput
            label="Confirm password"
            type="password"
            placeholder="Re-enter password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
            required
            error={pw.confirm && pw.confirm !== pw.next ? 'Passwords do not match' : undefined}
          />
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <div className="mt-auto pt-6">
            <Button type="submit" full size="lg" disabled={!pw.next || pw.next !== pw.confirm || loading}>
              {loading ? 'Updating…' : 'Reset password'}
            </Button>
          </div>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Password reset" subtitle="You can now log in with your new password." onBack={() => navigate('/signin')}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15">
          <CheckCircle2 size={44} className="text-amber-500" />
        </div>
        <p className="max-w-xs text-[15px] text-white/60">Your password was updated successfully.</p>
      </div>
      <div className="pt-6">
        <Button onClick={() => navigate('/signin')} full size="lg">
          Back to log in
        </Button>
      </div>
    </AuthShell>
  )
}
