import webpush from 'web-push'
import { db, uid } from '../db.js'

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
export const pushConfigured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

if (pushConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:support@example.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

export function saveSubscription(userId, subscription) {
  const { endpoint, keys } = subscription
  if (!endpoint || !keys?.p256dh || !keys?.auth) throw new Error('Invalid subscription')
  // A given browser/device endpoint is unique — re-subscribing (e.g. after clearing site
  // data) replaces whatever was there before rather than creating duplicate rows.
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint)
  db.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)').run(
    uid('push'),
    userId,
    endpoint,
    keys.p256dh,
    keys.auth
  )
}

export function removeSubscription(endpoint) {
  db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint)
}

/**
 * Sends a push notification to every device a user has subscribed on. Never throws —
 * a notification failing to send must never break the API request that triggered it
 * (e.g. a customer's order should still get created even if their push send fails).
 * Dead subscriptions (expired/uninstalled — Web Push returns 404/410 for these) are
 * cleaned up automatically so the table doesn't accumulate stale rows forever.
 */
export async function sendPushToUser(userId, { title, body, url, tag }) {
  if (!pushConfigured) return
  const subs = db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId)
  if (subs.length === 0) return

  const payload = JSON.stringify({ title, body, url, tag })

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload)
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          removeSubscription(sub.endpoint)
        } else {
          console.error('[push] send failed:', err.statusCode, err.message)
        }
      }
    })
  )
}

/** Pushes to every active driver who has notifications enabled — used for new delivery broadcasts. */
export async function sendPushToActiveDrivers(payload, excludeUserId, vehicleType) {
  if (!pushConfigured) return
  const rows = db
    .prepare(
      `SELECT DISTINCT u.id, u.onboarding_json, u.vehicle_type FROM users u
       JOIN push_subscriptions ps ON ps.user_id = u.id
       WHERE u.role = 'driver' AND u.status = 'active' AND u.id != ?`
    )
    .all(excludeUserId || '')

  const eligible = rows.filter((r) => {
    const onboarding = r.onboarding_json ? JSON.parse(r.onboarding_json) : {}
    const verified = !!(onboarding.personalInfo && onboarding.documents && onboarding.guarantor)
    if (!verified) return false
    return !vehicleType || r.vehicle_type === vehicleType
  })

  await Promise.all(eligible.map((r) => sendPushToUser(r.id, payload)))
}
