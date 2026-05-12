'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TrophyLogo } from '@/components/TrophyLogo'
import { Loader2, CheckCircle, Users, Plus } from 'lucide-react'
import { generateInviteCode, normalizeInviteCode } from '@/lib/invite-code'

type PoolMode = 'join' | 'create'

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [poolMode, setPoolMode] = useState<PoolMode>('join')
  const [inviteCode, setInviteCode] = useState('')
  const [poolName, setPoolName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<{ poolName: string; inviteCode: string } | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Lösenordet måste vara minst 6 tecken')
      return
    }
    if (poolMode === 'join' && !inviteCode.trim()) {
      setError('Ange en invite-kod eller välj "Skapa ny liga"')
      return
    }
    if (poolMode === 'create' && !poolName.trim()) {
      setError('Ange ett liganamn')
      return
    }

    setLoading(true)

    // 1. Validera/skapa pool INNAN användaren skapas
    let targetPoolId: number | null = null
    let targetPoolName = ''
    let targetInviteCode = ''

    if (poolMode === 'join') {
      const code = normalizeInviteCode(inviteCode)
      const { data: pool, error: poolErr } = await supabase
        .from('pools')
        .select('id, name, invite_code')
        .eq('invite_code', code)
        .single()
      if (poolErr || !pool) {
        setError('Hittade ingen liga med den koden. Dubbelkolla med arrangören.')
        setLoading(false)
        return
      }
      targetPoolId = pool.id
      targetPoolName = pool.name
      targetInviteCode = pool.invite_code
    }

    // 2. Skapa användaren
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
      },
    })

    if (signErr) {
      setError(
        signErr.message === 'User already registered'
          ? 'Den e-postadressen är redan registrerad'
          : `Fel: ${signErr.message}`
      )
      setLoading(false)
      return
    }

    // 3. Om pool ska skapas: gör det nu (som inloggad eller via metadata efter callback)
    // Vi behöver session för att skapa rad. Om e-post-bekräftelse är på får användaren
    // skapa poolen efter login istället – då sparar vi i metadata och hanterar i callback.
    if (poolMode === 'create' && data.session && data.user) {
      const code = generateInviteCode()
      const { data: newPool, error: poolErr } = await supabase
        .from('pools')
        .insert({
          name: poolName.trim(),
          invite_code: code,
          created_by: data.user.id,
        })
        .select()
        .single()
      if (poolErr || !newPool) {
        setError(`Konto skapat men ligan kunde inte sparas: ${poolErr?.message ?? '?'}`)
        setLoading(false)
        return
      }
      targetPoolId = newPool.id
      targetPoolName = newPool.name
      targetInviteCode = newPool.invite_code
    }

    // 4. Sätt pool_id på profilen + lägg till medlemskap (kräver inloggad session)
    if (data.session && data.user && targetPoolId != null) {
      await supabase
        .from('pool_memberships')
        .upsert(
          { pool_id: targetPoolId, user_id: data.user.id },
          { onConflict: 'pool_id,user_id' }
        )
      await supabase
        .from('profiles')
        .update({ pool_id: targetPoolId })
        .eq('id', data.user.id)
    }

    setLoading(false)

    if (data.session) {
      // Inloggad direkt
      if (poolMode === 'create' && targetInviteCode) {
        setSuccess({ poolName: targetPoolName, inviteCode: targetInviteCode })
      } else {
        // Full page reload så root-layout SSR:as om med nya auth-cookien.
        window.location.href = '/'
      }
      return
    }

    // E-postbekräftelse krävs – pool sätts efter callback (TODO i callback)
    setSuccess({ poolName: targetPoolName, inviteCode: targetInviteCode })
  }

  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <CheckCircle size={48} className="text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Klart!</h2>
            {success.poolName && (
              <p className="text-gray-300 mb-4">
                Du är med i ligan <span className="text-emerald-400 font-semibold">{success.poolName}</span>.
              </p>
            )}
            {poolMode === 'create' && success.inviteCode && (
              <div className="rounded-xl p-4 mb-4" style={{ background: '#1f2937', border: '1px solid #374151' }}>
                <div className="text-xs text-gray-400 mb-1">Bjud in andra med koden:</div>
                <div className="text-2xl font-bold tracking-wider text-emerald-400 font-mono">
                  {success.inviteCode}
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500">
              Om du fick ett mail – klicka på bekräftelselänken där först.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 rounded-lg gold-gradient text-black font-medium text-sm"
            >
              Till startsidan
            </Link>
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
          <p className="text-gray-400 text-sm">Skapa konto och börja tippa</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h1 className="text-xl font-bold text-white mb-6">Skapa konto</h1>

          <form onSubmit={handleRegister} className="space-y-4" method="post" autoComplete="on">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Visningsnamn</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                required
                placeholder="Ditt namn i tabellen"
                maxLength={30}
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            </div>

            <div>
              <label htmlFor="register-email" className="block text-sm font-medium text-gray-300 mb-1.5">E-post</label>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="du@exempel.se"
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-1.5">Lösenord</label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Minst 6 tecken"
                className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                style={{ background: '#1f2937', border: '1px solid #374151' }}
              />
            </div>

            {/* Pool-val */}
            <div className="pt-4 border-t" style={{ borderColor: '#1f2937' }}>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipsliga</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setPoolMode('join')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    poolMode === 'join'
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={{
                    background: poolMode === 'join' ? undefined : '#1f2937',
                    border: `1px solid ${poolMode === 'join' ? 'rgba(16,185,129,0.3)' : '#374151'}`,
                  }}
                >
                  <Users size={14} />
                  Gå med
                </button>
                <button
                  type="button"
                  onClick={() => setPoolMode('create')}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    poolMode === 'create'
                      ? 'text-emerald-400 bg-emerald-400/10'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={{
                    background: poolMode === 'create' ? undefined : '#1f2937',
                    border: `1px solid ${poolMode === 'create' ? 'rgba(16,185,129,0.3)' : '#374151'}`,
                  }}
                >
                  <Plus size={14} />
                  Skapa ny
                </button>
              </div>

              {poolMode === 'join' ? (
                <input
                  type="text"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value.toUpperCase())}
                  required
                  placeholder="Invite-kod (t.ex. XK4P9M)"
                  maxLength={12}
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}
                />
              ) : (
                <input
                  type="text"
                  value={poolName}
                  onChange={e => setPoolName(e.target.value)}
                  required
                  placeholder="Liganamn (t.ex. Familjen)"
                  maxLength={40}
                  className="w-full px-4 py-3 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  style={{ background: '#1f2937', border: '1px solid #374151' }}
                />
              )}
              <p className="text-xs text-gray-500 mt-1.5">
                {poolMode === 'join'
                  ? 'Få koden av personen som arrangerar din tipstävling.'
                  : 'En invite-kod genereras automatiskt – dela den med dina kompisar.'}
              </p>
            </div>

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
              Skapa konto
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-400">
            Har du redan ett konto?{' '}
            <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
              Logga in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
