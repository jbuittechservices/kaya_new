import { useSearchParams } from 'react-router-dom'

export default function SessionExpiredNotice({ dark = false }) {
  const [params] = useSearchParams()
  if (params.get('reason') !== 'expired') return null

  return (
    <p className={`mb-4 rounded-2xl px-4 py-3 text-sm font-medium ${dark ? 'bg-white/10 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
      Your session expired — please sign in again.
    </p>
  )
}
