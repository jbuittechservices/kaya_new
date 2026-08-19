import { db } from '../db.js'

const DEFAULT_PRICES = { bike: 1200, car: 2400, van: 5600 }
const SETTINGS_KEY = 'vehicle_pricing'

/** Returns the current per-vehicle-type prices — admin-configured if set, defaults otherwise. */
export function getPricing() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY)
  if (!row) return { ...DEFAULT_PRICES }
  try {
    const stored = JSON.parse(row.value)
    return { ...DEFAULT_PRICES, ...stored }
  } catch {
    return { ...DEFAULT_PRICES }
  }
}

/** Persists new prices. Only accepts known vehicle types with positive integer amounts. */
export function setPricing(patch) {
  const current = getPricing()
  const next = { ...current }
  for (const key of Object.keys(DEFAULT_PRICES)) {
    if (key in patch) {
      const amount = Number(patch[key])
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(`Invalid price for ${key}`)
      }
      next[key] = Math.round(amount)
    }
  }
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(SETTINGS_KEY, JSON.stringify(next))
  return next
}

export function priceFor(vehicle) {
  const prices = getPricing()
  return prices[vehicle] ?? prices.bike
}
