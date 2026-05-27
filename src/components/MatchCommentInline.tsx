'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/UserAvatar'
import { MessageLike } from '@/components/MessageLike'
import { MessageCircle, Loader2, Send, Trash2 } from 'lucide-react'

interface Props {
  matchId: number
  poolId: number
  meUserId: string
  matchLabel: string
  canModerate: boolean
}

interface RawRow {
  id: number
  user_id: string
  text: string
  created_at: string
}

interface DisplayedComment extends RawRow {
  display_name: string
  avatar_url: string | null
  like_count: number
  liked_by_me: boolean
}

const MAX_LEN = 500

export function MatchCommentInline({ matchId, poolId, meUserId, matchLabel, canModerate }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<DisplayedComment[] | null>(null)
  const [count, setCount] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from('pool_messages')
      .select('id', { head: true, count: 'exact' })
      .eq('pool_id', poolId)
      .eq('match_id', matchId)
    setCount(c ?? 0)
  }, [supabase, poolId, matchId])

  const fetchComments = useCallback(async () => {
    // Hämta bara 3 senaste – håller listan kort på matchsidan.
    // count: 'exact' ger oss totalen ändå så vi kan visa "X äldre".
    const { data, error, count: totalCount } = await supabase
      .from('pool_messages')
      .select('id, user_id, text, created_at', { count: 'exact' })
      .eq('pool_id', poolId)
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(3)
    if (error) {
      setError(error.message)
      return
    }
    const raw = ((data ?? []) as RawRow[]).reverse()
    // Slå upp namn + avatar för varje user_id
    const ids = Array.from(new Set(raw.map(r => r.user_id)))
    let profiles: Record<string, { display_name: string; avatar_url: string | null }> = {}
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', ids)
      profiles = Object.fromEntries(
        ((profs ?? []) as { id: string; display_name: string; avatar_url: string | null }[])
          .map(p => [p.id, { display_name: p.display_name, avatar_url: p.avatar_url ?? null }])
      )
    }
    // Hämta likes för dessa kommentarer
    const likeCounts: Record<number, number> = {}
    const likedByMe: Record<number, boolean> = {}
    if (raw.length > 0) {
      const { data: likes } = await supabase
        .from('pool_message_likes')
        .select('message_id, user_id')
        .in('message_id', raw.map(r => r.id))
      for (const l of (likes ?? []) as { message_id: number; user_id: string }[]) {
        likeCounts[l.message_id] = (likeCounts[l.message_id] ?? 0) + 1
        if (l.user_id === meUserId) likedByMe[l.message_id] = true
      }
    }
    setComments(raw.map(r => ({
      ...r,
      display_name: profiles[r.user_id]?.display_name ?? '(borttagen)',
      avatar_url: profiles[r.user_id]?.avatar_url ?? null,
      like_count: likeCounts[r.id] ?? 0,
      liked_by_me: !!likedByMe[r.id],
    })))
    setCount(totalCount ?? raw.length)
  }, [supabase, poolId, matchId, meUserId])

  useEffect(() => { fetchCount() }, [fetchCount])

  useEffect(() => {
    if (open && comments === null) fetchComments()
  }, [open, comments, fetchComments])

  async function send() {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    setError(null)
    const { error } = await supabase.from('pool_messages').insert({
      pool_id: poolId,
      user_id: meUserId,
      match_id: matchId,
      text: t.slice(0, MAX_LEN),
    })
    setSending(false)
    if (error) {
      setError(error.message)
      return
    }
    setText('')
    await fetchComments()
  }

  async function deleteComment(id: number) {
    if (!confirm('Ta bort kommentaren?')) return
    setBusy(id)
    const { error } = await supabase.from('pool_messages').delete().eq('id', id)
    setBusy(null)
    if (error) {
      setError(error.message)
      return
    }
    await fetchComments()
  }

  function formatTime(iso: string): string {
    const d = new Date(iso)
    const now = new Date()
    const sameDay = d.toDateString() === now.toDateString()
    if (sameDay) return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
    return d.toLocaleString('sv-SE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1 transition-colors ${open ? 'text-emerald-400' : 'text-gray-500 hover:text-emerald-400'}`}
        title={`Kommentera ${matchLabel}`}
      >
        <MessageCircle size={11} />
        {count != null && count > 0 ? <span className="font-medium">{count}</span> : null}
        <span>{open ? 'Stäng' : 'Kommentarer'}</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg p-2 space-y-2" style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
          {/* Lista kommentarer */}
          {comments === null ? (
            <div className="flex items-center gap-1.5 text-gray-500 px-1 py-2">
              <Loader2 size={11} className="animate-spin" /> Laddar…
            </div>
          ) : comments.length === 0 ? (
            <div className="text-gray-500 px-1 py-2">Inga kommentarer än. Skriv den första nedan!</div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {count != null && count > comments.length && (
                <a
                  href="/liga"
                  className="block text-[10px] text-center text-gray-500 hover:text-emerald-400 pb-1"
                >
                  {count - comments.length} äldre kommentarer – se hela tråden i Liga-chatten →
                </a>
              )}
              {comments.map(c => {
                const isMe = c.user_id === meUserId
                const canDelete = isMe || canModerate
                return (
                  <div key={c.id} className="flex items-start gap-2 px-1 py-1 rounded hover:bg-white/[0.02] group">
                    <div className="pt-0.5"><UserAvatar src={c.avatar_url} name={c.display_name} size="xs" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-semibold text-gray-300 truncate">{c.display_name}</span>
                        <span className="text-[10px] text-gray-600 shrink-0">{formatTime(c.created_at)}</span>
                      </div>
                      <div className="text-xs text-gray-200 whitespace-pre-wrap break-words">{c.text}</div>
                      <MessageLike
                        messageId={c.id}
                        meUserId={meUserId}
                        initialCount={c.like_count}
                        initialLiked={c.liked_by_me}
                      />
                    </div>
                    {canDelete && (
                      <button
                        onClick={() => deleteComment(c.id)}
                        disabled={busy === c.id}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 shrink-0 pt-0.5"
                        title="Ta bort kommentar"
                      >
                        {busy === c.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Form */}
          <div className="pt-1 border-t" style={{ borderColor: '#1f2937' }}>
            <textarea
              value={text}
              onChange={e => setText(e.target.value.slice(0, MAX_LEN))}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={`Kommentar om ${matchLabel}…`}
              rows={2}
              className="w-full resize-none px-2 py-1.5 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
              style={{ background: '#1f2937', border: '1px solid #374151' }}
            />
            {error && <div className="text-[11px] text-red-400 mt-1">{error}</div>}
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-[10px] text-gray-600">
                Synligt för alla i ligan, dyker upp i Liga-chatten
              </span>
              <button
                onClick={send}
                disabled={!text.trim() || sending}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold text-black disabled:opacity-40 gold-gradient"
              >
                {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                Skicka
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
