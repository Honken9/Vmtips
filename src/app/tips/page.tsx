import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TipsClient } from './TipsClient'
import { Match, Prediction, Settings, Profile, Team, BonusPrediction, BonusResults } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function TipsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Skapa profil om den saknas
  const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  if (!profileData) {
    await supabase.from('profiles').insert({
      id: user.id,
      display_name: user.email?.split('@')[0] ?? 'Användare',
      is_admin: false,
      tips_locked: false,
    })
  }

  const profile: Profile = profileData ?? {
    id: user.id,
    display_name: user.email?.split('@')[0] ?? 'Användare',
    is_admin: false,
    tips_locked: false,
    tips_locked_at: null,
    created_at: new Date().toISOString(),
  }

  const [
    { data: matchesData },
    { data: predictionsData },
    { data: settingsData },
    { data: teamsData },
    { data: bonusData },
    { data: bonusResultsData },
  ] = await Promise.all([
    supabase.from('matches').select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)').order('kickoff_at'),
    supabase.from('predictions').select('*').eq('user_id', user.id),
    supabase.from('settings').select('*').single(),
    supabase.from('teams').select('*').order('group_name').order('name'),
    supabase.from('bonus_predictions').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('bonus_results').select('*').eq('id', 1).maybeSingle(),
  ])

  const settings: Settings = settingsData ?? {
    id: 1, tournament_mode: 'B', mode_a_global_lock: false,
    points_correct_result: 3, points_exact_score: 5,
    points_winner: 10, points_finalist: 5,
    updated_at: new Date().toISOString(),
  }
  if (!settingsData) await supabase.from('settings').upsert({ id: 1 })

  return (
    <TipsClient
      profile={profile}
      matches={(matchesData ?? []) as Match[]}
      predictions={(predictionsData ?? []) as Prediction[]}
      settings={settings}
      teams={(teamsData ?? []) as Team[]}
      userId={user.id}
      bonus={(bonusData ?? null) as BonusPrediction | null}
      bonusResults={(bonusResultsData ?? null) as BonusResults | null}
    />
  )
}
