import { createClient } from '@/lib/supabase/server'
import { restoreFromSnapshot } from '@/lib/backup'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Endast admin' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { key, confirm } = body as { key?: string; confirm?: string }

  if (confirm !== 'ÅTERSTÄLL') {
    return NextResponse.json(
      { error: 'Bekräftelse saknas — confirm måste vara "ÅTERSTÄLL"' },
      { status: 400 }
    )
  }
  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key krävs' }, { status: 400 })
  }

  const result = await restoreFromSnapshot(key)
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}
