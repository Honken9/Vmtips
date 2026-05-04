'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Pool } from '@/lib/types'
import { ChevronDown, Check, Plus, LogOut, Loader2 } from 'lucide-react'

interface Props {
  activePool: Pool | null
  allLigor: Pool[]
  userId: string
}

export function LigaSwitcher({ activePool, allLigor, userId }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Stäng dropdown när man klickar utanför
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function switchTo(pool: Pool) {
    if (pool.id === activePool?.id) {
      setOpen(false)
      return
    }
    setBusy(pool.id)
    await supabase
      .from('profiles')
      .update({ pool_id: pool.id })
      .eq('id', userId)
    setBusy(null)
    setOpen(false)
    router.refresh()
  }

  async function leave(pool: Pool) {
    const ok = window.confirm(
      `Lämna ligan "${pool.name}"? Du kommer behöva en ny invite-kod för att gå med igen.`
    )
    if (!ok) return
    setBusy(pool.id)
    await supabase
      .from('pool_memberships')
      .delete()
      .eq('pool_id', pool.id)
      .eq('user_id', userId)

    // Om vi just lämnade aktiv liga, byt till en annan
    if (activePool?.id === pool.id) {
      const next = allLigor.find(l => l.id !== pool.id)
      await supabase
        .from('profiles')
        .update({ pool_id: next?.id ?? null })
        .eq('id', userId)
    }
    setBusy(null)
    setOpen(false)
    router.refresh()
  }

  if (!activePool) {
    // Ingen aktiv liga – länka till valet
    return (
      <Link
        href="/select-pool"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/10 transition-colors"
        style={{
          background: 'rgba(245,158,11,0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245,158,11,0.3)',
        }}
      >
        Välj liga →
      </Link>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium hover:bg-white/10 transition-colors"
        style={{
          background: 'rgba(99,102,241,0.15)',
          color: '#a5b4fc',
          border: '1px solid rgba(99,102,241,0.3)',
        }}
      >
        <span>Liga: <span className="text-white">{activePool.name}</span></span>
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute top-full mt-2 right-0 w-72 rounded-xl overflow-hidden shadow-2xl z-50"
          style={{ background: '#111827', border: '1px solid #334155' }}
        >
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 border-b"
            style={{ borderColor: '#1f2937' }}>
            Mina ligor
          </div>

          {allLigor.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-500">Inga ligor än</div>
          )}

          {allLigor.map(pool => {
            const isActive = pool.id === activePool.id
            return (
              <div
                key={pool.id}
                className={`flex items-center gap-2 px-3 py-2 transition-colors ${
                  isActive ? 'bg-emerald-400/5' : 'hover:bg-white/5'
                }`}
              >
                <button
                  onClick={() => switchTo(pool)}
                  className="flex-1 flex items-center gap-2 min-w-0 text-left"
                >
                  <div className={`w-4 h-4 shrink-0 flex items-center justify-center ${isActive ? 'text-emerald-400' : 'text-transparent'}`}>
                    <Check size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium truncate ${isActive ? 'text-emerald-400' : 'text-white'}`}>
                      {pool.name}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono">
                      {pool.invite_code}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => leave(pool)}
                  disabled={busy === pool.id}
                  title="Lämna ligan"
                  className="text-gray-500 hover:text-red-400 transition-colors p-1 disabled:opacity-40"
                >
                  {busy === pool.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <LogOut size={12} />
                  )}
                </button>
              </div>
            )
          })}

          <Link
            href="/select-pool"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-400/5 transition-colors border-t"
            style={{ borderColor: '#1f2937' }}
          >
            <Plus size={14} />
            Lägg till en liga
          </Link>
        </div>
      )}
    </div>
  )
}
