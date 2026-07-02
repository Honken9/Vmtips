import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveBracket, stripConfirmedResults } from '@/lib/bracket'
import { STAGE_LABELS } from '@/lib/types'
import type { Match, Team, Prediction, BonusPrediction, Stage } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// CSV-export av ALLA deltagares tips: samtliga gruppspelsmatcher,
// slutspelsträdet (som var och en tippat det – "från början", dvs upplöst
// från deras egna tips utan hänsyn till faktiska resultat) samt bonusfrågor.
// Endast master admin. Öppnas direkt i Excel/Numbers.

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  // Citera allt och dubbla inre citattecken – robust oavsett innehåll.
  return `"${s.replace(/"/g, '""')}"`
}

const KNOCKOUT_STAGES: Stage[] = ['r32', 'r16', 'qf', 'sf', '3rd', 'final']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!meProfile?.is_admin) {
    return NextResponse.json({ error: 'Endast admin' }, { status: 403 })
  }

  const admin = createAdminClient()

  const [
    { data: profilesRaw },
    { data: poolsRaw },
    { data: matchesRaw },
    { data: teamsRaw },
    { data: predsRaw },
    { data: bonusRaw },
  ] = await Promise.all([
    admin.from('profiles').select('id, display_name, pool_id'),
    admin.from('pools').select('id, name'),
    admin
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('match_number'),
    admin.from('teams').select('*'),
    admin.from('predictions').select('user_id, match_id, pred_home, pred_away'),
    admin.from('bonus_predictions').select('*'),
  ])

  const profiles = (profilesRaw ?? []) as { id: string; display_name: string; pool_id: number | null }[]
  const pools = (poolsRaw ?? []) as { id: number; name: string }[]
  const matches = (matchesRaw ?? []) as Match[]
  const teams = (teamsRaw ?? []) as Team[]
  const allPreds = (predsRaw ?? []) as Prediction[]
  const allBonus = (bonusRaw ?? []) as BonusPrediction[]

  const poolNameById = new Map(pools.map(p => [p.id, p.name]))
  const teamById = new Map(teams.map(t => [t.id, t]))

  // Email-adresser via auth
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailById = new Map<string, string>(
    (authList?.users ?? []).map(u => [u.id, u.email ?? ''])
  )

  // Preds per användare
  const predsByUser = new Map<string, Prediction[]>()
  for (const p of allPreds) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
    predsByUser.get(p.user_id)!.push(p)
  }
  const bonusByUser = new Map(allBonus.map(b => [b.user_id, b]))

  // För slutspelet "från början": lös upp trädet från VARJE deltagares egna
  // tips, utan hänsyn till faktiska resultat (delad helper med /tips + /slutspel).
  const matchesNoResults: Match[] = stripConfirmedResults(matches)

  const groupMatches = matches.filter(m => m.stage === 'group')
  const knockoutMatches = matches
    .filter(m => KNOCKOUT_STAGES.includes(m.stage))
    .sort((a, b) => a.match_number - b.match_number)

  // Sortera deltagare: liga, sedan namn
  const sortedProfiles = [...profiles].sort((a, b) => {
    const la = a.pool_id != null ? poolNameById.get(a.pool_id) ?? '' : ''
    const lb = b.pool_id != null ? poolNameById.get(b.pool_id) ?? '' : ''
    return la.localeCompare(lb) || a.display_name.localeCompare(b.display_name)
  })

  const header = [
    'Spelare', 'E-post', 'Liga', 'Del', 'Beskrivning',
    'Hemmalag', 'Bortalag', 'Tippat',
  ]
  const rows: string[] = ['sep=;', header.map(csvCell).join(';')]

  const scoreStr = (h: number | null | undefined, a: number | null | undefined) =>
    h == null || a == null ? '' : `${h}-${a}`

  for (const prof of sortedProfiles) {
    const name = prof.display_name
    const email = emailById.get(prof.id) ?? ''
    const liga = prof.pool_id != null ? poolNameById.get(prof.pool_id) ?? '' : ''
    const userPreds = predsByUser.get(prof.id) ?? []
    const predByMatch = new Map(userPreds.map(p => [p.match_id, p]))

    const base = [csvCell(name), csvCell(email), csvCell(liga)]

    // 1) Gruppspel – alla 72 matcher, blank om ej tippat
    for (const m of groupMatches) {
      const home = m.home_team?.name ?? m.home_placeholder ?? '?'
      const away = m.away_team?.name ?? m.away_placeholder ?? '?'
      const pr = predByMatch.get(m.id)
      rows.push([
        ...base,
        csvCell('Gruppspel'),
        csvCell(`Match ${m.match_number}${m.group_name ? ` (Grupp ${m.group_name})` : ''}`),
        csvCell(home),
        csvCell(away),
        csvCell(scoreStr(pr?.pred_home, pr?.pred_away)),
      ].join(';'))
    }

    // 2) Slutspelsträdet från början – upplöst från deltagarens egna tips
    const br = resolveBracket(matchesNoResults, teams, userPreds)
    const resolvedTeams = new Map<number, [Team | null, Team | null]>()
    br.r32Matches.forEach((m, i) => resolvedTeams.set(m.id, br.r32Teams[i]))
    br.r16Matches.forEach((m, i) => resolvedTeams.set(m.id, br.r16Teams[i]))
    br.qfMatches.forEach((m, i) => resolvedTeams.set(m.id, br.qfTeams[i]))
    br.sfMatches.forEach((m, i) => resolvedTeams.set(m.id, br.sfTeams[i]))
    if (br.finalMatch) resolvedTeams.set(br.finalMatch.id, br.finalTeams)
    if (br.thirdMatch) resolvedTeams.set(br.thirdMatch.id, br.thirdTeams)

    for (const m of knockoutMatches) {
      const [rh, ra] = resolvedTeams.get(m.id) ?? [null, null]
      const home = rh?.name ?? m.home_placeholder ?? '?'
      const away = ra?.name ?? m.away_placeholder ?? '?'
      const pr = predByMatch.get(m.id)
      rows.push([
        ...base,
        csvCell(STAGE_LABELS[m.stage] ?? m.stage),
        csvCell(`Match ${m.match_number}`),
        csvCell(home),
        csvCell(away),
        csvCell(scoreStr(pr?.pred_home, pr?.pred_away)),
      ].join(';'))
    }

    // 3) Bonusfrågor
    const bonus = bonusByUser.get(prof.id)
    const yellowTeam = bonus?.most_yellow_team_id != null
      ? teamById.get(bonus.most_yellow_team_id)?.name ?? `Lag #${bonus.most_yellow_team_id}`
      : ''
    rows.push([...base, csvCell('Bonus'), csvCell('Skytteligavinnare'), csvCell(bonus?.top_scorer ?? ''), csvCell(''), csvCell('')].join(';'))
    rows.push([...base, csvCell('Bonus'), csvCell('Flest gula kort (lag)'), csvCell(yellowTeam), csvCell(''), csvCell('')].join(';'))
    rows.push([...base, csvCell('Bonus'), csvCell('Totalt antal mål'), csvCell(bonus?.total_goals != null ? String(bonus.total_goals) : ''), csvCell(''), csvCell('')].join(';'))
  }

  // UTF-8 BOM så åäö renderas rätt i Excel
  const csv = '﻿' + rows.join('\r\n') + '\r\n'
  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vm2026-alla-tips-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
