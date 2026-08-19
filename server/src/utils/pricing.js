import { db } from '../db.js'

// Reasonable starting rates until an admin tunes them — roughly matches what a flat
// ~5km/~15min trip used to cost under the old flat-price model, so this isn't a jarring
// change on day one, while now genuinely scaling with the actual distance and duration.
const DEFAULT_PRICING = {
  bike: { base: 400, perKm: 100, perMinute: 20 },
  car: { base: 800, perKm: 180, perMinute: 35 },
  van: { base: 1500, perKm: 450, perMinute: 80 },
}
const SETTINGS_KEY = 'vehicle_pricing_v2'
const ASSUMED_KMH = 25 // rough average urban speed used to turn distance into an estimated duration
const AVG_TRIP_KM = 5 // used only when we have no coordinates to work with at all
const AVG_TRIP_MIN = 15

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Returns the current per-vehicle-type rate structure — admin-configured if set, defaults otherwise. */
export function getPricing() {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(SETTINGS_KEY)
  if (!row) return structuredClone(DEFAULT_PRICING)
  try {
    const stored = JSON.parse(row.value)
    const merged = structuredClone(DEFAULT_PRICING)
    for (const vehicle of Object.keys(DEFAULT_PRICING)) {
      if (stored[vehicle]) merged[vehicle] = { ...merged[vehicle], ...stored[vehicle] }
    }
    return merged
  } catch {
    return structuredClone(DEFAULT_PRICING)
  }
}

/** Persists new rates. Only accepts known vehicle types with positive numeric fields. */
export function setPricing(patch) {
  const next = getPricing()
  for (const vehicle of Object.keys(DEFAULT_PRICING)) {
    if (!patch[vehicle]) continue
    for (const field of ['base', 'perKm', 'perMinute']) {
      if (field in patch[vehicle]) {
        const amount = Number(patch[vehicle][field])
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error(`Invalid ${field} for ${vehicle}`)
        }
        next[vehicle][field] = Math.round(amount)
      }
    }
  }
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(SETTINGS_KEY, JSON.stringify(next))
  return next
}

/**
 * Computes a real fare from actual distance and estimated time, using admin-configured
 * per-vehicle rates. Distance comes from real pickup/dropoff coordinates via the
 * haversine formula (straight-line, nudged up ~25% to roughly account for real road
 * routing not being a straight line) — this needs no external routing API call, no
 * extra cost, and is always available since coordinates are already captured at booking.
 * Falls back to an assumed average trip length when coordinates aren't available (e.g.
 * an address was typed without selecting an autocomplete suggestion).
 */
export function priceFor(vehicle, pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const pricing = getPricing()
  const rates = pricing[vehicle] || pricing.bike

  const hasCoords = [pickupLat, pickupLng, dropoffLat, dropoffLng].every((n) => typeof n === 'number' && Number.isFinite(n))
  const distanceKm = hasCoords ? haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng) * 1.25 : AVG_TRIP_KM
  const minutes = hasCoords ? (distanceKm / ASSUMED_KMH) * 60 : AVG_TRIP_MIN

  const price = rates.base + rates.perKm * distanceKm + rates.perMinute * minutes
  return Math.max(Math.round(price), rates.base)
}

/** Same math as priceFor, but returns the breakdown too — used to show an estimate before booking. */
export function estimateFor(vehicle, pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const pricing = getPricing()
  const rates = pricing[vehicle] || pricing.bike
  const hasCoords = [pickupLat, pickupLng, dropoffLat, dropoffLng].every((n) => typeof n === 'number' && Number.isFinite(n))
  const distanceKm = hasCoords ? haversineKm(pickupLat, pickupLng, dropoffLat, dropoffLng) * 1.25 : AVG_TRIP_KM
  const minutes = hasCoords ? (distanceKm / ASSUMED_KMH) * 60 : AVG_TRIP_MIN
  const price = Math.max(Math.round(rates.base + rates.perKm * distanceKm + rates.perMinute * minutes), rates.base)
  return { price, distanceKm: Math.round(distanceKm * 10) / 10, minutes: Math.round(minutes) }
}
