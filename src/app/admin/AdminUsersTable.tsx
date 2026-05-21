'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserAvatar } from '@/components/UserAvatar'
import { Lock, Unlock, Loader2, Trash2 } from 'lucide-react'

interface UserRow {
  id: string
  display_name: string
  tips_locked: boolean
  is_admin: boolean
  avatar_url: string | null
  avatar_locked: boolean
  pool_name: string | null
  pool_id: number | null
}

export function AdminUsersTable({ users: initial, meUserId }: { users: UserRow[]; meUserId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>(initial)
  const [busy, setBusy] = useState<string | null>(null)

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
        `Gå till respektive ligas "Min liga"-sida och överlåt ägandeskapet, eller ta bort ligan via Admin → Ligor först.`
      )
    } else {
      alert(`Kunde inte ta bort: ${data.error ?? res.statusText}`)
    }
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
      <table className="w-full">
        <thead>
          <tr style={{ background: '#1f2937' }}>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Namn</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Liga</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Tips inlämnade</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase">AI-bild</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Roll</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Ta bort</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}
              className="border-t hover:bg-white/5 transition-colors"
              style={{ borderColor: '#1f2937' }}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar src={u.avatar_url} name={u.display_name} size="sm" />
                  <span className="text-sm text-white">{u.display_name}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {u.pool_name
                  ? <span className="text-xs text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-full">{u.pool_name}</span>
                  : <span className="text-xs text-gray-600 italic">Ingen liga</span>
                }
              </td>
              <td className="px-4 py-3 text-right">
                {u.tips_locked
                  ? <span className="text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">✓ Inlämnade</span>
                  : <span className="text-xs text-gray-500">Ej inlämnade</span>
                }
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() => toggleLock(u)}
                  disabled={busy === u.id}
                  className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors disabled:opacity-50 ${u.avatar_locked ? 'text-amber-300 hover:bg-amber-400/15' : 'text-emerald-300 hover:bg-emerald-400/15'}`}
                  style={{
                    background: u.avatar_locked ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
                    border: `1px solid ${u.avatar_locked ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.2)'}`,
                  }}
                  title={u.avatar_locked ? 'Klicka för att låsa upp – då kan användaren skapa en ny bild' : 'Klicka för att låsa – då kan användaren inte skapa en ny bild'}
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
