import { NavLink } from 'react-router-dom'

const ICONS = {
  home: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 11.5 12 4l8 7.5" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  orders: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" />
      <path d="M8 6V5a4 4 0 0 1 8 0v1" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" strokeLinecap="round" />
      <path d="M8 12h8M8 16h5" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  wallet: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="6" width="18" height="13" rx="2.5" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" />
      <path d="M3 10h18" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" />
      <circle cx="16.5" cy="14.5" r="1.4" fill={a ? '#00ABFD' : '#0A0A0A66'} />
    </svg>
  ),
  messages: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  account: (a) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.4" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" />
      <path d="M4.5 20c1.4-3.6 4.4-5.6 7.5-5.6s6.1 2 7.5 5.6" stroke={a ? '#00ABFD' : '#0A0A0A66'} strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
}

const DEFAULT_TABS = [
  { to: '/app', label: 'Home', icon: 'home', end: true },
  { to: '/app/orders', label: 'Orders', icon: 'orders' },
  { to: '/app/wallet', label: 'Wallet', icon: 'wallet' },
  { to: '/app/messages', label: 'Messages', icon: 'messages' },
  { to: '/app/account', label: 'Account', icon: 'account' },
]

export default function MobileTabBar({ tabs = DEFAULT_TABS, unreadCount = 0 }) {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-navy-900/8 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className="tap flex flex-1 flex-col items-center gap-1 py-2.5"
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  {ICONS[tab.icon](isActive)}
                  {tab.icon === 'messages' && unreadCount > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] font-semibold ${isActive ? 'text-amber-600' : 'text-navy-900/45'}`}>
                  {tab.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
