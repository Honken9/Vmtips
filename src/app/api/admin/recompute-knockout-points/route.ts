import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calcKnockoutPoints } from '@/lib/knockout-points'
import type { Match, Team, Prediction } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Räknar om ALLA deltagares slutspelspoäng (3p/lag/omgång + 5p mästare)
// och materialiserar i user_knockout_points. Körs automatiskt efter varje
// resultat-inmatning i admin samt manuellt via knapp. Master admin only.

export async function POST() {
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
    { data: matchesRaw },
    { data: teamsRaw },
    { data: profilesRaw },
  ] = await Promise.all([
    admin.from('matches').select('*'),
    admin.from('teams').select('*'),
    admin.from('profiles').select('id'),
  ])

  // predictions är >5000 rader och PostgREST returnerar max 1000 per
  // fråga – hämta ALLTID med paginering. Utan detta når bara en bråkdel
  // av tipsen poängmotorn och träden slutar propagera efter R32.
  const allPreds: Prediction[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pageErr } = await admin
      .from('predictions')
      .select('*')
      .order('id')
      .range(from, from + PAGE - 1)
    if (pageErr) {
      return NextResponse.json(
        { error: `Kunde inte hämta tips: ${pageErr.message}` },
        { status: 500 }
      )
    }
    allPreds.push(...((page ?? []) as Prediction[]))
    if (!page || page.length < PAGE) break
  }

  const matches = (matchesRaw ?? []) as Match[]
  const teams = (teamsRaw ?? []) as Team[]
  const profiles = (profilesRaw ?? []) as { id: string }[]

  const predsByUser = new Map<string, Prediction[]>()
  for (const p of allPreds) {
    if (!predsByUser.has(p.user_id)) predsByUser.set(p.user_id, [])
    predsByUser.get(p.user_id)!.push(p)
  }

  const now = new Date().toISOString()
  const rows = profiles.map(prof => {
    const preds = predsByUser.get(prof.id) ?? []
    const { points, breakdown } = calcKnockoutPoints(matches, teams, preds)
    return {
      user_id: prof.id,
      points,
      breakdown,
      computed_at: now,
    }
  })

  const { error: upsertErr } = await admin
    .from('user_knockout_points')
    .upsert(rows, { onConflict: 'user_id' })
  if (upsertErr) {
    const hint = upsertErr.message.includes('does not exist')
      ? ' – kör supabase/add_knockout_team_points.sql först'
      : ''
    return NextResponse.json(
      { error: `Kunde inte spara: ${upsertErr.message}${hint}` },
      { status: 500 }
    )
  }

  const withPoints = rows.filter(r => r.points > 0).length
  return NextResponse.json({
    ok: true,
    users: rows.length,
    withPoints,
    predictionsLoaded: allPreds.length,
    totalPoints: rows.reduce((s, r) => s + r.points, 0),
  })
}
