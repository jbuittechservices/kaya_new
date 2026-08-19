import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_ENTRY = path.join(__dirname, '..', '..', 'src', 'index.js')

let serverProcess = null
let dataDir = null
let baseUrl = null
let stdoutBuffer = ''

async function waitForHealth(url, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Server did not become healthy within ${timeoutMs}ms`)
}

/** Starts a real instance of the API on a random port against a throwaway SQLite file. */
export async function startTestServer() {
  dataDir = mkdtempSync(path.join(tmpdir(), 'kaya-test-'))
  const port = 4100 + Math.floor(Math.random() * 900)
  baseUrl = `http://localhost:${port}`
  stdoutBuffer = ''

  serverProcess = spawn(
    process.execPath,
    [SERVER_ENTRY],
    {
      env: {
        ...process.env,
        PORT: String(port),
        DATA_DIR: dataDir,
        JWT_SECRET: 'test-secret-not-for-production-aaaaaaaaaaaaaaaaaaaa',
        NODE_ENV: 'test',
        CORS_ORIGIN: 'http://localhost:5173',
        // Deliberately unset so Twilio/Paystack/push stay in their "not configured" dev-safe modes
        TWILIO_ACCOUNT_SID: '',
        PAYSTACK_SECRET_KEY: '',
        VAPID_PUBLIC_KEY: '',
      },
      stdio: 'pipe',
    }
  )

  serverProcess.stderr.on('data', () => {}) // keep test output clean; uncomment for debugging
  // Dev-mode OTP delivery logs the code to stdout (see server/src/utils/otp.js) — capture
  // it so tests can drive real signup flows instead of only testing pre-seeded accounts.
  serverProcess.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk.toString()
  })

  await waitForHealth(baseUrl)

  // Seed script is a separate process module; run it directly against the same DATA_DIR
  await new Promise((resolve, reject) => {
    const seed = spawn(process.execPath, [path.join(__dirname, '..', '..', 'src', 'seed.js')], {
      env: { ...process.env, DATA_DIR: dataDir, SEED_ADMIN_PASSWORD: 'TestAdmin!123' },
      stdio: 'ignore',
    })
    seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exited with ${code}`))))
  })

  return baseUrl
}

export function stopTestServer() {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true })
    dataDir = null
  }
}

export function getBaseUrl() {
  return baseUrl
}

/** Minimal fetch wrapper for tests — returns { status, body }. */
export async function request(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const isJson = res.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await res.json().catch(() => null) : null
  return { status: res.status, body: data }
}

export async function loginAs(phone, password) {
  const { body } = await request('POST', '/api/auth/login', { body: { phone, password } })
  if (!body?.token) throw new Error(`Login failed for ${phone}: ${JSON.stringify(body)}`)
  return body
}

/** Reads the most recent dev-mode OTP printed for a given phone number from captured stdout. */
export async function waitForOtpCode(phone, timeoutMs = 4000) {
  const start = Date.now()
  const pattern = new RegExp(`\\[DEV OTP\\] ${phone.replace('+', '\\+')} → (\\d{4})`)
  while (Date.now() - start < timeoutMs) {
    const matches = [...stdoutBuffer.matchAll(new RegExp(pattern, 'g'))]
    if (matches.length > 0) return matches[matches.length - 1][1] // most recent match
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error(`No OTP was ever printed for ${phone} within ${timeoutMs}ms`)
}

/** Drives a real signup end to end (request OTP → verify → complete) and returns the session. */
export async function signUp({ phone, name, password = 'TestPass123', role = 'customer' }) {
  const otpReq = await request('POST', '/api/auth/signup/request-otp', { body: { phone } })
  if (otpReq.status !== 200) throw new Error(`OTP request failed: ${JSON.stringify(otpReq.body)}`)
  const code = await waitForOtpCode(phone)
  const verify = await request('POST', '/api/auth/signup/verify-otp', { body: { phone, code } })
  if (verify.status !== 200) throw new Error(`OTP verify failed: ${JSON.stringify(verify.body)}`)
  const complete = await request('POST', '/api/auth/signup/complete', { body: { phone, name, password, role } })
  if (complete.status !== 201) throw new Error(`Signup complete failed: ${JSON.stringify(complete.body)}`)
  return complete.body
}

export const SEEDED = {
  admin: { phone: '+2348000000000', password: 'TestAdmin!123' },
  customer: { phone: '+2348030001122', password: 'Password123' },
  driver: { phone: '+2348032219081', password: 'Password123' },
}
