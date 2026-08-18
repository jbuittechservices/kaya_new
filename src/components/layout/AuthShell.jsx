import { Link, useNavigate } from 'react-router-dom'
import Logo from '../ui/Logo'

export default function AuthShell({ title, subtitle, step, totalSteps, children, onBack }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col bg-navy-900">
      <div className="safe-top flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          className="tap flex h-10 w-10 items-center justify-center rounded-full bg-white/10"
          aria-label="Back"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <Link to="/">
          <Logo variant="light" height={20} />
        </Link>
        <div className="w-10" />
      </div>

      {step && totalSteps && (
        <div className="mx-5 mt-6 flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-amber-500' : 'bg-white/15'}`} />
          ))}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-10 pt-8">
        <h1 className="text-2xl font-extrabold leading-snug text-white">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-white/60">{subtitle}</p>}
        <div className="mt-8 flex-1">{children}</div>
      </div>
    </div>
  )
}
