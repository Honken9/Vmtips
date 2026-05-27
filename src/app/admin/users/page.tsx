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

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user: me } } = await supabase.auth.getUser()

  const [{ data: profilesRaw }, { data: poolsRaw }, { data: paymentsRaw }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, tips_locked, is_admin, avatar_url, avatar_locked, pool_id'),
    supabase.from('pools').select('id, name, entry_fee').is('deleted_at', null),
    supabase.from('pool_payments').select('pool_id, user_id, paid'),
  ])

  const profiles = (profilesRaw ?? []) as ProfileRow[]
  const pools = (poolsRaw ?? []) as PoolRow[]
  const payments = (paymentsRaw ?? []) as PaymentRow[]

  const poolById = new Map(pools.map(p => [p.id, p]))
  const paidKey = new Set(payments.filter(p => p.paid).map(p => `${p.pool_id}:${p.user_id}`))

  const users = profiles
    .map(p => {
      const pool = p.pool_id != null ? poolById.get(p.pool_id) : null
      const fee = pool?.entry_fee ?? 0
      // 'free' = ingen avgift i ligan, 'paid' = betalt, 'unpaid' = ej betalt
      const paymentStatus: 'free' | 'paid' | 'unpaid' | 'no_pool' =
        p.pool_id == null
          ? 'no_pool'
          : fee <= 0
            ? 'free'
            : paidKey.has(`${p.pool_id}:${p.id}`)
              ? 'paid'
              : 'unpaid'
      return {
        id: p.id,
        display_name: p.display_name,
        tips_locked: p.tips_locked === true,
        is_admin: p.is_admin === true,
        avatar_url: p.avatar_url ?? null,
        avatar_locked: p.avatar_locked === true,
        pool_id: p.pool_id ?? null,
        pool_name: pool?.name ?? null,
        payment_status: paymentStatus,
      }
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
