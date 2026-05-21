'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/UserAvatar'
import { Loader2, Send, MessageCircle, Trash2 } from 'lucide-react'

interface RawMessage {
  id: number
  user_id: string
  text: string
  created_at: string
  match_id: number | null
}

interface MatchLite {
  id: number
  home_name: string
  away_name: string
}

interface DisplayedMessage extends RawMessage {
  display_name: string
  avatar_url: string | null
  match_label: string | null
}

interface Member {
  id: string
  display_name: string
  avatar_url: string | null
}

interface Props {
  poolId: number
  meUserId: string
  ownerUserId: string | null
  members: Member[]
}

const MAX_LEN = 2000
const POLL_INTERVAL_MS = 10_000
const PAGE_SIZE = 100

export function PoolChat({ poolId, meUserId, ownerUserId, members }: Props) {
  const supabase = createClient()
  const [messages, setMessages] = useState<DisplayedMessage[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const memberMap = useRef<Map<string, Member>>(new Map())
  const matchMap = useRef<Map<number, MatchLite>>(new Map())
  useEffect(() => {
    const m = new Map<string, Member>()
    for (const u of members) m.set(u.id, u)
    memberMap.current = m
  }, [members])

  // Hämta match-namn en gång så match-tags kan visas
  useEffect(() => {
    let cancelled = false
    async function loadMatches() {
      const { data } = await supabase
        .from('matches')
        .select('id, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), home_placeholder, away_placeholder')
      if (cancelled) return
      const m = new Map<number, MatchLite>()
      for (const r of (data ?? []) as Array<{
        id: number
        home_team: { name?: string } | { name?: string }[] | null
        away_team: { name?: string } | { name?: string }[] | null
        home_placeholder: string | null
        away_placeholder: string | null
      }>) {
        const h = Array.isArray(r.home_team) ? r.home_team[0]?.name : r.home_team?.name
        const a = Array.isArray(r.away_team) ? r.away_team[0]?.name : r.away_team?.name
        m.set(r.id, {
          id: r.id,
          home_name: h ?? r.home_placeholder ?? '?',
          away_name: a ?? r.away_placeholder ?? '?',
        })
      }
      matchMap.current = m
    }
    loadMatches()
    return () => { cancelled = true }
  }, [supabase])

  const fetchMessages = useCallback(async () => {
    const { data, error } = await supabase
      .from('pool_messages')
      .select('id, user_id, text, created_at, match_id')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const raw = ((data ?? []) as RawMessage[]).reverse()
    const enriched: DisplayedMessage[] = raw.map(m => {
      const mem = memberMap.current.get(m.user_id)
      const match = m.match_id != null ? matchMap.current.get(m.match_id) : null
      return {
        ...m,
        display_name: mem?.display_name ?? '(borttagen)',
        avatar_url: mem?.avatar_url ?? null,
        match_label: match ? `${match.home_name} – ${match.away_name}` : null,
      }
    })
    setMessages(enriched)
    setLoading(false)
  }, [poolId, supabase])

  // Initial load + polling var 10:e sek
  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Scrolla till botten när meddelanden ändras
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  async function send() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setError(null)
    const { error } = await supabase
      .from('pool_messages')
      .insert({ pool_id: poolId, user_id: meUserId, text: t.slice(0, MAX_LEN) })
    setSending(false)
    if (error) {
      setError(error.message)
      return
    }
    setText('')
    await fetchMessages()
  }

  async function deleteMessage(id: number) {
    if (!confirm('Ta bort meddelandet?')) return
    const { error } = await supabase.from('pool_messages').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    await fetchMessages()
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) {
      return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    }
    return d.toLocaleString('sv-SE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className="px-4 py-3 flex items-center gap-2 border-b" style={{ background: '#1a2233', borderColor: '#1f2937' }}>
        <MessageCircle size={16} className="text-emerald-400" />
        <span className="font-semibold text-white text-sm">Liga-chatt</span>
        <span className="text-xs text-gray-500 ml-auto">{messages.length} meddelanden</span>
      </div>

      <div
        ref={listRef}
        className="overflow-y-auto px-3 py-3 space-y-2"
        style={{ minHeight: '240px', maxHeight: '420px', background: '#0f172a' }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
            <Loader2 size={14} className="animate-spin" /> Laddar…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-500">
            Inga meddelanden än. Skriv det första nedan!
          </div>
        ) : (
          messages.map(m => {
            const isMe = m.user_id === meUserId
            const canDelete = isMe || m.user_id !== ownerUserId && ownerUserId === meUserId || /* admin handled via RLS */ false
            return (
              <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="shrink-0 pt-0.5">
                  <UserAvatar src={m.avatar_url} name={m.display_name} size="sm" />
                </div>
                <div className={`flex-1 min-w-0 ${isMe ? 'text-right' : ''}`}>
                  <div className={`flex items-baseline gap-2 ${isMe ? 'justify-end' : ''}`}>
                    <span className="text-xs font-semibold text-gray-300">{m.display_name}</span>
                    <span className="text-[10px] text-gray-600">{formatTime(m.created_at)}</span>
                  </div>
                  <div
                    className={`inline-block mt-1 px-3 py-1.5 rounded-lg text-sm whitespace-pre-wrap break-words text-left max-w-[85%] ${isMe ? 'text-white' : 'text-gray-200'}`}
                    style={{
                      background: isMe ? 'rgba(16,185,129,0.15)' : '#1f2937',
                      border: `1px solid ${isMe ? 'rgba(16,185,129,0.3)' : '#374151'}`,
                    }}
                  >
                    {m.match_label && (
                      <Link
                        href="/matches"
                        className="inline-flex items-center gap-1 mb-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-emerald-300 hover:bg-emerald-400/10 transition-colors"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
                        title="Kommentar om denna match"
                      >
                        <MessageCircle size={9} />
                        {m.match_label}
                      </Link>
                    )}
                    <div>{m.text}</div>
                  </div>
                  {(isMe || canDelete) && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      className="ml-2 text-[10px] text-gray-600 hover:text-red-400 transition-colors"
                      title="Ta bort meddelande"
                    >
                      <Trash2 size={10} className="inline" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="px-3 py-2 border-t" style={{ borderColor: '#1f2937', background: '#0f172a' }}>
        {error && (
          <div className="text-xs text-red-400 mb-1.5 px-1">{error}</div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            value={text}
            onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Skriv ett meddelande…  (Enter för att skicka, Shift+Enter för ny rad)"
            rows={1}
            className="flex-1 resize-none px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            style={{ background: '#1f2937', border: '1px solid #374151', maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40 gold-gradient"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Skicka
          </button>
        </div>
        <div className="text-[10px] text-gray-600 mt-1 px-1">
          {text.length}/{MAX_LEN} tecken · uppdateras var 10:e sekund
        </div>
      </div>
    </div>
  )
}
