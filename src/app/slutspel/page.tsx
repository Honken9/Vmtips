import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import type { Match, Team, Prediction, Profile, Pool } from '@/lib/types'
import { BracketView } from '@/components/BracketView'
import { GitBranch } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BracketPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('display_name, pool_id')
    .eq('id', user.id)
    .maybeSingle()
  const profile = profileRaw as Pick<Profile, 'display_name' | 'pool_id'> | null
  if (!profile?.pool_id) redirect('/select-pool')

  const [{ data: matchesRaw }, { data: teamsRaw }, { data: predsRaw }, { data: poolRaw }] = await Promise.all([
    supabase
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('kickoff_at'),
    supabase.from('teams').select('*'),
    supabase.from('predictions').select('*').eq('user_id', user.id),
    supabase.from('pools').select('name, image_url').eq('id', profile.pool_id).maybeSingle(),
  ])

  const matches = (matchesRaw ?? []) as Match[]
  const teams = (teamsRaw ?? []) as Team[]
  const predictions = (predsRaw ?? []) as Prediction[]
  const pool = poolRaw as Pick<Pool, 'name' | 'image_url'> | null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {pool?.image_url ? (
          <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0"
            style={{ border: '1px solid #1f2937' }}>
            <Image
              src={pool.image_url}
              alt={pool.name ?? 'Liga'}
              fill
              className="object-cover"
              sizes="56px"
              unoptimized
            />
          </div>
        ) : (
          <GitBranch size={22} className="text-emerald-400" />
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">Mitt slutspel</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Slutspels-trädet enligt dina tips – från 16-delar in mot finalen i mitten.
          </p>
        </div>
      </div>

      <BracketView
        matches={matches}
        teams={teams}
        predictions={predictions}
        displayName={profile.display_name}
      />
    </div>
  )
}
