import { createClient } from '@/lib/supabase/server'
import { Match, Team } from '@/lib/types'
import { MatchesClient } from './MatchesClient'

export const dynamic = 'force-dynamic'

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ day?: string }>
}) {
  const { day } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('pool_id').eq('id', user.id).maybeSingle()
    : { data: null }

  const [{ data: matchesData }, { data: teamsData }] = await Promise.all([
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('teams').select('*').order('group_name').order('name'),
  ])

  return (
    <MatchesClient
      matches={(matchesData ?? []) as Match[]}
      teams={(teamsData ?? []) as Team[]}
      initialDay={day ?? ''}
      meUserId={user?.id ?? null}
      poolId={(profile as { pool_id?: number | null } | null)?.pool_id ?? null}
    />
  )
}
