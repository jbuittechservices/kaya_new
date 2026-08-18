import { db, uid } from '../db.js'
import twilio from 'twilio'

const OTP_TTL_MINUTES = 10
const RESEND_COOLDOWN_SECONDS = 60

export class OtpError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

export function generateOtp() {
  return String(Math.floor(1000 + Math.random() * 9000))
}

/**
 * Creates and sends an OTP. Throws OtpError (safe to show to the user) if the
 * phone is on cooldown or the SMS genuinely failed to send — callers should
 * catch this and respond with `err.status` / `err.message` rather than
 * silently telling the user a code is on its way when it isn't.
 */
export async function createOtp(phone, purpose = 'signup') {
  const last = db
    .prepare(`SELECT created_at FROM otp_codes WHERE phone = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1`)
    .get(phone, purpose)

  if (last) {
    const elapsedMs = Date.now() - new Date(last.created_at).getTime()
    if (elapsedMs < RESEND_COOLDOWN_SECONDS * 1000) {
      const wait = Math.ceil((RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000)
      throw new OtpError(`Please wait ${wait}s before requesting another code.`, 429)
    }
  }

  const code = generateOtp()
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString()

  // Send first — if delivery fails we don't want a code in the database that
  // the user can never receive and therefore can never use.
  await deliverOtp(phone, code)

  db.prepare(
    'INSERT INTO otp_codes (id, phone, code, purpose, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(uid('otp'), phone, code, purpose, expires)

  return code
}

export function verifyOtp(phone, code, purpose = 'signup') {
  const row = db
    .prepare(
      `SELECT * FROM otp_codes
       WHERE phone = ? AND purpose = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(phone, purpose)

  if (!row) return { ok: false, reason: 'No code was requested for this number.' }
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'This code has expired.' }
  if (row.code !== String(code)) return { ok: false, reason: 'Incorrect code.' }

  db.prepare('UPDATE otp_codes SET consumed = 1 WHERE id = ?').run(row.id)
  return { ok: true }
}

// Lazily construct the Twilio client so the app still boots fine (and runs in
// dev/console mode) when Twilio credentials aren't configured.
let twilioClient = null
let twilioInitAttempted = false

function getTwilioClient() {
  if (twilioInitAttempted) return twilioClient
  twilioInitAttempted = true
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null
  try {
    twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  } catch (err) {
    console.error('[otp] Failed to initialize Twilio client:', err.message)
    twilioClient = null
  }
  return twilioClient
}

/**
 * Sends the OTP to the user. Uses Twilio when TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN
 * (and either TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER) are configured.
 * Falls back to printing the code to the server console so the flow is still
 * fully testable in local development without an SMS bill.
 */
async function deliverOtp(phone, code) {
  const client = getTwilioClient()
  const message = `Your Kaya verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`

  if (!client) {
    console.log(`\n📲  [DEV OTP] ${phone} → ${code}  (valid ${OTP_TTL_MINUTES} min)\n`)
    return
  }

  const { TWILIO_MESSAGING_SERVICE_SID, TWILIO_FROM_NUMBER } = process.env
  if (!TWILIO_MESSAGING_SERVICE_SID && !TWILIO_FROM_NUMBER) {
    console.error('[otp] Twilio is configured but neither TWILIO_MESSAGING_SERVICE_SID nor TWILIO_FROM_NUMBER is set.')
    throw new OtpError('SMS delivery is not fully configured. Please try again later.', 502)
  }

  try {
    await client.messages.create({
      to: phone,
      body: message,
      ...(TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: TWILIO_MESSAGING_SERVICE_SID }
        : { from: TWILIO_FROM_NUMBER }),
    })
  } catch (err) {
    // Twilio error codes: https://www.twilio.com/docs/api/errors
    console.error('[otp] Twilio send failed:', err.code, err.message)
    if (err.code === 21211 || err.code === 21614) {
      throw new OtpError('That phone number looks invalid — please check it and try again.', 400)
    }
    if (err.code === 21610) {
      throw new OtpError('This phone number has opted out of SMS messages.', 400)
    }
    throw new OtpError('Could not send the verification code right now. Please try again shortly.', 502)
  }
}
