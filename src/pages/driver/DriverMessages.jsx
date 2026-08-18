import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { useAppData } from '../../context/AppDataContext'
import { Avatar, EmptyState } from '../../components/ui/Misc'
import { timeAgo } from '../../utils/format'

export default function DriverMessages() {
  const { conversations } = useAppData()
  const navigate = useNavigate()

  return (
    <div className="px-5 pt-6 md:px-0">
      <h1 className="text-xl font-extrabold text-navy-950">Messages</h1>
      <p className="mt-1 text-sm text-slate-muted">Chat with customers about deliveries you've accepted.</p>

      {conversations.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No conversations yet" desc="Once you accept a delivery, you can message the customer here." />
      ) : (
        <div className="mt-5 space-y-1">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => navigate(`/driver/messages/${c.id}`)}
              className="tap flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-white"
            >
              <Avatar name={c.participant?.name} size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="truncate text-sm font-bold text-navy-950">{c.participant?.name || 'Customer'}</p>
                  <p className="shrink-0 text-xs text-slate-muted">{timeAgo(c.lastMessageAt)}</p>
                </div>
                <p className="truncate text-sm text-slate-muted">{c.lastMessage || 'Say hello to get started'}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
