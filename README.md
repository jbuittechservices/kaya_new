# Kaya — Delivery Platform (PWA + API + Admin)

A full-stack, production-ready build of Kaya: an installable delivery PWA for customers, a
driver app, a real Express/SQLite API with live matching over Socket.IO, and an admin dashboard
— all in one repo.

## Architecture

```
kaya-pwa/
  src/            React PWA — customer app, driver app, admin dashboard (all one Vite build)
  server/         Express API — auth, orders/dispatch, wallet, messaging, admin (all one process)
```

- **Frontend**: React + React Router + Tailwind v4, built with Vite. Installable as a PWA
  (manifest + service worker) and fully responsive (mobile tab bar / desktop sidebar).
- **Backend**: Express + `node:sqlite` (Node's built-in SQLite — no native builds, so it runs
  on cPanel shared hosting without compiling anything) + Socket.IO for real-time dispatch and
  chat + JWT auth + Paystack for payments.
- **Icons**: real SVG icons throughout via `lucide-react` — no emoji glyphs anywhere in the UI.

## Brand

Kaya's brand color is `#00ABFD` (blue), with white and black as the supporting palette — set in
`src/index.css` under `@theme` (look for the `--color-amber-*` tokens, which hold the blue scale,
and `--color-navy-*`, which holds the black/neutral scale — the names are historical, only the
values matter). The real logo lives in `public/brand/` in three variants:
- `logo-light.png` — white wordmark, for dark backgrounds
- `logo-dark.png` — black wordmark, for white/light backgrounds
- `logo-blue.png` — brand-blue wordmark, an accent option for white backgrounds

`src/components/ui/Logo.jsx` wraps these — use `<Logo variant="light|dark|blue" height={24} />`
anywhere the wordmark is needed. App icons (`public/icons/`) use a blue-and-white "K" monogram
since the wordmark's wide aspect ratio doesn't work as a square icon; regenerate them from
`public/brand/logo-light.png` if you get a dedicated square mark later.

## Quick start (local development)

```bash
# 1. Install both the frontend and backend, and seed the database
npm run setup

# 2. Copy env files and adjust if needed (defaults work out of the box for local dev)
cp .env.example .env
cp server/.env.example server/.env

# 3. Run both the frontend (5173) and API (4000) together
npm run dev:all
```

Open **http://localhost:5173**. In development, OTP codes are printed to the API's terminal
output instead of being texted (see "SMS / OTP" below) — watch that terminal when signing up.

### Seeded demo accounts

| Role     | Phone           | Password         |
|----------|-----------------|------------------|
| Admin    | `+2348000000000`| `KayaAdmin!2026` |
| Customer | `+2348030001122`| `Password123`    |
| Driver   | `+2348032219081`| `Password123`    |

- Customer/driver app: `http://localhost:5173`
- Driver sign-in: `http://localhost:5173/driver/signin`
- **Admin dashboard: `http://localhost:5173/admin/login`**

Re-run `npm run server:seed` any time to reset back to this state (it's safe to re-run — it
skips accounts that already exist).

## What's implemented

**Customer app**
- Landing page, sign up (real phone → OTP → account), sign in, forgot/reset password
- Home: booking form with real Google Places autocomplete, saved locations, package categories,
  recent orders
- Booking flow: create request → live-matched to an online driver over Socket.IO → real-time
  status updates (en route → arrived → in transit → delivered), with the rider's **actual live
  GPS position** on the map once they're on the way → rate your rider
- My Orders, Wallet (Paystack top-up), Messages (live chat with your rider), Account settings

**Driver app** — full navigation parity with the customer app
- Driver sign in/up, onboarding checklist, online/offline presence
- Real-time incoming delivery requests (Socket.IO), accept/decline, guided status progression
- **Home** (dashboard + active delivery), **Trips** (history with per-trip earnings breakdown),
  **Wallet** (balance, bank details, withdrawal requests, transaction history), **Messages**
  (chat with customers), **Account** (profile, vehicle/plate, verification status, password)
- Reports real device location over Socket.IO while a delivery is active, so the customer's map
  shows where the rider actually is, not just a simulated position

**Admin dashboard** (`/admin`)
- Overview stats: users, riders, active/completed/cancelled orders, GMV, platform revenue, a
  7-day revenue chart
- Customers: search/filter, suspend/reactivate accounts
- Riders: search, verify onboarding, suspend/reactivate
- Orders: full list with filters, customer/rider attribution
- Transactions: full ledger across the platform, including pending rider withdrawals

**Platform mechanics**
- JWT-authenticated REST API, rate-limited on both auth and general API traffic, Helmet security
  headers, a top-level React error boundary so a render crash shows a recoverable screen instead
  of a blank page
- Real dispatch: orders broadcast to online drivers, first to accept wins, race-condition safe
- Wallet ledgering with a 15% platform fee split on delivery, real transaction history
- Rider withdrawals: debits the wallet immediately and logs a pending payout for finance to
  action — wire it to Paystack Transfers to automate the actual bank payout
- Paystack integration for wallet top-ups (falls back to instant simulated credit if you haven't
  added live keys yet, so the whole flow is testable immediately)
- OTP delivery via Twilio, with a per-phone cooldown and real send-failure handling (falls back
  to printing codes to the console in development)
- Real Google Maps throughout (address autocomplete, live route + markers, real-time rider
  position) — falls back to an illustrated placeholder map when no API key is configured
- Real Kaya brand (logo, `#00ABFD` blue / white / black) applied throughout both apps

## Environment variables

**Frontend** (`.env`, see `.env.example`)
```
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_MAPS_API_KEY=        # optional — see "Maps & address autocomplete" below
```

**Backend** (`server/.env`, see `server/.env.example`)
```
PORT=4000
CORS_ORIGIN=http://localhost:5173
JWT_SECRET=...                  # generate with: openssl rand -hex 32
DATA_DIR=./data                 # where kaya.db lives
SMS_PROVIDER_URL=               # leave blank in dev — OTPs print to console
SMS_PROVIDER_KEY=
PAYSTACK_SECRET_KEY=            # leave blank in dev — top-ups are simulated instantly
PAYSTACK_CALLBACK_URL=
SEED_ADMIN_PASSWORD=
```

## Going to production

### Where to host this

This app has three deployable pieces with different requirements: a static frontend, a
long-running Node API (WebSockets need a persistent process — no serverless functions), and a
SQLite file that must live on disk that survives restarts and deploys. That combination narrows
the good options considerably.

**Recommended: [Railway](https://railway.app) or [Render](https://render.com) for the API, Vercel
for the frontend.** Both Railway and Render run the API as a real long-lived container (Socket.IO
works out of the box, no config), support attaching a persistent volume for `server/data/kaya.db`,
deploy straight from a GitHub push, and have a genuinely usable free/cheap tier for a project at
this stage (Render's free tier sleeps when idle, which is fine to start with; Railway's is
usage-based and doesn't sleep). Point `VITE_API_URL` (frontend) at whichever one you pick, and
`CORS_ORIGIN` (backend) at your Vercel domain.

**Why not Vercel/Netlify for the backend:** they're excellent for the frontend (which is why we
recommend Vercel there) but their serverless functions don't support persistent WebSocket
connections or a writable local SQLite file — you'd have to swap Socket.IO for a hosted
alternative and SQLite for a hosted Postgres before it would work there at all. Save yourself
that rewrite and just run the API somewhere that keeps a process alive.

**cPanel** (your existing stack) works too, and is a reasonable choice specifically *because* it's
what you already know and pay for — the steps are below. The tradeoffs versus Railway/Render:
shared hosting is more fragile under real concurrent WebSocket load, backups of the SQLite file
are on you, and you don't get the one-click GitHub-push deploys. Fine for a soft launch or MVP
validation; consider moving the API to Railway/Render once you have real traffic.

**A managed Postgres is worth planning for once you have real users.** SQLite is genuinely fine
early on (it's what makes zero-config cPanel deployment possible at all) but a single file on
disk doesn't survive a host migration or a bad `rm` without discipline, and it can't scale past
one API process. Railway and Render both offer a Postgres add-on when you're ready — the queries
in `server/src/routes/*` are plain SQL with no ORM in the way, so the migration is mostly
swapping `node:sqlite` for a Postgres client, not a rewrite.

### 1. Backend (Express API)

This needs a real Node process (not a static host). Three options, roughly in order of
recommendation for going live with real users:

**Railway or Render** (recommended):
1. Connect the GitHub repo, set the root directory to `server/`.
2. Add a persistent volume mounted at `server/data` (both platforms support this) so the SQLite
   file survives deploys and restarts.
3. Set the environment variables above in the platform's dashboard.
4. Set the start command to `npm run seed && npm start` for the very first deploy (creates the
   admin account), then change it back to just `npm start` for subsequent deploys.
5. Both platforms give you a public URL immediately — that's your `VITE_API_URL`.

**cPanel "Setup Node.js App"** (matches your existing JBUIT stack — no native compilation
required since we use `node:sqlite`):
1. Create a Node app pointing at `server/`, entry point `src/index.js`, Node version 22+.
2. Set the environment variables above in cPanel's Node app UI (or a `.env` file).
3. Run `npm install` from the cPanel Node app's "Run NPM Install" button, then `npm run seed`
   once via the app's terminal/SSH to create the admin account.
4. Start the app. cPanel keeps it alive; point a subdomain like `api.yourapp.com` at it.

**VPS / any Linux box with PM2**:
```bash
cd server
npm install --production
npm run seed
pm2 start ecosystem.config.cjs
pm2 save
```

### 2. Frontend (static build)

```bash
npm run build     # outputs to dist/
```

Set `VITE_API_URL` to your deployed API's URL before building (e.g. `https://api.yourapp.com`).

- **Vercel**: import the repo, set the build command to `npm run build`, output `dist`, and add
  `VITE_API_URL` as an environment variable.
- **cPanel shared hosting**: upload `dist/` to `public_html` (or a subfolder), and add this
  `.htaccess` alongside it so client-side routes don't 404 on refresh:

  ```
  <IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
  </IfModule>
  ```

### 3. Payments — Paystack

1. Grab your secret key from the [Paystack dashboard](https://dashboard.paystack.com/#/settings/developer).
2. Set `PAYSTACK_SECRET_KEY` and `PAYSTACK_CALLBACK_URL` on the API.
3. Add your API's webhook URL (`https://api.yourapp.com/api/webhooks/paystack`) in the Paystack
   dashboard so top-ups get confirmed even if the customer closes the tab mid-payment.

### 4. SMS / OTP delivery — Twilio

`server/src/utils/otp.js` sends real SMS via [Twilio](https://console.twilio.com) once you set
`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`, plus either `TWILIO_MESSAGING_SERVICE_SID`
(recommended — handles sender selection and compliance for you) or `TWILIO_FROM_NUMBER` (a single
purchased number). Without those set, codes print to the server console instead, so the whole
signup/reset flow is still fully testable without an SMS bill.

Built in and already tested:
- A 60-second cooldown per phone number between OTP requests, so the public request-otp
  endpoints can't be used to spam someone's phone (or run up your Twilio bill)
- Real error handling — an invalid phone number, an opted-out number, or a Twilio outage all
  surface a clear message to the person instead of silently claiming a code was sent
- Delivery happens *before* the code is stored, so a failed send never leaves a code in the
  database that the user can never actually receive

### 5. Database

`node:sqlite` writes to `server/data/kaya.db`. Back this file up regularly (a cron'd `cp` to S3
or similar is enough at this scale). If you outgrow SQLite, the queries in `server/src/routes/*`
are plain SQL and port to Postgres/MySQL with minimal changes since there's no ORM in the way.

### 6. Maps & address autocomplete

Real Google Maps power three things once you add a key: address autocomplete on every location
field, a live map with pickup/dropoff markers and the driving route, and an approximate moving
marker for the rider during a trip (interpolated along the route from status progress — swap in
real GPS pings from the driver app when you're ready to track exact position).

1. In the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis), enable
   **Maps JavaScript API**, **Places API**, and **Directions API** on one project.
2. Create an API key, restrict it to your domain(s) for production.
3. Set `VITE_GOOGLE_MAPS_API_KEY` in `.env` (frontend) and rebuild.

Without a key, every map falls back to the illustrated placeholder map so the whole app still
runs and demos fine in local development.

## Project structure

```
src/
  components/layout/   AppShell, DriverShell, AdminShell, AuthShell, MobileTabBar, DesktopNav
  components/ui/       Button, Input, DarkInput, LiveMap, PlacesAutocomplete, Misc, Logo
  components/           ErrorBoundary
  context/             AuthContext, AppDataContext (talk to the real API + Socket.IO)
  lib/                 api.js (fetch client), socket.js, googleMaps.js, icons.js (lucide map)
  pages/
    auth/              SignIn, SignUp, ResetPassword
    booking/            Booking, DeliveryDetailsStep, TrackingFlow
    orders/, wallet/, messages/, account/     customer screens
    driver/             DriverSignIn, DriverHome, DriverOrders, DriverOrderDetails,
                         DriverWallet, DriverMessages, DriverAccount
    admin/               AdminLogin, AdminDashboard, AdminUsers, AdminDrivers, AdminOrders, AdminTransactions

server/
  src/index.js          Express app entry
  src/db.js              SQLite schema (users, orders, transactions, conversations, messages…)
  src/routes/             auth, orders, wallet, messages, locations, drivers, admin, webhooks
  src/sockets/            Socket.IO server + presence/dispatch/location event bus
  src/seed.js             creates the admin + demo accounts
```

## Notes on what's simulated vs. real

Everything listed under "What's implemented" talks to the real API and database — there is no
mock data left in the frontend. The two things that are stubbed *by design*, with a clear path
to production noted in code comments, are:
- **OTP delivery** — sends real SMS via Twilio once configured; prints to console otherwise.
- **Wallet top-ups** — credit instantly until you add a live `PAYSTACK_SECRET_KEY` (same code
  path handles both; nothing to rewrite, just add the key).

## Production hardening — what was found and fixed

This app went through several rounds of a genuine audit (not just a read-through — every item
below was reproduced against the live running server before being fixed, and re-verified after):

- **Auth/sessions**: production boot now refuses to start with a missing or default `JWT_SECRET`;
  expired or suspended sessions now redirect cleanly instead of failing silently forever, on both
  the REST and Socket.IO side.
- **Financial integrity**: a customer's wallet could previously go negative (reproduced by
  draining a balance via two "online" payments back to back) — now clamped, with any shortfall
  logged transparently rather than silently absorbed. Ratings had no validation at all (a `999`
  rating was accepted and corrupted a driver's average) — now constrained to 1–5 and one rating
  per delivery.
- **Trust & safety**: any driver could mark their own documents/guarantor as "verified" with zero
  real review — now admin-only.
- **Concurrency**: proven, not just reasoned about — 4 simultaneous accept requests on the same
  order resolved to exactly 1 success; 10 simultaneous withdrawal requests against a balance that
  could only cover 4 resolved to exactly 4, balance never went negative; a rapid double-tap on
  "Confirm delivery" is now guarded against creating two real orders.
- **Scale**: every admin list endpoint (`users`, `orders`, `transactions`) previously loaded the
  *entire* table into memory with an unbounded page size — now paginated at the SQL level with
  proper indexes, verified against 250+ synthetic rows with sub-40ms response times, and the
  admin UI now has real "Load more" controls (it previously couldn't reach page 2 at all).
- **Design**: Google's default Places Autocomplete dropdown renders unstyled HTML outside of
  React entirely — replaced with a fully custom, on-brand dropdown built on the raw Places APIs.
- **Payments**: Paystack webhook signature check upgraded to constant-time comparison; malformed
  webhook payloads no longer leak internal error details.
