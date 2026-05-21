import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { LeaderboardEntry, Pool, PoolPayment, PoolMemberTag, Profile } from '@/lib/types'
import { LigaClient } from './LigaClient'

export const dynamic = 'force-dynamic'

interface MemberRow {
  user_id: string
  display_name: string
  is_admin: boolean
  avatar_url: string | null
  paid: boolean
  paid_at: string | null
  amount: number | null
}

export default async function LigaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('id, pool_id, is_admin, display_name')
    .eq('id', user.id)
    .single()
  if (!meProfile?.pool_id) redirect('/select-pool')

  const poolId = meProfile.pool_id
  const meIsAdmin = meProfile.is_admin === true

  const [
    { data: pool },
    { data: profilesRaw },
    { data: paymentsRaw },
    { data: leaderboardRaw },
    { data: membershipsRaw },
    { data: tagsRaw },
  ] = await Promise.all([
    supabase.from('pools').select('*').eq('id', poolId).single(),
    supabase.from('profiles').select('id, display_name, is_admin, avatar_url').eq('pool_id', poolId),
    supabase.from('pool_payments').select('*').eq('pool_id', poolId),
    supabase.from('leaderboard').select('*'),
    supabase.from('pool_memberships').select('pool:pools(*)').eq('user_id', user.id),
    supabase.from('pool_member_tags').select('*').eq('pool_id', poolId),
  ])

  if (!pool) redirect('/select-pool')

  const currentPool = pool as Pool
  const profiles = (profilesRaw ?? []) as Pick<Profile, 'id' | 'display_name' | 'is_admin' | 'avatar_url'>[]
  const payments = (paymentsRaw ?? []) as PoolPayment[]
  const ranking = ((leaderboardRaw ?? []) as LeaderboardEntry[]).filter(e => e.pool_id === poolId)
  const allLigor = ((membershipsRaw ?? [])
    .flatMap(m => {
      const p = (m as unknown as { pool: Pool | Pool[] | null }).pool
      if (!p) return []
      return Array.isArray(p) ? p : [p]
    }) as Pool[])
    .sort((a, b) => a.name.localeCompare(b.name))

  const paymentsByUser = new Map(payments.map(p => [p.user_id, p]))
  const members: MemberRow[] = profiles
    .map(p => {
      const pay = paymentsByUser.get(p.id)
      return {
        user_id: p.id,
        display_name: p.display_name,
        is_admin: p.is_admin === true,
        avatar_url: p.avatar_url ?? null,
        paid: pay?.paid === true,
        paid_at: pay?.paid_at ?? null,
        amount: pay?.amount ?? null,
      }
    })
    .sort((a, b) => a.display_name.localeCompare(b.display_name))

  const isCreator = currentPool.created_by === user.id
  const canManage = isCreator || meIsAdmin

  const tags = (tagsRaw ?? []) as PoolMemberTag[]

  return (
    <LigaClient
      pool={currentPool}
      meUserId={user.id}
      meDisplayName={meProfile.display_name}
      members={members}
      ranking={ranking}
      canManage={canManage}
      allLigor={allLigor}
      tags={tags}
    />
  )
}
