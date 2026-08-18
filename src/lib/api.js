const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TOKEN_KEY = 'kaya.token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = auth ? getToken() : null
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Cannot reach the Kaya server. Check your connection and try again.', 0)
  }

  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json().catch(() => ({})) : null

  if (!res.ok) {
    // Only treat this as "your session died" if we actually sent a token — a 401/403 from
    // /login (wrong password) or /signup is an expected, unrelated failure and must not
    // trigger a logout/redirect loop. A plain 403 from an ordinary permission check (e.g.
    // "not your order") must also NOT trigger this — only an expired/invalid token (401)
    // or the specific suspended-account code do.
    if (token && (res.status === 401 || data?.code === 'ACCOUNT_SUSPENDED')) {
      window.dispatchEvent(new CustomEvent('kaya:unauthorized'))
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.code)
  }
  return data
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
}

export { BASE_URL }
