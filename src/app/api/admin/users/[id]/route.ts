import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  // Admin-auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const { data: meProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!meProfile?.is_admin) {
    return NextResponse.json({ error: 'Endast admin får ta bort användare' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!id) return NextResponse.json({ error: 'id saknas' }, { status: 400 })
  if (id === user.id) {
    return NextResponse.json({ error: 'Du kan inte ta bort dig själv' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Refusera om användaren äger aktiva ligor – owner måste överlåtas först.
  const { data: ownedPools } = await admin
    .from('pools')
    .select('id, name')
    .eq('created_by', id)
    .is('deleted_at', null)
  if (ownedPools && ownedPools.length > 0) {
    return NextResponse.json(
      {
        error: 'owns_pools',
        message: 'Användaren äger ligor. Lämna över ägandeskapet först.',
        pools: ownedPools,
      },
      { status: 409 }
    )
  }

  // Ta bort auth-användaren – CASCADE på profiles, predictions, bonus_predictions,
  // pool_memberships, pool_payments och pool_member_tags ger fullstädning.
  const { error: delErr } = await admin.auth.admin.deleteUser(id)
  if (delErr) {
    return NextResponse.json(
      { error: `Kunde inte ta bort: ${delErr.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
