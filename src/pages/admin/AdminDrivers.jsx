import { useEffect, useState } from 'react'
import { Search, Ban, CheckCircle2, BadgeCheck, Star, FileText, Eye, ChevronDown, X, AlertCircle } from 'lucide-react'
import { api, BASE_URL, getToken, avatarSrc } from '../../lib/api'
import { Avatar, Card } from '../../components/ui/Misc'
import LoadMoreButton from '../../components/ui/LoadMoreButton'

const PAGE_SIZE = 20
const DOC_LABELS = { id: 'Government ID', license: "Driver's license" }

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [viewingDoc, setViewingDoc] = useState(null) // { userId, type, label }

  async function load(page = 1, append = false) {
    if (append) setLoadingMore(true)
    else setLoading(true)
    const qs = new URLSearchParams({ role: 'driver', search, page, pageSize: PAGE_SIZE }).toString()
    const { users, total: newTotal } = await api.get(`/api/admin/users?${qs}`)
    setDrivers((prev) => (append ? [...prev, ...users] : users))
    setTotal(newTotal)
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    const t = setTimeout(() => load(1, false), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  async function toggleStatus(user) {
    const nextStatus = user.status === 'active' ? 'suspended' : 'active'
    await api.patch(`/api/admin/users/${user.id}/status`, { status: nextStatus })
    setDrivers((prev) => prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)))
  }

  async function verify(user) {
    await api.patch(`/api/admin/users/${user.id}/verify-driver`)
    setDrivers((prev) => prev.map((u) => (u.id === user.id ? { ...u, onboarding: { personalInfo: true, documents: true, guarantor: true } } : u)))
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold text-navy-950">Riders</h1>
      <p className="mt-1 text-sm text-slate-muted">Everyone onboarded to deliver on Kaya.</p>

      <div className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 shadow-[var(--shadow-card)]">
        <Search size={16} className="text-slate-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" className="flex-1 bg-transparent text-sm outline-none" />
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <p className="text-sm text-slate-muted">Loading…</p>
        ) : drivers.length === 0 ? (
          <Card className="text-center text-sm text-slate-muted">No riders found.</Card>
        ) : (
          drivers.map((u) => {
            const verified = u.onboarding?.personalInfo && u.onboarding?.documents && u.onboarding?.guarantor
            const docs = u.documents || {}
            const hasDocs = docs.id || docs.license
            const hasGuarantor = !!(u.guarantorName && u.guarantorPhone)
            const isExpanded = expanded === u.id
            return (
              <Card key={u.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={u.name} size={44} src={avatarSrc(u.avatarUrl)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-navy-950">{u.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-slate-muted">
                      <Star size={12} className="fill-[#FFB800] text-[#FFB800]" />{' '}
                      {u.riderTrips > 0 ? `${u.riderRating} · ${u.riderTrips} trips` : 'New rider'} · {u.phone}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${verified ? 'bg-success/10 text-success' : 'bg-amber-100 text-amber-700'}`}>
                    {verified ? 'Verified' : 'Pending verification'}
                  </span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${u.status === 'active' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                    {u.status}
                  </span>
                  {!verified && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : u.id)}
                      className="tap flex items-center gap-1.5 rounded-full bg-navy-900/5 px-3 py-1.5 text-xs font-semibold text-navy-900"
                    >
                      <FileText size={13} /> Documents ({hasDocs ? Object.keys(docs).length : 0}) <ChevronDown size={13} className={isExpanded ? 'rotate-180' : ''} />
                    </button>
                  )}
                  {!verified && (
                    <button
                      onClick={() => verify(u)}
                      disabled={!hasDocs || !hasGuarantor}
                      className="tap flex items-center gap-1.5 rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                      title={hasDocs && hasGuarantor ? 'Approve this rider' : 'Documents and guarantor details are both required before verifying'}
                    >
                      <BadgeCheck size={14} /> Verify
                    </button>
                  )}
                  <button
                    onClick={() => toggleStatus(u)}
                    className={`tap flex h-9 w-9 items-center justify-center rounded-full ${u.status === 'active' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}
                    title={u.status === 'active' ? 'Suspend account' : 'Reactivate account'}
                  >
                    {u.status === 'active' ? <Ban size={16} /> : <CheckCircle2 size={16} />}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-navy-900/8 pt-3">
                    {!hasDocs ? (
                      <p className="text-sm text-slate-muted">This rider hasn't submitted any documents yet.</p>
                    ) : (
                      ['id', 'license'].map((type) =>
                        docs[type] ? (
                          <div key={type} className="flex items-center justify-between rounded-xl bg-navy-900/5 px-3 py-2">
                            <div>
                              <p className="text-sm font-semibold text-navy-950">{DOC_LABELS[type]}</p>
                              <p className="text-xs text-slate-muted">Submitted {new Date(docs[type].uploadedAt).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setViewingDoc({ userId: u.id, type, label: DOC_LABELS[type] })} className="tap flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-navy-900 shadow-[var(--shadow-card)]">
                              <Eye size={13} /> View
                            </button>
                          </div>
                        ) : (
                          <div key={type} className="flex items-center justify-between rounded-xl bg-navy-900/5 px-3 py-2 opacity-50">
                            <p className="text-sm font-semibold text-navy-950">{DOC_LABELS[type]}</p>
                            <p className="text-xs text-slate-muted">Not submitted</p>
                          </div>
                        )
                      )
                    )}

                    <div className="rounded-xl bg-navy-900/5 px-3 py-2.5">
                      <p className="text-sm font-semibold text-navy-950">Guarantor</p>
                      {hasGuarantor ? (
                        <div className="mt-1 space-y-0.5 text-xs text-slate-muted">
                          <p>{u.guarantorName} · {u.guarantorRelationship}</p>
                          <p>{u.guarantorPhone}</p>
                          <p>{u.guarantorAddress}</p>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-slate-muted">Not submitted yet</p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })
        )}
        {!loading && (
          <LoadMoreButton
            shown={drivers.length}
            total={total}
            loading={loadingMore}
            onClick={() => load(Math.floor(drivers.length / PAGE_SIZE) + 1, true)}
          />
        )}
      </div>

      {viewingDoc && <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />}
    </div>
  )
}

function DocumentViewerModal({ doc, onClose }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [objectUrl, setObjectUrl] = useState(null)
  const [mimeType, setMimeType] = useState(null)

  useEffect(() => {
    let cancelled = false
    let createdUrl = null

    fetch(`${BASE_URL}/api/admin/users/${doc.userId}/documents/${doc.type}/file`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`)
        return res.blob()
      })
      .then((blob) => {
        if (cancelled) return
        createdUrl = URL.createObjectURL(blob)
        setObjectUrl(createdUrl)
        setMimeType(blob.type)
        setStatus('ready')
      })
      .catch(() => !cancelled && setStatus('error'))

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [doc.userId, doc.type])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/70 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-navy-900/8 px-5 py-4">
          <p className="text-sm font-bold text-navy-950">{doc.label}</p>
          <button onClick={onClose} className="tap flex h-8 w-8 items-center justify-center rounded-full bg-navy-900/5">
            <X size={16} className="text-navy-900" />
          </button>
        </div>
        <div className="flex max-h-[70vh] items-center justify-center overflow-auto bg-navy-900/5 p-4">
          {status === 'loading' && <p className="py-12 text-sm text-slate-muted">Loading document…</p>}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <AlertCircle size={24} className="text-danger" />
              <p className="text-sm font-medium text-danger">Couldn't load this document. Try again.</p>
            </div>
          )}
          {status === 'ready' && mimeType === 'application/pdf' && (
            <iframe src={objectUrl} title={doc.label} className="h-[65vh] w-full rounded-xl bg-white" />
          )}
          {status === 'ready' && mimeType !== 'application/pdf' && (
            <img src={objectUrl} alt={doc.label} className="max-h-[65vh] w-full rounded-xl object-contain" />
          )}
        </div>
      </div>
    </div>
  )
}
