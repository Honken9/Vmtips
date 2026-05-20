import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchTeamFootball } from '@/lib/team-data'
import { fetchPlayerInfo } from '@/lib/wiki-photos'

export const dynamic = 'force-dynamic'

type PosBucket = 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Forward'

function normalizeBucket(raw: string | null | undefined): PosBucket | null {
  const p = (raw ?? '').toLowerCase().trim()
  if (!p) return null
  if (p.includes('keeper') || p === 'gk') return 'Goalkeeper'
  if (
    p.includes('back') || p.includes('defen') ||
    p === 'cb' || p === 'lb' || p === 'rb' || p === 'wb' || p.includes('sweeper')
  ) return 'Defender'
  if (
    p.includes('midfield') ||
    p === 'cm' || p === 'dm' || p === 'am' || p === 'cdm' || p === 'cam'
  ) return 'Midfielder'
  if (
    p.includes('forward') || p.includes('winger') || p.includes('wing') ||
    p.includes('striker') || p.includes('attack') ||
    p === 'st' || p === 'cf' || p === 'lw' || p === 'rw'
  ) return 'Forward'
  return null
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ code: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'auth' }, { status: 401 })
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { code: rawCode } = await ctx.params
  const code = rawCode.toUpperCase()
  const bypass = req.nextUrl.searchParams.get('bypass') === '1'

  const football = await fetchTeamFootball(code, { bypassOverride: bypass })
  if (!football) return NextResponse.json({ players: [], coach: null })

  const rawSquad = football.squad ?? []
  const wikiInfo =
    rawSquad.length > 0
      ? await fetchPlayerInfo(rawSquad.map(p => p.name))
      : new Map<string, { photoUrl?: string; currentClub?: string }>()

  const players = rawSquad.map(p => {
    const info = wikiInfo.get(p.name)
    const bucket = normalizeBucket(p.position)
    return {
      name: p.name,
      position: bucket,
      club: p.club ?? info?.currentClub ?? '',
      youthClub: p.youthClub ?? '',
      marketValueM:
        p.marketValueM ??
        (bucket === 'Forward' ? 4
          : bucket === 'Midfielder' ? 3
          : bucket === 'Defender' ? 2.5
          : bucket === 'Goalkeeper' ? 1.5
          : 2),
    }
  })

  return NextResponse.json({
    players,
    coach: football.coachName,
    provisional: football.squadIsProvisional,
  })
}
