import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AppDataProvider } from './context/AppDataContext'

import Landing from './pages/Landing'
import SignIn from './pages/auth/SignIn'
import SignUp from './pages/auth/SignUp'
import ResetPassword from './pages/auth/ResetPassword'

// Each app area is loaded on demand — most people only ever use one of these three.
const AppShell = lazy(() => import('./components/layout/AppShell'))
const Home = lazy(() => import('./pages/Home'))
const Booking = lazy(() => import('./pages/booking/Booking'))
const MyOrders = lazy(() => import('./pages/orders/MyOrders'))
const OrderDetails = lazy(() => import('./pages/orders/OrderDetails'))
const Wallet = lazy(() => import('./pages/wallet/Wallet'))
const Messages = lazy(() => import('./pages/messages/Messages'))
const Conversation = lazy(() => import('./pages/messages/Conversation'))
const Account = lazy(() => import('./pages/account/Account'))

const DriverShell = lazy(() => import('./components/layout/DriverShell'))
const DriverSignIn = lazy(() => import('./pages/driver/DriverSignIn'))
const DriverHome = lazy(() => import('./pages/driver/DriverHome'))
const DriverOrders = lazy(() => import('./pages/driver/DriverOrders'))
const DriverOrderDetails = lazy(() => import('./pages/driver/DriverOrderDetails'))
const DriverWallet = lazy(() => import('./pages/driver/DriverWallet'))
const DriverMessages = lazy(() => import('./pages/driver/DriverMessages'))
const DriverAccount = lazy(() => import('./pages/driver/DriverAccount'))

const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminShell = lazy(() => import('./components/layout/AdminShell'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminDrivers = lazy(() => import('./pages/admin/AdminDrivers'))
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'))
const AdminTransactions = lazy(() => import('./pages/admin/AdminTransactions'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))

function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream-100">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy-900/15 border-t-amber-500" />
    </div>
  )
}

function AppRoutes() {
  const { booting } = useAuth()
  if (booting) return null

  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/driver/signin" element={<DriverSignIn />} />
        <Route path="/driver/signup" element={<SignUp driver />} />
        <Route path="/driver" element={<DriverShell />}>
          <Route index element={<DriverHome />} />
          <Route path="orders" element={<DriverOrders />} />
          <Route path="orders/:id" element={<DriverOrderDetails />} />
          <Route path="wallet" element={<DriverWallet />} />
          <Route path="messages" element={<DriverMessages />} />
          <Route path="messages/:id" element={<Conversation />} />
          <Route path="account" element={<DriverAccount />} />
          <Route path="account/:tab" element={<DriverAccount />} />
        </Route>

        <Route path="/app" element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="booking" element={<Booking />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="orders/:id" element={<OrderDetails />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:id" element={<Conversation />} />
          <Route path="account" element={<Account />} />
          <Route path="account/:tab" element={<Account />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="drivers" element={<AdminDrivers />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="transactions" element={<AdminTransactions />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AppDataProvider>
    </AuthProvider>
  )
}
