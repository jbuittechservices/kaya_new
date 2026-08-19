import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import DarkInput from '../../components/ui/DarkInput'
import PhoneInput from '../../components/ui/PhoneInput'
import Button from '../../components/ui/Button'
import SessionExpiredNotice from '../../components/ui/SessionExpiredNotice'
import { useAuth } from '../../context/AuthContext'

export default function DriverSignIn() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await login(phone, password)
      if (user.role !== 'driver') {
        setError('This number is not registered as a Kaya rider.')
        return
      }
      navigate('/driver')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Ride and earn" subtitle="Log in to your Kaya driver account to start accepting deliveries." onBack={() => navigate('/')}>
      <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
        <SessionExpiredNotice dark />
        <PhoneInput label="Phone number" value={phone} onChange={setPhone} dark required />
        <DarkInput label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
        <div className="mt-auto pt-6">
          <Button type="submit" full size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </Button>
          <p className="mt-5 text-center text-sm text-white/50">
            New rider?{' '}
            <Link to="/driver/signup" className="font-semibold text-amber-400">
              Sign up to ride
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-white/40">
            <Link to="/signin" className="font-semibold text-white/60">
              I want to send a package instead
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
