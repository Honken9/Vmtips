import { createClient } from '@/lib/supabase/server'
import { listSnapshots, createSignedDownloadUrl } from '@/lib/backup'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
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

  const list = await listSnapshots()
  const withUrls = await Promise.all(
    list.map(async snap => ({
      ...snap,
      downloadUrl: await createSignedDownloadUrl(snap.key),
    }))
  )
  return NextResponse.json({ snapshots: withUrls })
}
