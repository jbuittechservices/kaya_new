const SOURCES = {
  light: '/brand/logo-light.png', // white wordmark — use on dark backgrounds
  dark: '/brand/logo-dark.png', // black wordmark — use on white/light backgrounds
  blue: '/brand/logo-blue.png', // brand-blue wordmark — accent use on white backgrounds
}

// Natural aspect ratio of the source asset (280x66)
const ASPECT = 280 / 66

export default function Logo({ variant = 'dark', height = 24, className = '' }) {
  return (
    <img
      src={SOURCES[variant] || SOURCES.dark}
      alt="Kaya"
      height={height}
      width={Math.round(height * ASPECT)}
      className={className}
      draggable={false}
    />
  )
}
