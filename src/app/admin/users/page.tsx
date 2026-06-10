import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'
import { AdminUsersTable } from '../AdminUsersTable'

export const dynamic = 'force-dynamic'

interface ProfileRow {
  id: string
  display_name: string
  tips_locked: boolean
  is_admin: boolean
  avatar_url: string | null
  avatar_locked: boolean
  pool_id: number | null
}

interface PoolRow {
  id: number
  name: string
  entry_fee: number | null
}

interface PaymentRow {
  pool_id: number
  user_id: string
  paid: boolean
}

interface TagRow {
  pool_id: number
  user_id: string
  color: string | null
  department: string | null
}

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user: me } } = await supabase.auth.getUser()

  const [
    { data: profilesRaw },
    { data: poolsRaw },
    { data: paymentsRaw },
    { data: tagsRaw },
    { data: membershipsRaw },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, tips_locked, is_admin, avatar_url, avatar_locked, pool_id'),
    supabase.from('pools').select('id, name, entry_fee').is('deleted_at', null),
    supabase.from('pool_payments').select('pool_id, user_id, paid'),
    supabase.from('pool_member_tags').select('pool_id, user_id, color, department'),
    supabase.from('pool_memberships').select('pool_id, user_id'),
  ])

  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const pools = (poolsRaw ?? []) as PoolRow[]
  const payments = (paymentsRaw ?? []) as PaymentRow[]
  const tags = (tagsRaw ?? []) as TagRow[]
  const memberships = (membershipsRaw ?? []) as { pool_id: number; user_id: string }[]

  const poolById = new Map(pools.map(p => [p.id, p]))
  const paidKey = new Set(payments.filter(p => p.paid).map(p => `${p.pool_id}:${p.user_id}`))
  const tagByKey = new Map(tags.map(t => [`${t.pool_id}:${t.user_id}`, t]))

  // Bygg en rad per (deltagare × liga-medlemskap) så en deltagare som är
  // med i två ligor syns i båda sektionerna. Deltagare utan medlemskap får
  // en rad i "Utan liga".
  const membershipsByUser = new Map<string, number[]>()
  for (const ms of memberships) {
    if (!membershipsByUser.has(ms.user_id)) membershipsByUser.set(ms.user_id, [])
    // Endast pools som finns (filtrerar bort raderade)
    if (poolById.has(ms.pool_id)) membershipsByUser.get(ms.user_id)!.push(ms.pool_id)
  }

  const users = profiles
    .flatMap(p => {
      const ligor = membershipsByUser.get(p.id) ?? []
      // Saknar medlemskap → en rad i "Utan liga"
      const slots: (number | null)[] = ligor.length > 0 ? ligor : [null]
      return slots.map(poolId => {
        const pool = poolId != null ? poolById.get(poolId) : null
        const fee = pool?.entry_fee ?? 0
        const paymentStatus: 'free' | 'paid' | 'unpaid' | 'no_pool' =
          poolId == null
            ? 'no_pool'
            : fee <= 0
              ? 'free'
              : paidKey.has(`${poolId}:${p.id}`)
                ? 'paid'
                : 'unpaid'
        const tag = poolId != null ? tagByKey.get(`${poolId}:${p.id}`) : null
        return {
          id: p.id,
          display_name: p.display_name,
          tips_locked: p.tips_locked === true,
          is_admin: p.is_admin === true,
          avatar_url: p.avatar_url ?? null,
          avatar_locked: p.avatar_locked === true,
          pool_id: poolId ?? null,
          pool_name: pool?.name ?? null,
          payment_status: paymentStatus,
          tag_color: tag?.color ?? null,
          tag_department: tag?.department ?? null,
          // Sann om DENNA pool är deltagarens aktiva liga.
          is_active_pool: poolId != null && p.pool_id === poolId,
        }
      })
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold text-white">Deltagare</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Alla användare. Lås upp AI-bild, ta bort konto eller se betalstatus.
          </p>
        </div>
      </div>

      <AdminUsersTable users={users} meUserId={me?.id ?? ''} />
    </div>
  )
}
