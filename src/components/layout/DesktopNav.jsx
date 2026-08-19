import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../ui/Misc'
import Logo from '../ui/Logo'
import { avatarSrc } from '../../lib/api'

const DEFAULT_LINKS = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/orders', label: 'Orders' },
  { to: '/app/wallet', label: 'Wallet' },
  { to: '/app/messages', label: 'Messages' },
  { to: '/app/account', label: 'Account' },
]

export default function DesktopNav({ links = DEFAULT_LINKS, footer, badge, unreadCount = 0 }) {
  const { user, logout } = useAuth()

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-navy-900/8 bg-white px-5 py-6 md:flex">
      <div className="mb-8 flex items-center gap-2 px-1">
        <Logo variant="dark" height={26} />
        {badge && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-600">{badge}</span>}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `tap flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-semibold transition ${
                isActive ? 'bg-navy-900 text-white' : 'text-navy-900/60 hover:bg-navy-900/5'
              }`
            }
          >
            {link.label}
            {link.label === 'Messages' && unreadCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="rounded-2xl bg-navy-900/5 p-3">
        <div className="mb-2 flex items-center gap-2">
          <Avatar name={user?.name} size={38} src={avatarSrc(user?.avatarUrl)} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-navy-950">{user?.name}</p>
            <p className="truncate text-xs text-slate-muted">{footer}</p>
          </div>
        </div>
        <button onClick={logout} className="tap w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger/10">
          Log out
        </button>
      </div>
    </aside>
  )
}
