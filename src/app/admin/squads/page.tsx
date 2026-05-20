import { createClient } from '@/lib/supabase/server'
import { SquadOverrideClient } from './SquadOverrideClient'

export const dynamic = 'force-dynamic'

interface Override {
  team_code: string
  players: unknown
  locked: boolean | null
  updated_at: string
}

export default async function AdminSquadsPage() {
  const supabase = await createClient()
  const [{ data: teamsRaw }, { data: overridesRaw }] = await Promise.all([
    supabase.from('teams').select('code, name, flag').order('name'),
    supabase.from('team_squad_overrides').select('team_code, players, locked, updated_at'),
  ])

  const teams = (teamsRaw ?? []) as { code: string; name: string; flag: string }[]
  const overrides = (overridesRaw ?? []) as Override[]
  const overrideMap: Record<string, { count: number; updated: string; locked: boolean }> = {}
  for (const o of overrides) {
    overrideMap[o.team_code] = {
      count: Array.isArray(o.players) ? o.players.length : 0,
      updated: o.updated_at,
      locked: !!o.locked,
    }
  }

  return <SquadOverrideClient teams={teams} overrideMap={overrideMap} />
}
