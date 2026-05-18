'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateInviteCode } from '@/lib/invite-code'
import type { Pool, Profile } from '@/lib/types'
import { Loader2, Plus, Trash2, Users, RefreshCw, ShieldCheck } from 'lucide-react'

type ProfileLite = Pick<Profile, 'id' | 'display_name' | 'is_admin' | 'pool_id'>

export function AdminPoolsClient({
  initialPools,
  initialProfiles,
}: {
  initialPools: Pool[]
  initialProfiles: ProfileLite[]
}) {
  const supabase = createClient()
  const [pools, setPools] = useState<Pool[]>(initialPools)
  const [profiles, setProfiles] = useState<ProfileLite[]>(initialProfiles)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const membersByPool = useMemo(() => {
    const m = new Map<number, ProfileLite[]>()
    for (const p of profiles) {
      if (p.pool_id == null) continue
      if (!m.has(p.pool_id)) m.set(p.pool_id, [])
      m.get(p.pool_id)!.push(p)
    }
    return m
  }, [profiles])

  const orphans = profiles.filter(p => p.pool_id == null)

  function flash(type: 'ok' | 'err', text: string) {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  async function refreshAll() {
    const [{ data: poolsRaw }, { data: profilesRaw }] = await Promise.all([
      supabase.from('pools').select('*').order('id'),
      supabase.from('profiles').select('id, display_name, is_admin, pool_id'),
    ])
    setPools((poolsRaw ?? []) as Pool[])
    setProfiles((profilesRaw ?? []) as ProfileLite[])
  }

  async function restorePool(id: number) {
    setBusy(`restore-${id}`)
    const { error } = await supabase
      .from('pools')
      .update({ deleted_at: null, deleted_by: null })
      .eq('id', id)
    setBusy(null)
    if (error) {
      flash('err', error.message)
      return
    }
    flash('ok', 'Liga återskapad')
    await refreshAll()
  }

  async function createPool() {
    if (!newName.trim()) return
    setCreating(true)
    const code = generateInviteCode()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase
      .from('pools')
      .insert({ name: newName.trim(), invite_code: code, created_by: user?.id ?? null })
    setCreating(false)
    if (error) {
      flash('err', error.message)
      return
    }
    setNewName('')
    flash('ok', `Liga skapad med kod ${code}`)
    await refreshAll()
  }

  async function deletePool(id: number) {
    const memberCount = membersByPool.get(id)?.length ?? 0
    const ok = window.confirm(
      memberCount > 0
        ? `Radera ligan? ${memberCount} medlemmar förlorar sin ligakoppling och måste välja ny liga.`
        : 'Radera ligan?'
    )
    if (!ok) return
    setBusy(`del-${id}`)
    const { data: { user } } = await supabase.auth.getUser()
    // Soft delete – hamnar i kyrkogården, återskapbar i 14 dagar
    const { error } = await supabase
      .from('pools')
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
      .eq('id', id)
    setBusy(null)
    if (error) {
      flash('err', error.message)
      return
    }
    flash('ok', 'Liga flyttad till kyrkogården (återskapbar i 14 dagar)')
    await refreshAll()
  }

  async function regenerateCode(id: number) {
    const ok = window.confirm(
      'Ny invite-kod? Alla nuvarande medlemmar är kvar, men gamla koden slutar fungera.'
    )
    if (!ok) return
    setBusy(`code-${id}`)
    const newCode = generateInviteCode()
    const { error } = await supabase.from('pools').update({ invite_code: newCode }).eq('id', id)
    setBusy(null)
    if (error) {
      flash('err', error.message)
      return
    }
    flash('ok', `Ny kod: ${newCode}`)
    await refreshAll()
  }

  async function moveUser(userId: string, newPoolId: number | null) {
    setBusy(`move-${userId}`)
    const { error } = await supabase
      .from('profiles')
      .update({ pool_id: newPoolId })
      .eq('id', userId)
    setBusy(null)
    if (error) {
      flash('err', error.message)
      return
    }
    await refreshAll()
  }

  async function renamePool(id: number, name: string) {
    setBusy(`rename-${id}`)
    const { error } = await supabase.from('pools').update({ name }).eq('id', id)
    setBusy(null)
    if (error) {
      flash('err', error.message)
      return
    }
    await refreshAll()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users size={22} className="text-emerald-400" />
            Ligor
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Skapa, byt namn, radera, regenerera invite-kod, eller flytta enskilda användare.
          </p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
          <RefreshCw size={14} />
          Uppdatera
        </button>
      </div>

      {message && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{
            background: message.type === 'ok' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'ok' ? '#4ade80' : '#f87171',
            border: `1px solid ${message.type === 'ok' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Skapa ny liga */}
      <div className="rounded-xl p-4 flex flex-col sm:flex-row gap-2 sm:items-end" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">Skapa ny liga</label>
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Liganamn (t.ex. Kollegor)"
            maxLength={40}
            className="w-full px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
            style={{ background: '#1f2937', border: '1px solid #374151' }}
          />
        </div>
        <button
          onClick={createPool}
          disabled={creating || !newName.trim()}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-black gold-gradient disabled:opacity-40 w-full sm:w-auto"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Skapa
        </button>
      </div>

      {/* Lista över aktiva pools */}
      <div className="space-y-3">
        {pools.filter(p => !p.deleted_at).map(pool => {
          const members = membersByPool.get(pool.id) ?? []
          return (
            <div
              key={pool.id}
              className="rounded-xl overflow-hidden"
              style={{ background: '#111827', border: '1px solid #1f2937' }}
            >
              <div className="px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-2 sm:gap-4 flex-wrap" style={{ background: '#1a2233' }}>
                <input
                  type="text"
                  defaultValue={pool.name}
                  onBlur={e => {
                    if (e.target.value !== pool.name) renamePool(pool.id, e.target.value)
                  }}
                  className="flex-1 min-w-[140px] text-base sm:text-lg font-bold bg-transparent text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 rounded px-2"
                />
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <code className="px-2 py-1 rounded text-emerald-400 font-mono text-sm tracking-wider"
                    style={{ background: 'rgba(16,185,129,0.1)' }}>
                    {pool.invite_code}
                  </code>
                  <button
                    onClick={() => regenerateCode(pool.id)}
                    disabled={busy === `code-${pool.id}`}
                    className="text-gray-500 hover:text-white p-1.5 rounded disabled:opacity-40"
                    title="Generera ny kod"
                  >
                    {busy === `code-${pool.id}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                  </button>
                  <button
                    onClick={() => deletePool(pool.id)}
                    disabled={busy === `del-${pool.id}`}
                    className="text-red-400 hover:text-red-300 p-1.5 rounded disabled:opacity-40"
                    title="Radera liga"
                  >
                    {busy === `del-${pool.id}` ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>

              <div className="px-3 sm:px-5 py-3">
                <div className="text-xs text-gray-500 mb-2">
                  {members.length === 0 ? 'Inga medlemmar' : `${members.length} medlemmar`}
                </div>
                {members.length > 0 && (
                  <div className="space-y-1">
                    {members.map(m => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-white/5"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm text-white truncate">{m.display_name}</span>
                          {m.is_admin && (
                            <ShieldCheck size={12} className="text-indigo-400 shrink-0" />
                          )}
                        </div>
                        <select
                          value={m.pool_id ?? ''}
                          onChange={e =>
                            moveUser(m.id, e.target.value ? Number(e.target.value) : null)
                          }
                          disabled={busy === `move-${m.id}`}
                          className="text-xs px-2 py-1 rounded bg-transparent text-gray-400 hover:text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50 disabled:opacity-40"
                          style={{ border: '1px solid #374151' }}
                        >
                          {pools.filter(p => !p.deleted_at).map(p => (
                            <option key={p.id} value={p.id} className="bg-gray-900 text-white">
                              {p.name}
                            </option>
                          ))}
                          <option value="" className="bg-gray-900 text-white">
                            – Ingen liga –
                          </option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
        {pools.filter(p => !p.deleted_at).length === 0 && (
          <div className="rounded-xl p-8 text-center text-gray-500"
            style={{ background: '#111827', border: '1px solid #1f2937' }}>
            Inga ligor än. Skapa en ovan.
          </div>
        )}
      </div>

      {/* Kyrkogård – raderade ligor, återskapbara i 14 dagar */}
      {pools.some(p => p.deleted_at) && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-2">
            🪦 Kyrkogården
            <span className="text-xs font-normal text-gray-600">
              raderade ligor – återskapbara i 14 dagar, sen permanent borta
            </span>
          </h3>
          <div className="space-y-2">
            {pools.filter(p => p.deleted_at).map(pool => {
              const deletedMs = new Date(pool.deleted_at as string).getTime()
              const daysLeft = Math.max(
                0,
                14 - Math.floor((Date.now() - deletedMs) / 86_400_000)
              )
              return (
                <div
                  key={pool.id}
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                  style={{ background: '#111827', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-300 truncate">
                      {pool.name}
                    </div>
                    <div className="text-xs text-gray-600">
                      Raderad {new Date(pool.deleted_at as string).toLocaleDateString('sv-SE')}
                      {' · '}
                      {daysLeft > 0
                        ? `${daysLeft} dag${daysLeft === 1 ? '' : 'ar'} kvar`
                        : 'tas bort permanent snart'}
                    </div>
                  </div>
                  <button
                    onClick={() => restorePool(pool.id)}
                    disabled={busy === `restore-${pool.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40"
                    style={{
                      background: 'rgba(16,185,129,0.12)',
                      color: '#34d399',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    {busy === `restore-${pool.id}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      'Återskapa'
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {orphans.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <h3 className="text-sm font-semibold text-emerald-400 mb-2">
            {orphans.length} användare utan liga
          </h3>
          <div className="space-y-1">
            {orphans.map(o => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded hover:bg-white/5">
                <span className="text-sm text-white truncate">{o.display_name}</span>
                <select
                  value=""
                  onChange={e => moveUser(o.id, e.target.value ? Number(e.target.value) : null)}
                  disabled={busy === `move-${o.id}`}
                  className="text-xs px-2 py-1 rounded bg-transparent text-gray-300 focus:outline-none disabled:opacity-40"
                  style={{ border: '1px solid #374151' }}
                >
                  <option value="" className="bg-gray-900 text-white">
                    – Välj liga –
                  </option>
                  {pools.filter(p => !p.deleted_at).map(p => (
                    <option key={p.id} value={p.id} className="bg-gray-900 text-white">
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
