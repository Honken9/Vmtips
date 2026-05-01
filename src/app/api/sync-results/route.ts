import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createSnapshot } from '@/lib/backup'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface FdTeam {
  id: number
  name: string | null
  shortName: string | null
  tla: string | null
}

interface FdMatch {
  id: number
  utcDate: string
  status: string
  stage: string
  group: string | null
  homeTeam: FdTeam | null
  awayTeam: FdTeam | null
  score: {
    fullTime: { home: number | null; away: number | null }
  }
}

// Aliasar för lagnamn (om TLA inte räcker)
const NAME_TO_CODE: Record<string, string> = {
  'United States': 'USA',
  'USA': 'USA',
  'Korea Republic': 'KOR',
  'South Korea': 'KOR',
  'Iran': 'IRN',
  "Côte d'Ivoire": 'CIV',
  'Cote d Ivoire': 'CIV',
  'Ivory Coast': 'CIV',
  'DR Congo': 'COD',
  'Congo DR': 'COD',
  'Türkiye': 'TUR',
  'Turkey': 'TUR',
  'Cabo Verde': 'CPV',
  'Cape Verde': 'CPV',
  'Bosnia and Herzegovina': 'BIH',
  'Czechia': 'CZE',
  'Czech Republic': 'CZE',
  'New Zealand': 'NZL',
}

function resolveCode(team: FdTeam | null): string | null {
  if (!team) return null
  if (team.tla) return team.tla
  const candidates = [team.name, team.shortName].filter(Boolean) as string[]
  for (const n of candidates) {
    if (NAME_TO_CODE[n]) return NAME_TO_CODE[n]
  }
  return null
}

export async function POST() {
  // Auth: kräv admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Endast admin' }, { status: 403 })
  }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'FOOTBALL_DATA_API_KEY saknas i .env.local' },
      { status: 500 }
    )
  }

  // Hämta från football-data.org
  let apiMatches: FdMatch[] = []
  try {
    const res = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      {
        headers: { 'X-Auth-Token': apiKey },
        cache: 'no-store',
      }
    )
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json(
        { error: `football-data.org svarade ${res.status}`, detail: text.slice(0, 300) },
        { status: 502 }
      )
    }
    const data = await res.json()
    apiMatches = data.matches ?? []
  } catch (err) {
    return NextResponse.json(
      { error: 'Kunde inte nå football-data.org', detail: String(err) },
      { status: 502 }
    )
  }

  const finished = apiMatches.filter(
    m =>
      m.status === 'FINISHED' &&
      m.score?.fullTime?.home != null &&
      m.score?.fullTime?.away != null
  )

  const admin = createAdminClient()

  const [{ data: ourMatches, error: matchesErr }, { data: teams, error: teamsErr }] =
    await Promise.all([
      admin
        .from('matches')
        .select(
          'id, kickoff_at, home_team_id, away_team_id, home_score, away_score, result_confirmed, manually_edited, external_id, stage'
        ),
      admin.from('teams').select('id, code'),
    ])

  if (matchesErr || teamsErr || !ourMatches || !teams) {
    return NextResponse.json(
      { error: 'Kunde inte läsa matcher/lag från Supabase', detail: matchesErr?.message || teamsErr?.message },
      { status: 500 }
    )
  }

  const teamByCode = new Map<string, number>()
  for (const t of teams) teamByCode.set(t.code.toUpperCase(), t.id)

  let updated = 0
  let skippedManual = 0
  let skippedUnchanged = 0
  const unmatched: string[] = []
  const errors: string[] = []

  for (const fm of finished) {
    const homeCode = resolveCode(fm.homeTeam)
    const awayCode = resolveCode(fm.awayTeam)
    const ourHome = homeCode ? teamByCode.get(homeCode.toUpperCase()) : undefined
    const ourAway = awayCode ? teamByCode.get(awayCode.toUpperCase()) : undefined

    // 1. Försök matcha via redan länkat external_id
    let ourMatch = ourMatches.find(m => m.external_id === fm.id)

    // 2. Annars: kickoff inom 24h + lag-koder matchar (om båda är kända i vår DB)
    if (!ourMatch) {
      const apiTime = new Date(fm.utcDate).getTime()
      ourMatch = ourMatches.find(m => {
        const diff = Math.abs(new Date(m.kickoff_at).getTime() - apiTime)
        if (diff > 24 * 60 * 60 * 1000) return false
        // Båda lag kända i båda databaser → kräver exakt match
        if (m.home_team_id && m.away_team_id && ourHome && ourAway) {
          return m.home_team_id === ourHome && m.away_team_id === ourAway
        }
        // Slutspel där vi har platshållare → matcha bara på datum + en sida om möjligt
        if (!m.home_team_id && !m.away_team_id) return true
        if (m.home_team_id && ourHome) return m.home_team_id === ourHome
        if (m.away_team_id && ourAway) return m.away_team_id === ourAway
        return false
      })
    }

    if (!ourMatch) {
      unmatched.push(`${homeCode ?? '?'} vs ${awayCode ?? '?'} (${fm.utcDate})`)
      continue
    }

    if (ourMatch.manually_edited) {
      skippedManual++
      continue
    }

    const home = fm.score.fullTime.home as number
    const away = fm.score.fullTime.away as number

    const alreadySame =
      ourMatch.result_confirmed &&
      ourMatch.home_score === home &&
      ourMatch.away_score === away &&
      ourMatch.external_id === fm.id

    if (alreadySame) {
      skippedUnchanged++
      continue
    }

    const update: Record<string, unknown> = {
      home_score: home,
      away_score: away,
      result_confirmed: true,
      external_id: fm.id,
    }
    if (ourHome && !ourMatch.home_team_id) update.home_team_id = ourHome
    if (ourAway && !ourMatch.away_team_id) update.away_team_id = ourAway

    const { error } = await admin.from('matches').update(update).eq('id', ourMatch.id)
    if (error) {
      errors.push(`Match ${ourMatch.id}: ${error.message}`)
      continue
    }
    updated++
  }

  // Lås tips för matcher som nu har avsparkat
  if (updated > 0) {
    await admin.rpc('lock_predictions_at_kickoff')
    // Auto-backup (rate-limited internt)
    await createSnapshot('sync-results').catch(() => {})
  }

  return NextResponse.json({
    fetched: apiMatches.length,
    finished: finished.length,
    updated,
    skipped_manual: skippedManual,
    skipped_unchanged: skippedUnchanged,
    unmatched,
    errors,
  })
}
