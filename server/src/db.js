import { DatabaseSync } from 'node:sqlite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

const DB_PATH = path.join(DATA_DIR, 'kaya.db')
export const db = new DatabaseSync(DB_PATH)

db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer', -- customer | driver | admin
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended
  wallet_balance INTEGER NOT NULL DEFAULT 0,
  rider_rating REAL DEFAULT NULL,
  rider_trips INTEGER DEFAULT 0,
  rider_vehicle TEXT,
  rider_plate TEXT,
  onboarding_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup', -- signup | reset
  expires_at TEXT NOT NULL,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS saved_locations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  address TEXT NOT NULL,
  icon TEXT DEFAULT 'map-pin',
  lat REAL,
  lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|searching|found|enroute|arrived|in_transit|delivered|cancelled
  pickup TEXT NOT NULL,
  dropoff TEXT NOT NULL,
  pickup_lat REAL,
  pickup_lng REAL,
  dropoff_lat REAL,
  dropoff_lng REAL,
  category TEXT NOT NULL DEFAULT 'parcel',
  vehicle TEXT NOT NULL DEFAULT 'bike',
  price INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  note TEXT,
  sender_phone TEXT,
  recipient_phone TEXT,
  rating INTEGER,
  rating_comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- credit | debit
  label TEXT NOT NULL,
  amount INTEGER NOT NULL,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'successful', -- successful|pending|failed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  order_id TEXT REFERENCES orders(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_rider ON orders(rider_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_txn_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_txn_created ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_created ON users(created_at);
`)

// Safe migration: add columns that may not exist on a database created before this change.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
}
ensureColumn('orders', 'pickup_lat', 'pickup_lat REAL')
ensureColumn('orders', 'pickup_lng', 'pickup_lng REAL')
ensureColumn('orders', 'dropoff_lat', 'dropoff_lat REAL')
ensureColumn('orders', 'dropoff_lng', 'dropoff_lng REAL')
ensureColumn('saved_locations', 'lat', 'lat REAL')
ensureColumn('saved_locations', 'lng', 'lng REAL')
ensureColumn('users', 'bank_name', 'bank_name TEXT')
ensureColumn('users', 'bank_account_number', 'bank_account_number TEXT')
ensureColumn('users', 'bank_account_name', 'bank_account_name TEXT')
ensureColumn('users', 'documents_json', 'documents_json TEXT')
ensureColumn('users', 'customer_rating', 'customer_rating REAL DEFAULT NULL')
ensureColumn('users', 'customer_rating_count', 'customer_rating_count INTEGER DEFAULT 0')
// 'rating'/'rating_comment' (already on orders) is the customer's rating OF the rider.
// These are the reverse direction — the rider's rating OF the customer.
ensureColumn('orders', 'customer_rating', 'customer_rating INTEGER')
ensureColumn('orders', 'customer_rating_comment', 'customer_rating_comment TEXT')
ensureColumn('users', 'vehicle_type', 'vehicle_type TEXT') // 'bike' | 'car' | 'van' — must match order.vehicle for dispatch matching
ensureColumn('users', 'guarantor_name', 'guarantor_name TEXT')
ensureColumn('users', 'guarantor_phone', 'guarantor_phone TEXT')
ensureColumn('users', 'guarantor_relationship', 'guarantor_relationship TEXT')
ensureColumn('users', 'guarantor_address', 'guarantor_address TEXT')
ensureColumn('conversations', 'customer_last_read_at', 'customer_last_read_at TEXT')
ensureColumn('conversations', 'rider_last_read_at', 'rider_last_read_at TEXT')

db.exec(`
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`)

// One-time cleanup for deployments that already exist from before ratings had a real
// "no rating yet" state: every driver/customer used to start with a fabricated 4.8/5.0
// shown as if it were earned. Only touches accounts with zero actual trips/ratings
// behind them — anyone with real history keeps their real (possibly coincidentally
// identical-looking) earned average untouched.
db.exec(`
  UPDATE users SET rider_rating = NULL WHERE role = 'driver' AND rider_rating = 4.8 AND (rider_trips IS NULL OR rider_trips = 0);
  UPDATE users SET customer_rating = NULL WHERE customer_rating = 5.0 AND (customer_rating_count IS NULL OR customer_rating_count = 0);
`)

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}
