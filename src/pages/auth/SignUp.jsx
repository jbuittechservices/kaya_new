import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import AuthShell from '../../components/layout/AuthShell'
import DarkInput from '../../components/ui/DarkInput'
import PhoneInput from '../../components/ui/PhoneInput'
import Button from '../../components/ui/Button'
import { useAuth } from '../../context/AuthContext'

const STEP_PHONE = 1
const STEP_OTP = 2
const STEP_DETAILS = 3
const STEP_SUCCESS = 4

export default function SignUp({ driver = false }) {
  const [step, setStep] = useState(STEP_PHONE)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', ''])
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resendState, setResendState] = useState({ busy: false, cooldown: 0 })
  const { requestSignupOtp, verifySignupOtp, completeSignup } = useAuth()
  const navigate = useNavigate()

  function goBack() {
    if (step === STEP_PHONE) navigate('/')
    else setStep((s) => s - 1)
  }

  async function submitPhone(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await requestSignupOtp(phone)
      setStep(STEP_OTP)
      startResendCooldown()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function startResendCooldown(seconds = 60) {
    setResendState({ busy: false, cooldown: seconds })
    const interval = setInterval(() => {
      setResendState((s) => {
        if (s.cooldown <= 1) {
          clearInterval(interval)
          return { busy: false, cooldown: 0 }
        }
        return { ...s, cooldown: s.cooldown - 1 }
      })
    }, 1000)
  }

  async function resendOtp() {
    setError(null)
    setResendState((s) => ({ ...s, busy: true }))
    try {
      await requestSignupOtp(phone)
      startResendCooldown()
    } catch (err) {
      setError(err.message)
      setResendState((s) => ({ ...s, busy: false }))
    }
  }

  function handleOtpChange(i, val) {
    if (!/^\d?$/.test(val)) return
    const next = [...otp]
    next[i] = val
    setOtp(next)
    if (val && i < 3) document.getElementById(`otp-${i + 1}`)?.focus()
  }

  async function submitOtp(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await verifySignupOtp(phone, otp.join(''))
      setStep(STEP_DETAILS)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function submitDetails(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await completeSignup(phone, { ...form, role: driver ? 'driver' : 'customer' })
      setStep(STEP_SUCCESS)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function finish() {
    navigate(driver ? '/driver' : '/app')
  }

  if (step === STEP_PHONE) {
    return (
      <AuthShell
        title="Create your account"
        subtitle="Enter your phone number — we'll send you a code to verify it's you."
        step={1}
        totalSteps={3}
        onBack={goBack}
      >
        <form onSubmit={submitPhone} className="flex h-full flex-col gap-4">
          <PhoneInput label="Phone number" value={phone} onChange={setPhone} dark required autoFocus />
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <div className="mt-auto pt-6">
            <Button type="submit" full size="lg" disabled={loading}>
              {loading ? 'Sending code…' : 'Continue'}
            </Button>
            <p className="mt-5 text-center text-sm text-white/50">
              Already have an account?{' '}
              <Link to={driver ? '/driver/signin' : '/signin'} className="font-semibold text-amber-400">
                Log in
              </Link>
            </p>
          </div>
        </form>
      </AuthShell>
    )
  }

  if (step === STEP_OTP) {
    return (
      <AuthShell title="Verify your number" subtitle={`We sent a 4-digit code to ${phone || 'your phone'}.`} step={2} totalSteps={3} onBack={goBack}>
        <form onSubmit={submitOtp} className="flex h-full flex-col gap-6">
          <div className="flex justify-between gap-3">
            {otp.map((digit, i) => (
              <input
                key={i}
                id={`otp-${i}`}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                inputMode="numeric"
                maxLength={1}
                className="h-16 w-16 rounded-2xl border border-white/15 bg-white/[0.06] text-center text-2xl font-bold text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/25"
              />
            ))}
          </div>
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <button
            type="button"
            onClick={resendOtp}
            disabled={resendState.busy || resendState.cooldown > 0}
            className="text-left text-sm font-semibold text-amber-400 disabled:text-white/30"
          >
            {resendState.cooldown > 0 ? `Resend code in ${resendState.cooldown}s` : resendState.busy ? 'Sending…' : 'Resend code'}
          </button>
          <div className="mt-auto pt-6">
            <Button type="submit" full size="lg" disabled={otp.some((d) => !d) || loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </Button>
          </div>
        </form>
      </AuthShell>
    )
  }

  if (step === STEP_DETAILS) {
    return (
      <AuthShell title="Tell us about you" subtitle="This is how riders and customers will know it's you." step={3} totalSteps={3} onBack={goBack}>
        <form onSubmit={submitDetails} className="flex h-full flex-col gap-4">
          <DarkInput label="Full name" placeholder="Benjamin Uwa" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <DarkInput label="Email address" type="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <DarkInput label="Create password" type="password" placeholder="At least 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <div className="mt-auto pt-6">
            <Button type="submit" full size="lg" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="mt-4 text-center text-xs leading-relaxed text-white/40">
              By continuing you agree to Kaya's Terms of Service and Privacy Policy.
            </p>
          </div>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="You're all set" subtitle="Your Kaya account is ready." onBack={finish}>
      <div className="flex h-full flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-amber-500/15">
          <CheckCircle2 size={44} className="text-amber-500" />
        </div>
        <p className="max-w-xs text-[15px] text-white/60">Welcome to Kaya, {form.name?.split(' ')[0] || 'there'}. Your account was created successfully.</p>
      </div>
      <div className="pt-6">
        <Button onClick={finish} full size="lg">
          Go to my dashboard
        </Button>
      </div>
    </AuthShell>
  )
}
