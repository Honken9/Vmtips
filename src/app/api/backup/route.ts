import { createClient } from '@/lib/supabase/server'
import { gatherBackupData, createSnapshot } from '@/lib/backup'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) {
    return { ok: false, res: NextResponse.json({ error: 'Endast admin' }, { status: 403 }) }
  }
  return { ok: true }
}

// GET → laddar ner full backup som JSON-fil (endast admin)
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.res

  const data = await gatherBackupData('manual-download')
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="vmtips-backup-${data.created_at.replace(/[:.]/g, '-')}.json"`,
    },
  })
}

// POST → skapar snapshot i Storage. Kräver bara inloggning eftersom rate limit
// (10 min) skyddar mot spam. ?force=true endast tillåten för admin.
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const reason = url.searchParams.get('reason') ?? 'manual'
  const wantsForce = url.searchParams.get('force') === 'true'

  let force = false
  if (wantsForce) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    force = profile?.is_admin === true
  }

  const result = await createSnapshot(reason, force)
  return NextResponse.json(result)
}
