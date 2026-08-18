import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { api, getToken, setToken } from '../lib/api'
import { connectSocket, disconnectSocket } from '../lib/socket'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [booting, setBooting] = useState(true)

  // Restore session on load
  useEffect(() => {
    const token = getToken()
    if (!token) {
      setBooting(false)
      return
    }
    api
      .get('/api/auth/me')
      .then(({ user }) => {
        setUser(user)
        connectSocket()
      })
      .catch(() => setToken(null))
      .finally(() => setBooting(false))
  }, [])

  // If any authenticated request comes back 401 (expired token, suspended account,
  // server restarted with a new secret, etc.), the app was silently failing forever
  // with no way out short of the person manually clearing localStorage. Instead,
  // clear the session and bounce to the right sign-in screen for where they were.
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null)
      setUser(null)
      disconnectSocket()
      const path = window.location.pathname
      const destination = path.startsWith('/driver') ? '/driver/signin' : path.startsWith('/admin') ? '/admin/login' : '/signin'
      if (path !== destination) window.location.href = `${destination}?reason=expired`
    }
    window.addEventListener('kaya:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('kaya:unauthorized', handleUnauthorized)
  }, [])

  const applySession = useCallback((token, user) => {
    setToken(token)
    setUser(user)
    connectSocket()
  }, [])

  // ---- Sign up (OTP flow) ----
  const requestSignupOtp = useCallback((phone) => api.post('/api/auth/signup/request-otp', { phone }), [])
  const verifySignupOtp = useCallback((phone, code) => api.post('/api/auth/signup/verify-otp', { phone, code }), [])
  const completeSignup = useCallback(
    async (phone, { name, email, password, role }) => {
      const { token, user } = await api.post('/api/auth/signup/complete', { phone, name, email, password, role })
      applySession(token, user)
      return user
    },
    [applySession]
  )

  // ---- Log in ----
  const login = useCallback(
    async (phone, password) => {
      const { token, user } = await api.post('/api/auth/login', { phone, password })
      applySession(token, user)
      return user
    },
    [applySession]
  )

  // ---- Password reset ----
  const requestResetOtp = useCallback((phone) => api.post('/api/auth/reset/request-otp', { phone }), [])
  const verifyResetOtp = useCallback((phone, code) => api.post('/api/auth/reset/verify-otp', { phone, code }), [])
  const completeReset = useCallback((phone, code, password) => api.post('/api/auth/reset/complete', { phone, code, password }), [])

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    disconnectSocket()
  }, [])

  const updateProfile = useCallback(async (patch) => {
    const { user } = await api.patch('/api/auth/me', patch)
    setUser(user)
    return user
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const { user } = await api.get('/api/auth/me')
      setUser(user)
    } catch {
      // ignore — next authenticated request will surface the error
    }
  }, [])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      booting,
      login,
      logout,
      updateProfile,
      refreshUser,
      requestSignupOtp,
      verifySignupOtp,
      completeSignup,
      requestResetOtp,
      verifyResetOtp,
      completeReset,
    }),
    [user, booting, login, logout, updateProfile, refreshUser, requestSignupOtp, verifySignupOtp, completeSignup, requestResetOtp, verifyResetOtp, completeReset]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
