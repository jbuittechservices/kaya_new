export function formatNaira(amount) {
  const n = Number(amount) || 0
  return `₦${n.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`
}

export function formatTime(dateLike) {
  const d = new Date(dateLike)
  return d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
}

export function formatDate(dateLike) {
  const d = new Date(dateLike)
  return d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

export function timeAgo(dateLike) {
  const seconds = Math.floor((Date.now() - new Date(dateLike).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}
