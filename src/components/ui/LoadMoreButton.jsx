import Button from './Button'

export default function LoadMoreButton({ shown, total, loading, onClick }) {
  if (shown >= total) return null
  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      <p className="text-xs text-slate-muted">
        Showing {shown} of {total}
      </p>
      <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
        {loading ? 'Loading…' : 'Load more'}
      </Button>
    </div>
  )
}
