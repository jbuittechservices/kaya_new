import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Phone, Send } from 'lucide-react'
import { api } from '../../lib/api'
import { getSocket } from '../../lib/socket'
import { useAuth } from '../../context/AuthContext'
import { useAppData } from '../../context/AppDataContext'
import { BackHeader } from '../../components/ui/Misc'
import { formatTime } from '../../utils/format'

const QUICK_REPLIES = ['Hello', 'Where are you?', "I'm at the gate", 'Thank you!']

export default function Conversation() {
  const { id } = useParams()
  const { user } = useAuth()
  const { sendMessage } = useAppData()
  const [convo, setConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  // Fetch this conversation's participant info directly — works for both the
  // customer app and the driver app, regardless of which role is signed in.
  useEffect(() => {
    let alive = true
    api
      .get('/api/messages')
      .then(({ conversations }) => {
        if (alive) setConvo(conversations.find((c) => c.id === id) || null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .get(`/api/messages/${id}/messages`)
      .then(({ messages }) => alive && setMessages(messages))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [id])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    socket.emit('conversation:join', { conversationId: id })

    function onNew({ conversationId, message }) {
      if (conversationId === id) setMessages((prev) => [...prev, message])
    }
    socket.on('message:new', onNew)
    return () => socket.off('message:new', onNew)
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function submit(e, quickText) {
    e?.preventDefault()
    const value = quickText || text
    if (!value.trim()) return
    setText('')
    // Optimistic append; the server only echoes new messages to the *other* participant
    setMessages((prev) => [...prev, { id: `tmp-${Date.now()}`, senderId: user?.id, text: value, createdAt: new Date().toISOString() }])
    try {
      await sendMessage(id, value.trim())
    } catch {
      // leave the optimistic message in place — non-critical for a chat UI
    }
  }

  return (
    <div className="flex h-screen flex-col bg-cream-100 md:h-[calc(100vh-4rem)] md:rounded-3xl md:border md:border-navy-900/8">
      <BackHeader
        title={convo?.participant?.name || 'Chat'}
        subtitle={convo?.participant?.vehicle}
        right={
          <a
            href={convo?.participant?.phone ? `tel:${convo.participant.phone}` : undefined}
            className={`tap flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[var(--shadow-card)] ${!convo?.participant?.phone ? 'pointer-events-none opacity-40' : ''}`}
          >
            <Phone size={16} className="text-navy-900" />
          </a>
        }
      />

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
        {loading && <p className="text-center text-sm text-slate-muted">Loading messages…</p>}
        {messages.map((m) => {
          const mine = m.senderId === user?.id
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[75%]">
                <div className={`rounded-2xl px-4 py-2.5 text-sm ${mine ? 'bg-navy-900 text-white' : 'bg-white text-navy-950 shadow-[var(--shadow-card)]'}`}>
                  {m.text}
                </div>
                <p className={`mt-1 text-[11px] text-slate-muted ${mine ? 'text-right' : ''}`}>{formatTime(m.createdAt)}</p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-navy-900/8 bg-cream-100 px-5 pb-4 pt-3 safe-bottom">
        <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_REPLIES.map((q) => (
            <button key={q} onClick={(e) => submit(e, q)} className="tap shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-900 shadow-[var(--shadow-card)]">
              {q}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-[var(--shadow-card)]">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your message"
            className="flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-navy-900/35"
          />
          <button type="submit" className="tap flex h-9 w-9 items-center justify-center rounded-full bg-amber-500">
            <Send size={15} className="text-navy-950" />
          </button>
        </form>
      </div>
    </div>
  )
}
