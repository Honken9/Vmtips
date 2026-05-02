'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateInviteCode, normalizeInviteCode } from '@/lib/invite-code'
import { Loader2, RefreshCw, Plus, X } from 'lucide-react'

type Mode = 'closed' | 'join' | 'create'

export function ChangePool({ currentPoolId }: { currentPoolId: number | null }) {
  void currentPoolId
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('closed')
  const [inviteCode, setInviteCode] = useState('')
  const [poolName, setPoolName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function joinByCode() {
    setError('')
    setLoading(true)
    const code = normalizeInviteCode(inviteCode)
    const { data: pool, error: poolErr } = await supabase
      .from('pools')
      .select('id')
      .eq('invite_code', code)
      .single()
    if (poolErr || !pool) {
      setError('Hittade ingen pool med den koden.')
      setLoading(false)
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Inte inloggad')
      setLoading(false)
      return
    }
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ pool_id: pool.id })
      .eq('id', user.id)
    setLoading(false)
    if (updErr) {
      setError(updErr.message)
      return
    }
    setMode('closed')
    setInviteCode('')
    router.refresh()
  }

  async function createPool() {
    setError('')
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Inte inloggad')
      setLoading(false)
      return
    }
    const code = generateInviteCode()
    const { data: pool, error: insErr } = await supabase
      .from('pools')
      .insert({ name: poolName.trim(), invite_code: code, created_by: user.id })
      .select('id')
      .single()
    if (insErr || !pool) {
      setError(insErr?.message ?? 'Kunde inte skapa poolen')
      setLoading(false)
      return
    }
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ pool_id: pool.id })
      .eq('id', user.id)
    setLoading(false)
    if (updErr) {
      setError(updErr.message)
      return
    }
    setMode('closed')
    setPoolName('')
    router.refresh()
  }

  if (mode === 'closed') {
    return (
      <div className="flex gap-2 pt-2">
        <button
          onClick={() => setMode('join')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
          <RefreshCw size={12} />
          Byt pool
        </button>
        <button
          onClick={() => setMode('create')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-300 hover:text-white"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
          <Plus size={12} />
          Skapa ny
        </button>
      </div>
    )
  }

  return (
    <div className="pt-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {mode === 'join' ? 'Klistra in invite-kod:' : 'Namn på ny pool:'}
        </span>
        <button onClick={() => setMode('closed')} className="text-gray-500 hover:text-white">
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2">
        {mode === 'join' ? (
          <input
            type="text"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            placeholder="XK4P9M"
            maxLength={12}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={poolName}
            onChange={e => setPoolName(e.target.value)}
            placeholder="t.ex. Familjen"
            maxLength={40}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
            autoFocus
          />
        )}
        <button
          onClick={mode === 'join' ? joinByCode : createPool}
          disabled={loading || (mode === 'join' ? !inviteCode : !poolName.trim())}
          className="px-4 py-2 rounded-lg text-sm font-medium text-black gold-gradient disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : 'OK'}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  )
}
