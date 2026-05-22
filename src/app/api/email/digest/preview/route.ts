// Genererar digest-innehållet för alla ligor UTAN att skicka, så admin
// kan läsa + redigera den fyndiga intro-texten innan utskick.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { gatherDigestData } from '@/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return profile?.is_admin === true
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: poolsRaw } = await admin
    .from('pools')
    .select('id, name')
    .is('deleted_at', null)
  const pools = (poolsRaw ?? []) as Array<{ id: number; name: string }>

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

  const previews: Array<{
    pool_id: number
    pool_name: string
    recipient_count: number
    witty_intro: string
    matches_count: number
    leaderboard_count: number
  }> = []

  for (const pool of pools) {
    const { count } = await admin
      .from('pool_memberships')
      .select('user_id', { head: true, count: 'exact' })
      .eq('pool_id', pool.id)
    const data = await gatherDigestData(pool.id, oneWeekAgo)
    previews.push({
      pool_id: pool.id,
      pool_name: pool.name,
      recipient_count: count ?? 0,
      witty_intro: data.wittyIntro,
      matches_count: data.matchesPlayed.length,
      leaderboard_count: data.leaderboard.length,
    })
  }

  return NextResponse.json({ previews })
}
