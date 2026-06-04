import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Låser upp tips för EN deltagare så att de kan ändras igen.
// Rör inte andras tips eller globalt läge.
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })

  const { data: meProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!meProfile?.is_admin) {
    return NextResponse.json({ error: 'Endast admin får låsa upp tips' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id saknas' }, { status: 400 })

  const admin = createAdminClient()

  // 1) Profil-flaggan – styr UI:t i /tips
  const { error: profErr } = await admin
    .from('profiles')
    .update({ tips_locked: false, tips_locked_at: null })
    .eq('id', id)
  if (profErr) {
    return NextResponse.json(
      { error: `Kunde inte uppdatera profil: ${profErr.message}` },
      { status: 500 }
    )
  }

  // 2) Per-match-tips – tas bort som lock så de kan UPSERT:as på nytt
  const { error: predErr } = await admin
    .from('predictions')
    .update({ locked: false, locked_at: null })
    .eq('user_id', id)
  if (predErr) {
    return NextResponse.json(
      { error: `Kunde inte låsa upp tips: ${predErr.message}` },
      { status: 500 }
    )
  }

  // 3) Bonus-tips – kolumnerna finns alltid i schemat, så vi kör utan
  // try/catch men ignorerar fel om tabellen råkar vara tom
  await admin
    .from('bonus_predictions')
    .update({ locked: false, locked_at: null })
    .eq('user_id', id)

  return NextResponse.json({ ok: true })
}
