import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import DarkInput from '../../components/ui/DarkInput'
import Button from '../../components/ui/Button'
import Logo from '../../components/ui/Logo'
import SessionExpiredNotice from '../../components/ui/SessionExpiredNotice'

export default function AdminLogin() {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const user = await login(phone, password)
      if (user.role !== 'admin') {
        setError('This account does not have admin access.')
        return
      }
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo variant="light" height={22} className="mb-6" />
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15">
            <ShieldCheck size={26} className="text-amber-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Kaya Admin</h1>
          <p className="mt-1 text-sm text-white/50">Sign in to manage the platform.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <SessionExpiredNotice dark />
          <DarkInput label="Phone number" type="tel" placeholder="080X XXX XXXX" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
          <DarkInput label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="text-sm font-medium text-amber-300">{error}</p>}
          <Button type="submit" full size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
