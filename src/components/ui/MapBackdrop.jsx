export default function MapBackdrop({ className = '', children, dim = false }) {
  return (
    <div className={`relative overflow-hidden bg-cream-200 ${className}`}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="500" fill="#F4F6F8" />
        <g stroke="#E2E8EE" strokeWidth="10">
          <path d="M-20 90 H420" />
          <path d="M-20 230 H420" />
          <path d="M-20 370 H420" />
          <path d="M70 -20 V520" />
          <path d="M210 -20 V520" />
          <path d="M330 -20 V520" />
        </g>
        <g stroke="#EDF1F5" strokeWidth="3">
          <path d="M-20 150 H420" />
          <path d="M-20 300 H420" />
          <path d="M140 -20 V520" />
          <path d="M270 -20 V520" />
        </g>
        <g fill="#E6EBF0">
          <rect x="30" y="20" width="26" height="40" rx="3" />
          <rect x="100" y="110" width="34" height="52" rx="3" />
          <rect x="240" y="30" width="40" height="34" rx="3" />
          <rect x="300" y="120" width="26" height="60" rx="3" />
          <rect x="40" y="260" width="44" height="30" rx="3" />
          <rect x="160" y="250" width="30" height="46" rx="3" />
          <rect x="250" y="270" width="50" height="34" rx="3" />
          <rect x="60" y="400" width="30" height="44" rx="3" />
          <rect x="180" y="400" width="46" height="30" rx="3" />
          <rect x="290" y="390" width="34" height="52" rx="3" />
        </g>
        <circle cx="150" cy="200" r="60" fill="#E3F6FF" opacity="0.8" />
        <circle cx="330" cy="330" r="40" fill="#E3F6FF" opacity="0.7" />
      </svg>
      {dim && <div className="absolute inset-0 bg-navy-950/10" />}
      {children}
    </div>
  )
}
