import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { LeaderboardEntry } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Fryser en kopia av leaderboard-vyn till leaderboard_snapshots +
// leaderboard_snapshot_rows. Endast master admin. Helt läsande mot
// befintlig data – inget i den levande poängberäkningen rörs.

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}))
  const label = (typeof body.label === 'string' && body.label.trim().slice(0, 120)) ||
    `Snapshot ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`

  const admin = createAdminClient()

  const { data: leaderboardRaw, error: lbErr } = await admin
    .from('leaderboard')
    .select('*')
  if (lbErr) {
    return NextResponse.json(
      { error: `Kunde inte läsa leaderboard: ${lbErr.message}` },
      { status: 500 }
    )
  }
  const entries = (leaderboardRaw ?? []) as LeaderboardEntry[]

  const { data: snap, error: snapErr } = await admin
    .from('leaderboard_snapshots')
    .insert({ label, created_by: user.id })
    .select('id, label, created_at')
    .single()
  if (snapErr || !snap) {
    const hint = snapErr?.message?.includes('does not exist')
      ? ' – kör supabase/add_leaderboard_snapshots.sql först'
      : ''
    return NextResponse.json(
      { error: `Kunde inte skapa snapshot: ${snapErr?.message ?? 'okänt'}${hint}` },
      { status: 500 }
    )
  }

  const rows = entries.map(e => ({
    snapshot_id: snap.id,
    user_id: e.user_id,
    display_name: e.display_name,
    pool_id: e.pool_id,
    predictions_graded: e.predictions_graded,
    correct_results: e.correct_results,
    exact_scores: e.exact_scores,
    bonus_points: e.bonus_points,
    total_points: e.total_points,
  }))

  if (rows.length > 0) {
    const { error: rowsErr } = await admin
      .from('leaderboard_snapshot_rows')
      .insert(rows)
    if (rowsErr) {
      // Städa bort den tomma snapshot-raden så listan inte skräpas ner
      await admin.from('leaderboard_snapshots').delete().eq('id', snap.id)
      return NextResponse.json(
        { error: `Kunde inte spara rader: ${rowsErr.message}` },
        { status: 500 }
      )
    }
  }

  return NextResponse.json({
    ok: true,
    snapshot: { id: snap.id, label: snap.label, created_at: snap.created_at, rows: rows.length },
  })
}
