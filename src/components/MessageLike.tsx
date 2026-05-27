'use client'

import { useState } from 'react'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  messageId: number
  meUserId: string
  initialCount: number
  initialLiked: boolean
}

export function MessageLike({ messageId, meUserId, initialCount, initialLiked }: Props) {
  const supabase = createClient()
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    const next = !liked
    setBusy(true)
    // Optimistisk uppdatering
    setLiked(next)
    setCount(c => Math.max(0, c + (next ? 1 : -1)))

    const { error } = next
      ? await supabase.from('pool_message_likes').insert({ message_id: messageId, user_id: meUserId })
      : await supabase.from('pool_message_likes').delete().eq('message_id', messageId).eq('user_id', meUserId)

    setBusy(false)
    if (error) {
      // Rollback vid fel
      setLiked(!next)
      setCount(c => Math.max(0, c + (next ? -1 : 1)))
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={liked ? 'Ta bort gilla' : 'Gilla'}
      title={liked ? 'Ta bort gilla' : 'Gilla'}
      className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded transition-colors disabled:opacity-50 ${liked ? 'text-rose-400 hover:bg-rose-500/10' : 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10'}`}
    >
      <Heart size={11} fill={liked ? 'currentColor' : 'none'} />
      {count > 0 && <span className="font-semibold">{count}</span>}
    </button>
  )
}
