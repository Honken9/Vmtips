'use client'

import { useState, Fragment, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/UserAvatar'
import { AdminAvatarManager } from '@/components/AdminAvatarManager'
import { TAG_COLORS, colorHex } from '@/lib/tag-colors'
import { Lock, Unlock, Loader2, Trash2, ImageIcon, Users as UsersIcon, Filter, CheckCircle, AlertCircle } from 'lucide-react'

interface UserRow {
  id: string
  display_name: string
  tips_locked: boolean
  is_admin: boolean
  avatar_url: string | null
  avatar_locked: boolean
  pool_name: string | null
  pool_id: number | null
  payment_status: 'free' | 'paid' | 'unpaid' | 'no_pool'
  tag_color: string | null
  tag_department: string | null
}

type FilterValue = 'all' | 'none' | number

export function AdminUsersTable({ users: initial, meUserId }: { users: UserRow[]; meUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterValue>('all')

  async function saveTag(u: UserRow, color: string | null, department: string | null) {
    if (u.pool_id == null) return
    const dept = (department ?? '').trim()
    // Tom rad (ingen färg + ingen text) → ta bort raden helt.
    if (!color && !dept) {
      await supabase
        .from('pool_member_tags')
        .delete()
        .eq('pool_id', u.pool_id)
        .eq('user_id', u.id)
    } else {
      await supabase
        .from('pool_member_tags')
        .upsert(
          {
            pool_id: u.pool_id,
            user_id: u.id,
            color: color,
            department: dept || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'pool_id,user_id' }
        )
    }
  }

  function updateLocal(userId: string, patch: Partial<UserRow>) {
    setUsers(prev => prev.map(p => (p.id === userId ? { ...p, ...patch } : p)))
  }

  async function toggleLock(u: UserRow) {
    const next = !u.avatar_locked
    setBusy(u.id)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_locked: next })
      .eq('id', u.id)
    setBusy(null)
    if (error) {
      alert(`Kunde inte ändra: ${error.message}`)
      return
    }
    setUsers(prev => prev.map(p => (p.id === u.id ? { ...p, avatar_locked: next } : p)))
  }

  async function deleteUser(u: UserRow) {
    if (u.id === meUserId) {
      alert('Du kan inte ta bort dig själv.')
      return
    }
    if (!confirm(`Ta bort ${u.display_name} HELT? Alla deras tips, bonustips, ligamedlemskap och betalningar raderas permanent.`)) return
    if (!confirm(`Är du säker? Detta går INTE att ångra. Skriv över "${u.display_name}" om du vill fortsätta.`)) return

    setBusy(`del-${u.id}`)
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' })
    setBusy(null)

    if (res.ok) {
      setUsers(prev => prev.filter(p => p.id !== u.id))
      router.refresh()
      return
    }

    const data = await res.json().catch(() => ({}))
    if (res.status === 409 && data.error === 'owns_pools') {
      const list = (data.pools as { name: string }[] ?? []).map(p => `• ${p.name}`).join('\n')
      alert(
        `${data.message}\n\nÄgda ligor:\n${list}\n\n` +
        `Gå till Admin → Ligor och flytta ägandeskapet eller ta bort ligan först.`
      )
    } else {
      alert(`Kunde inte ta bort: ${data.error ?? res.statusText}`)
    }
  }

  // Gruppera per liga – sortera så ligor visas i bokstavsordning, "Utan liga" sist
  const groups = useMemo(() => {
    const m = new Map<string, { id: number | null; name: string; users: UserRow[] }>()
    for (const u of users) {
      const key = u.pool_id == null ? '__orphan__' : String(u.pool_id)
      if (!m.has(key)) {
        m.set(key, {
          id: u.pool_id,
          name: u.pool_id == null ? 'Utan liga' : (u.pool_name ?? `Liga ${u.pool_id}`),
          users: [],
        })
      }
      m.get(key)!.users.push(u)
    }
    for (const g of m.values()) {
      g.users.sort((a, b) => a.display_name.localeCompare(b.display_name))
    }
    return Array.from(m.values()).sort((a, b) => {
      if (a.id == null) return 1
      if (b.id == null) return -1
      return a.name.localeCompare(b.name)
    })
  }, [users])

  const visibleGroups = useMemo(() => {
    if (filter === 'all') return groups
    if (filter === 'none') return groups.filter(g => g.id == null)
    return groups.filter(g => g.id === filter)
  }, [groups, filter])

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter size={14} className="text-gray-500" />
        <label className="text-xs text-gray-500">Visa:</label>
        <select
          value={String(filter)}
          onChange={e => {
            const v = e.target.value
            if (v === 'all') setFilter('all')
            else if (v === 'none') setFilter('none')
            else setFilter(Number(v))
          }}
          className="px-3 py-1.5 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
          <option value="all">Alla ligor ({users.length})</option>
          {groups.filter(g => g.id != null).map(g => (
            <option key={g.id} value={g.id as number}>{g.name} ({g.users.length})</option>
          ))}
          {(groups.find(g => g.id == null)?.users.length ?? 0) > 0 && (
            <option value="none">Utan liga ({groups.find(g => g.id == null)?.users.length})</option>
          )}
        </select>
      </div>

      {/* Sektioner per liga */}
      {visibleGroups.map(section => (
        <section key={section.id ?? 'orphan'}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2 px-1">
            <UsersIcon size={14} className={section.id == null ? 'text-gray-500' : 'text-emerald-400'} />
            {section.name}
            <span className="text-xs font-normal text-gray-500">({section.users.length})</span>
          </h3>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#1f2937' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Namn</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Avdelning</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Färg</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Tips inlämnade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Betalt</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">AI-bild</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Roll</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Ta bort</th>
                </tr>
              </thead>
              <tbody>
                {section.users.map(u => (
                  <Fragment key={u.id}>
                    <tr
                      className="border-t hover:bg-white/5 transition-colors"
                      style={{ borderColor: '#1f2937' }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar src={u.avatar_url} name={u.display_name} size="sm" />
                          <span className="text-sm text-white">{u.display_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DepartmentCell
                          user={u}
                          onSave={(dept) => {
                            updateLocal(u.id, { tag_department: dept })
                            void saveTag(u, u.tag_color, dept)
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ColorCell
                          user={u}
                          onPick={(color) => {
                            updateLocal(u.id, { tag_color: color })
                            void saveTag(u, color, u.tag_department)
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.tips_locked
                          ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">✓ Inlämnade</span>
                          : <span className="text-xs text-gray-500">Ej inlämnade</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.payment_status === 'paid' && (
                          <span className="inline-flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full" title="Betalt">
                            <CheckCircle size={11} /> Betalt
                          </span>
                        )}
                        {u.payment_status === 'unpaid' && (
                          <span className="inline-flex items-center gap-1 text-xs text-red-300 bg-red-500/10 px-2 py-0.5 rounded-full" title="Ej betalt än">
                            <AlertCircle size={11} /> Ej betalt
                          </span>
                        )}
                        {u.payment_status === 'free' && (
                          <span className="text-xs text-gray-500" title="Liga utan avgift">Gratis</span>
                        )}
                        {u.payment_status === 'no_pool' && (
                          <span className="text-xs text-gray-600 italic">–</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => toggleLock(u)}
                            disabled={busy === u.id}
                            className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${u.avatar_locked ? 'text-amber-300 hover:bg-amber-400/15' : 'text-emerald-300 hover:bg-emerald-400/15'}`}
                            style={{
                              background: u.avatar_locked ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
                              border: `1px solid ${u.avatar_locked ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.2)'}`,
                            }}
                            title={u.avatar_locked ? 'Klicka för att låsa upp' : 'Klicka för att låsa'}
                          >
                            {busy === u.id ? (
                              <Loader2 size={11} className="animate-spin" />
                            ) : u.avatar_locked ? (
                              <Lock size={11} />
                            ) : (
                              <Unlock size={11} />
                            )}
                            {u.avatar_locked ? 'Låst' : 'Olåst'}
                          </button>
                          <button
                            onClick={() => setExpanded(prev => (prev === u.id ? null : u.id))}
                            className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full transition-colors ${expanded === u.id ? 'text-white bg-indigo-500/20' : 'text-indigo-300 hover:bg-indigo-400/15'}`}
                            style={{ background: expanded === u.id ? undefined : 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}
                            title="Hantera / generera profilbild"
                          >
                            <ImageIcon size={11} />
                            Hantera bild
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.is_admin
                          ? <span className="text-xs text-indigo-400">Admin</span>
                          : <span className="text-xs text-gray-500">Deltagare</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => deleteUser(u)}
                          disabled={busy === `del-${u.id}` || u.id === meUserId}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={u.id === meUserId ? 'Du kan inte ta bort dig själv' : 'Ta bort användaren helt'}
                        >
                          {busy === `del-${u.id}` ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <Trash2 size={11} />
                          )}
                          Ta bort
                        </button>
                      </td>
                    </tr>
                    {expanded === u.id && (
                      <tr style={{ background: '#0b1120' }}>
                        <td colSpan={8} className="px-4 pb-4 pt-1">
                          <AdminAvatarManager
                            userId={u.id}
                            displayName={u.display_name}
                            currentAvatar={u.avatar_url}
                            onChanged={newUrl => {
                              setUsers(prev => prev.map(p =>
                                p.id === u.id
                                  ? { ...p, avatar_url: newUrl, avatar_locked: newUrl != null }
                                  : p
                              ))
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {visibleGroups.length === 0 && (
        <div className="rounded-xl p-8 text-center text-sm text-gray-500"
          style={{ background: '#111827', border: '1px solid #1f2937' }}>
          Inga deltagare i den valda ligan.
        </div>
      )}
    </div>
  )
}

// Avdelnings-input: lokalt state + debounce-save så vi inte spammar DB:n.
function DepartmentCell({
  user, onSave,
}: {
  user: UserRow
  onSave: (dept: string | null) => void
}) {
  const [value, setValue] = useState<string>(user.tag_department ?? '')
  const initial = useRef(user.tag_department ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Synka när raden uppdateras utifrån
  useEffect(() => {
    setValue(user.tag_department ?? '')
    initial.current = user.tag_department ?? ''
  }, [user.tag_department])

  function commit(next: string) {
    if (next === initial.current) return
    initial.current = next
    onSave(next.trim() || null)
  }

  function handleChange(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => commit(next), 700)
  }

  if (user.pool_id == null) {
    return <span className="text-xs text-gray-600 italic">–</span>
  }

  return (
    <input
      type="text"
      value={value}
      onChange={e => handleChange(e.target.value)}
      onBlur={() => {
        if (timer.current) clearTimeout(timer.current)
        commit(value)
      }}
      maxLength={30}
      placeholder="Avdelning…"
      className="w-full max-w-[160px] px-2 py-1 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
      style={{ background: '#1f2937', border: '1px solid #374151' }}
    />
  )
}

// Färgväljare: liten cirkel som öppnar paletten – sparar direkt vid klick.
function ColorCell({
  user, onPick,
}: {
  user: UserRow
  onPick: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (user.pool_id == null) {
    return <span className="text-xs text-gray-600 italic">–</span>
  }

  const hex = colorHex(user.tag_color)

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-6 h-6 rounded-full transition-transform hover:scale-110"
        style={{
          background: hex ?? 'transparent',
          border: hex ? '1px solid rgba(255,255,255,0.2)' : '1px dashed #374151',
        }}
        title={user.tag_color ?? 'Ingen färg'}
        aria-label="Välj färg"
      />
      {open && (
        <div
          className="absolute z-30 top-full right-0 mt-1 p-2 rounded-lg flex gap-1.5 flex-wrap w-44"
          style={{ background: '#0f172a', border: '1px solid #374151', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
        >
          <button
            type="button"
            onClick={() => { onPick(null); setOpen(false) }}
            className={`w-6 h-6 rounded-full ${user.tag_color === null ? 'ring-2 ring-emerald-400' : ''}`}
            style={{ background: 'transparent', border: '1px dashed #374151' }}
            title="Ingen färg"
            aria-label="Ingen färg"
          />
          {TAG_COLORS.map(c => (
            <button
              key={c.key}
              type="button"
              onClick={() => { onPick(c.key); setOpen(false) }}
              className={`w-6 h-6 rounded-full ${user.tag_color === c.key ? 'ring-2 ring-white' : ''}`}
              style={{ background: c.hex }}
              title={c.label}
              aria-label={c.label}
            />
          ))}
        </div>
      )}
    </div>
  )
}
