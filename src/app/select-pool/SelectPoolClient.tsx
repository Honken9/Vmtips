'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { generateInviteCode, normalizeInviteCode } from '@/lib/invite-code'
import { TrophyLogo } from '@/components/TrophyLogo'
import { Loader2, Users, Plus, CheckCircle } from 'lucide-react'

type Mode = 'join' | 'create'

export function SelectPoolClient({ displayName }: { displayName: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('join')
  const [inviteCode, setInviteCode] = useState('')
  const [poolName, setPoolName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ name: string; code: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

    let poolId: number | null = null
    let resultName = ''
    let resultCode = ''

    if (mode === 'join') {
      const code = normalizeInviteCode(inviteCode)
      const { data: pool, error: poolErr } = await supabase
        .from('pools')
        .select('id, name, invite_code')
        .eq('invite_code', code)
        .single()
      if (poolErr || !pool) {
        setError('Hittade ingen liga med den koden.')
        setLoading(false)
        return
      }
      poolId = pool.id
      resultName = pool.name
      resultCode = pool.invite_code
    } else {
      const code = generateInviteCode()
      const { data: pool, error: poolErr } = await supabase
        .from('pools')
        .insert({ name: poolName.trim(), invite_code: code, created_by: user.id })
        .select()
        .single()
      if (poolErr || !pool) {
        setError(`Kunde inte skapa ligan: ${poolErr?.message ?? '?'}`)
        setLoading(false)
        return
      }
      poolId = pool.id
      resultName = pool.name
      resultCode = pool.invite_code
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ pool_id: poolId })
      .eq('id', user.id)

    setLoading(false)
    if (updErr) {
      setError(`Profil kunde inte uppdateras: ${updErr.message}`)
      return
    }

    if (mode === 'create') {
      setSuccess({ name: resultName, code: resultCode })
    } else {
      router.push('/')
      router.refresh()
    }
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Poolen är skapad!</h2>
            <p className="text-gray-300 mb-4">
              <span className="text-emerald-400 font-semibold">{success.name}</span> är igång.
            </p>
            <div className="rounded-xl p-4 mb-4" style={{ background: '#1f2937', border: '1px solid #374151' }}>
              <div className="text-xs text-gray-400 mb-1">Bjud in andra med koden:</div>
              <div className="text-3xl font-bold tracking-wider text-emerald-400 font-mono">
                {success.code}
              </div>
            </div>
            <button
              onClick={() => {
                router.push('/')
                router.refresh()
              }}
              className="px-4 py-2 rounded-lg gold-gradient text-black font-medium text-sm"
            >
              Till startsidan
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <TrophyLogo size="md" />
          </div>
          <p className="text-gray-300">
            {displayName ? `Hej ${displayName}!` : 'Hej!'} Välj en liga att tävla i.
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'join' ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-400 hover:text-white'
              }`}
              style={{
                background: mode === 'join' ? undefined : '#1f2937',
                border: `1px solid ${mode === 'join' ? 'rgba(16,185,129,0.3)' : '#374151'}`,
              }}
            >
              <Users size={14} />
              Gå med i pool
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                mode === 'create' ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-400 hover:text-white'
              }`}
              style={{
                background: mode === 'create' ? undefined : '#1f2937',
                border: `1px solid ${mode === 'create' ? 'rgba(16,185,129,0.3)' : '#374151'}`,
              }}
            >
              <Plus size={14} />
              Skapa ny
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'join' ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Invite-kod
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  required
                  placeholder="t.ex. XK4P9M"
                  maxLength={12}
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg text-white font-mono tracking-wider uppercase placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Få koden av personen som arrangerar din tipstävling.
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Liganamn
                </label>
                <input
                  type="text"
                  value={poolName}
                  onChange={e => setPoolName(e.target.value)}
                  required
                  placeholder="t.ex. Familjen Andersson"
                  maxLength={40}
                  autoFocus
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  En invite-kod genereras automatiskt – dela den med dina kompisar.
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg font-semibold text-black transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 gold-gradient"
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {mode === 'join' ? 'Gå med' : 'Skapa pool'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
