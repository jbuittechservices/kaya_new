const INSECURE_JWT_DEFAULT = 'kaya-dev-secret-change-me'

/**
 * Refuses to boot with a known-insecure JWT secret in production. Without this,
 * a deployment that forgets to set JWT_SECRET would start up "successfully" but
 * sign tokens with a secret that's sitting in this repo's source code — anyone
 * could forge a valid session (including an admin one) for any account.
 */
export function checkEnv() {
  const isProd = process.env.NODE_ENV === 'production'
  const secret = process.env.JWT_SECRET

  if (isProd && (!secret || secret === INSECURE_JWT_DEFAULT || secret.length < 16)) {
    console.error(
      '\n✖ Refusing to start: JWT_SECRET is missing, too short, or still the default dev value.\n' +
        '  Set a long random secret before running in production, e.g.:\n' +
        '  JWT_SECRET=$(openssl rand -hex 32)\n'
    )
    process.exit(1)
  }

  if (isProd && (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN.includes('localhost'))) {
    console.warn(
      '\n⚠ CORS_ORIGIN is unset or still points at localhost while NODE_ENV=production.\n' +
        '  Your deployed frontend will be blocked by CORS until you set this to its real origin.\n'
    )
  }

  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn('⚠ Twilio is not configured — OTP codes will be printed to this console instead of texted.')
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.warn('⚠ Paystack is not configured — wallet top-ups will be credited instantly (simulated).')
  }

  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.warn('⚠ Push notifications are not configured — order/message pushes will silently no-op. Run `npx web-push generate-vapid-keys` to set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY.')
  }
}
