import { Link } from 'react-router-dom'
import { Zap, MapPin, ShieldCheck, Star, Bike } from 'lucide-react'
import Button from '../components/ui/Button'
import MapBackdrop from '../components/ui/MapBackdrop'
import Logo from '../components/ui/Logo'

const FEATURES = [
  { icon: Zap, title: 'Riders in minutes', desc: 'The nearest verified rider is matched to your pickup point instantly.' },
  { icon: MapPin, title: 'Live tracking', desc: 'Watch your package move on the map from pickup to drop-off, in real time.' },
  { icon: ShieldCheck, title: 'Insured deliveries', desc: 'Every trip is covered, so you can send valuables with confidence.' },
]

const STEPS = [
  { n: '01', title: 'Tell us where', desc: 'Drop your pickup and delivery address, or pick a saved location.' },
  { n: '02', title: 'Get matched', desc: 'A nearby rider or driver accepts your request in seconds.' },
  { n: '03', title: 'Track & relax', desc: 'Follow the trip live and get notified the moment it arrives.' },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-cream-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-2">
          <Logo variant="dark" height={26} />
        </div>
        <div className="flex items-center gap-2">
          <Button as={Link} to="/signin" variant="ghost" size="sm" className="hidden sm:inline-flex">
            Log in
          </Button>
          <Button as={Link} to="/signup" variant="dark" size="sm">
            Get started
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-navy-900 px-5 py-14 md:px-16 md:py-20">
        <MapBackdrop className="absolute inset-0 opacity-[0.08]" />
        <div className="relative grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-amber-300">
              Now live across Lagos
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] text-white md:text-5xl">
              Send it. Track it. <span className="text-amber-400">Kaya it.</span>
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/70">
              Book a rider or driver in seconds, watch your delivery move on the map, and get things
              where they need to be — every time.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button as={Link} to="/signup" size="lg">
                Get started free
              </Button>
              <Button as={Link} to="/signin" variant="outline-light" size="lg">
                I already have an account
              </Button>
            </div>
            <div className="mt-10 flex gap-8">
              <div>
                <p className="text-2xl font-extrabold text-white">12k+</p>
                <p className="text-xs text-white/50">Deliveries a month</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-2xl font-extrabold text-white">
                  4.9 <Star size={18} className="fill-[#FFB800] text-[#FFB800]" />
                </p>
                <p className="text-xs text-white/50">Average rating</p>
              </div>
              <div>
                <p className="text-2xl font-extrabold text-white">6 min</p>
                <p className="text-xs text-white/50">Avg. match time</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="animate-slide-up rounded-3xl bg-white p-4 shadow-2xl">
              <MapBackdrop className="h-48 rounded-2xl">
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 300 200">
                  <path d="M40 150 C 90 90, 150 130, 220 50" stroke="#0A0A0A" strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" fill="none" />
                  <circle cx="40" cy="150" r="7" fill="#0A0A0A" />
                  <circle cx="220" cy="50" r="7" fill="#00ABFD" />
                </svg>
              </MapBackdrop>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                  <Bike size={20} className="text-amber-700" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-navy-950">Emeka is on the way</p>
                  <p className="text-xs text-slate-muted">Arriving in 4 min · Bajaj Boxer</p>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">Live</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16 md:px-8">
        <h2 className="text-2xl font-extrabold text-navy-950 md:text-3xl">Built for how Lagos moves</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-3xl bg-white p-6 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
                <f.icon size={22} className="text-amber-600" strokeWidth={1.8} />
              </div>
              <h3 className="text-lg font-bold text-navy-950">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
        <div className="rounded-[2rem] bg-navy-900 px-6 py-12 md:px-14">
          <h2 className="text-2xl font-extrabold text-white md:text-3xl">Three steps to done</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="text-sm font-bold text-amber-400">{s.n}</p>
                <h3 className="mt-2 text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
          <Button as={Link} to="/signup" className="mt-10">
            Create your account
          </Button>
        </div>
      </section>

      {/* Driver CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-navy-900/10 bg-white p-8 md:flex-row md:items-center">
          <div>
            <h3 className="text-xl font-extrabold text-navy-950">Ride and earn with Kaya</h3>
            <p className="mt-1 max-w-md text-sm text-slate-muted">
              Sign up as a rider, accept delivery requests nearby, and get paid out weekly.
            </p>
          </div>
          <Button as={Link} to="/driver/signin" variant="dark">
            Become a rider
          </Button>
        </div>
      </section>

      <footer className="border-t border-navy-900/8 px-5 py-8 text-center text-xs text-slate-muted">
        © {new Date().getFullYear()} Kaya Technologies. All rights reserved.
      </footer>
    </div>
  )
}
