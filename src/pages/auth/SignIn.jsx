import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthShell from '../../components/layout/AuthShell'
import DarkInput from '../../components/ui/DarkInput'
import Button from '../../components/ui/Button'
import SessionExpiredNotice from '../../components/ui/SessionExpiredNotice'
import { useAuth } from '../../context/AuthContext'

export default function SignIn() {
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
      navigate(user.role === 'admin' ? '/admin' : '/app')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to request a delivery or check on one already on the way." onBack={() => navigate('/')}>
      <form onSubmit={handleSubmit} className="flex h-full flex-col gap-4">
        <SessionExpiredNotice dark />
        <DarkInput label="Phone number" type="tel" placeholder="080X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        <DarkInput label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
        <div className="text-right">
          <Link to="/reset-password" className="text-sm font-semibold text-amber-400">
            Forgot password?
          </Link>
        </div>
        <div className="mt-auto pt-6">
          <Button type="submit" full size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Log in'}
          </Button>
          <p className="mt-5 text-center text-sm text-white/50">
            New to Kaya?{' '}
            <Link to="/signup" className="font-semibold text-amber-400">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
