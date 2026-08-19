import { useEffect } from 'react'
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { formatNaira } from '../../utils/format'
import MobileTabBar from './MobileTabBar'
import DesktopNav from './DesktopNav'

export default function AppShell() {
  const { isAuthenticated, booting } = useAuth()
  const { walletBalance, reconciledOrderId } = useAppData()
  const navigate = useNavigate()
  const location = useLocation()

  // A page reload mid-delivery rebuilds tracking state from the server (see
  // AppDataContext) but that alone doesn't put the person back on the tracking
  // screen — do that once here, without re-triggering on every render or fighting
  // the person if they deliberately navigate elsewhere afterward.
  useEffect(() => {
    if (reconciledOrderId && location.pathname !== '/app/booking') {
      navigate('/app/booking')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconciledOrderId])

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
