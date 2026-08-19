import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import MobileTabBar from './MobileTabBar'
import DesktopNav from './DesktopNav'

const DRIVER_TABS = [
  { to: '/driver', label: 'Home', icon: 'home', end: true },
  { to: '/driver/orders', label: 'Trips', icon: 'orders' },
  { to: '/driver/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/driver/messages', label: 'Messages', icon: 'messages' },
  { to: '/driver/account', label: 'Account', icon: 'account' },
]

const DRIVER_LINKS = [
  { to: '/driver', label: 'Home', end: true },
  { to: '/driver/orders', label: 'Trips' },
  { to: '/driver/wallet', label: 'Wallet' },
  { to: '/driver/messages', label: 'Messages' },
  { to: '/driver/account', label: 'Account' },
]

export default function DriverShell() {
  const { isAuthenticated, user, booting } = useAuth()
  const { conversations } = useAppData()
  const unreadCount = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)

  if (booting) return null
  if (!isAuthenticated || user?.role !== 'driver') return <Navigate to="/driver/signin" replace />

  return (
    <div className="flex min-h-screen bg-cream-100 md:bg-white">
      <DesktopNav links={DRIVER_LINKS} footer="Rider account" badge="Rider" unreadCount={unreadCount} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col bg-cream-100 pb-24 md:max-w-none md:pb-0">
        <div className="mx-auto w-full max-w-md flex-1 md:max-w-2xl md:px-8 md:py-8">
          <Outlet />
        </div>
      </div>
      <MobileTabBar tabs={DRIVER_TABS} unreadCount={unreadCount} />
    </div>
  )
}
