import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { formatNaira } from '../../utils/format'
import MobileTabBar from './MobileTabBar'
import DesktopNav from './DesktopNav'

export default function AppShell() {
  const { isAuthenticated, booting } = useAuth()
  const { walletBalance } = useAppData()
  if (booting) return null
  if (!isAuthenticated) return <Navigate to="/signin" replace />

  return (
    <div className="flex min-h-screen bg-cream-100 md:bg-white">
      <DesktopNav footer={`${formatNaira(walletBalance)} balance`} />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col bg-cream-100 pb-24 md:max-w-none md:pb-0">
        <div className="mx-auto w-full max-w-md flex-1 md:max-w-2xl md:px-8 md:py-8">
          <Outlet />
        </div>
      </div>
      <MobileTabBar />
    </div>
  )
}
