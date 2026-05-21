'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MessageCircle, Loader2, Send } from 'lucide-react'

interface Props {
  matchId: number
  poolId: number
  meUserId: string
  matchLabel: string
}

const MAX_LEN = 500

export function MatchCommentInline({ matchId, poolId, meUserId, matchLabel }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSent, setJustSent] = useState(false)

  const fetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from('pool_messages')
      .select('id', { head: true, count: 'exact' })
      .eq('pool_id', poolId)
      .eq('match_id', matchId)
    setCount(c ?? 0)
  }, [supabase, poolId, matchId])

  useEffect(() => { fetchCount() }, [fetchCount])

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
    setJustSent(true)
    setTimeout(() => setJustSent(false), 2500)
    fetchCount()
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-gray-500 hover:text-emerald-400 transition-colors"
        title={`Kommentera ${matchLabel}`}
      >
        <MessageCircle size={11} />
        {count != null && count > 0 ? <span className="font-medium">{count}</span> : null}
        <span>Kommentera</span>
      </button>

      {open && (
        <div className="mt-2 rounded-lg p-2 space-y-2" style={{ background: '#0f172a', border: '1px solid #1f2937' }}>
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
          {error && <div className="text-[11px] text-red-400">{error}</div>}
          {justSent && <div className="text-[11px] text-emerald-400">Skickat till liga-chatten ✓</div>}
          <div className="flex items-center justify-between gap-2">
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
      )}
    </div>
  )
}
