import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db, uid } from './db.js'

async function upsertUser({ name, phone, email, password, role, vehicle, plate, walletBalance = 0 }) {
  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (existing) return existing.id
  const id = uid('usr')
  const hash = await bcrypt.hash(password, 10)
  db.prepare(
    `INSERT INTO users (id, name, phone, email, password_hash, role, wallet_balance, rider_vehicle, rider_plate, onboarding_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    phone,
    email,
    hash,
    role,
    walletBalance,
    vehicle || null,
    plate || null,
    role === 'driver' ? JSON.stringify({ personalInfo: true, documents: true, guarantor: true }) : null
  )
  return id
}

async function main() {
  console.log('Seeding Kaya database…\n')

  await upsertUser({
    name: 'Kaya Admin',
    phone: '+2348000000000',
    email: 'admin@kaya.app',
    password: process.env.SEED_ADMIN_PASSWORD || 'KayaAdmin!2026',
    role: 'admin',
  })

  const customerId = await upsertUser({
    name: 'Benjamin Uwa',
    phone: '+2348030001122',
    email: 'ben@officialbedamtech.com',
    password: 'Password123',
    role: 'customer',
    walletBalance: 8400,
  })

  const riderId = await upsertUser({
    name: 'Emeka Johnson',
    phone: '+2348032219081',
    email: 'emeka@kaya.app',
    password: 'Password123',
    role: 'driver',
    vehicle: 'Bajaj Boxer · Red',
    plate: 'KJA 442 XL',
    walletBalance: 4200,
  })

  db.prepare(`UPDATE users SET rider_rating = 4.9, rider_trips = 1284 WHERE id = ?`).run(riderId)

  const existingLocations = db.prepare('SELECT COUNT(*) n FROM saved_locations WHERE user_id = ?').get(customerId).n
  if (existingLocations === 0) {
    const locations = [
      ['Home', '14 Admiralty Way, Lekki Phase 1, Lagos', 'home'],
      ['Office', '3rd Floor, Landmark Towers, Water Corp Rd, VI', 'briefcase'],
      ["Neriah's School", 'Greensprings School, Anthony, Lagos', 'backpack'],
    ]
    for (const [label, address, icon] of locations) {
      db.prepare('INSERT INTO saved_locations (id, user_id, label, address, icon) VALUES (?, ?, ?, ?, ?)').run(
        uid('loc'),
        customerId,
        label,
        address,
        icon
      )
    }
  }

  console.log('✅ Seed complete.\n')
  console.log('Admin login   → phone: +2348000000000  password:', process.env.SEED_ADMIN_PASSWORD || 'KayaAdmin!2026')
  console.log('Customer login→ phone: +2348030001122  password: Password123')
  console.log('Driver login  → phone: +2348032219081  password: Password123\n')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
