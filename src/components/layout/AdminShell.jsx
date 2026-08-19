import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, Bike, Package, Receipt, Settings, LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { Avatar } from '../../components/ui/Misc'
import Logo from '../../components/ui/Logo'

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Customers', icon: Users },
  { to: '/admin/drivers', label: 'Riders', icon: Bike },
  { to: '/admin/orders', label: 'Orders', icon: Package },
  { to: '/admin/transactions', label: 'Transactions', icon: Receipt },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export default function AdminShell() {
  const { user, isAuthenticated, booting, logout } = useAuth()
  const navigate = useNavigate()

  if (booting) return null
  if (!isAuthenticated || user?.role !== 'admin') return <Navigate to="/admin/login" replace />

  return (
    <div className="flex min-h-screen flex-col bg-cream-100 md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-navy-900/8 bg-white px-5 py-6 md:flex">
        <div className="mb-8 px-1">
          <Logo variant="dark" height={24} />
          <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wide text-amber-600">Admin</span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `tap flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-semibold transition ${
                  isActive ? 'bg-navy-900 text-white' : 'text-navy-900/60 hover:bg-navy-900/5'
                }`
              }
            >
              <link.icon size={18} />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="rounded-2xl bg-navy-900/5 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Avatar name={user?.name} size={38} tone="navy" />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-navy-950">{user?.name}</p>
              <p className="truncate text-xs text-slate-muted">{user?.phone}</p>
            </div>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/admin/login')
            }}
            className="tap flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold text-danger hover:bg-danger/10"
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      </aside>

      {/* Mobile: the sidebar above is hidden entirely below md — without this, an admin
          on a phone would have no way to navigate between sections at all. */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-navy-900/8 bg-white px-4 py-3 md:hidden">
        <Logo variant="dark" height={20} />
        <button onClick={logout} className="tap flex h-9 w-9 items-center justify-center rounded-full bg-navy-900/5">
          <LogOut size={15} className="text-danger" />
        </button>
      </div>
      <nav className="sticky top-[52px] z-30 flex gap-2 overflow-x-auto border-b border-navy-900/8 bg-white px-4 py-2 no-scrollbar md:hidden">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `tap flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
                isActive ? 'bg-navy-900 text-white' : 'bg-navy-900/5 text-navy-900/60'
              }`
            }
          >
            <link.icon size={15} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1 px-5 py-6 md:px-10 md:py-8">
        <Outlet />
      </div>
    </div>
  )
}
