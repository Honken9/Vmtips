// Cron-triggad veckodigest per liga. Genererar fyndig text via Gemini
// och en HTML-mall med tabeller + CSS-baserade staplar.
// Kan också triggas manuellt från /admin/email.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, recipientsFor, wrapEmailHtml, logEmail, getEmailSettings } from '@/lib/email'
import { gatherDigestData, renderDigestHtml } from '@/lib/digest'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Bara CRON_SECRET via Bearer-header. Används för GET (Vercel Cron) så
// en inloggad admin inte kan CSRF:as till att trigga massutskick.
function isCronAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return req.headers.get('authorization') === `Bearer ${cronSecret}`
}

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  return profile?.is_admin === true
}

// POST: admin-knappen i /admin/email ELLER cron. SameSite-cookies +
// kravet på inloggad admin skyddar mot cross-site POST.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await isAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return runDigest(req)
}

// GET: ENBART cron-secret – ingen cookie-fallback, annars kan en admin
// CSRF:as via en länk till mass-utskick.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return runDigest(req)
}

async function runDigest(req: NextRequest) {
  const admin = createAdminClient()
  const settings = await getEmailSettings()
  if (!settings) return NextResponse.json({ error: 'No email settings' }, { status: 500 })

  // Manuell trigger struntar i digest_enabled-flaggan
  const url = new URL(req.url)
  const forcePoolId = url.searchParams.get('pool_id')
  const isManual = url.searchParams.get('manual') === '1'
  if (!isManual && !settings.digest_enabled) {
    return NextResponse.json({ ok: true, skipped: 'digest disabled' })
  }

  // Plocka ligor som har medlemmar
  let pools: Array<{ id: number; name: string }> = []
  if (forcePoolId) {
    const { data } = await admin.from('pools').select('id, name').eq('id', Number(forcePoolId)).is('deleted_at', null)
    pools = (data as Array<{ id: number; name: string }> | null) ?? []
  } else {
    const { data } = await admin.from('pools').select('id, name').is('deleted_at', null)
    pools = (data as Array<{ id: number; name: string }> | null) ?? []
  }

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const sentInfo: Array<{ pool: string; recipients: number; status: string; error?: string }> = []

  for (const pool of pools) {
    // Hitta members
    const { data: memberships } = await admin
      .from('pool_memberships')
      .select('user_id')
      .eq('pool_id', pool.id)
    const userIds = ((memberships ?? []) as { user_id: string }[]).map(m => m.user_id)
    if (userIds.length === 0) {
      sentInfo.push({ pool: pool.name, recipients: 0, status: 'no members' })
      continue
    }
    const recipients = await recipientsFor(userIds, 'digest')
    if (recipients.length === 0) {
      sentInfo.push({ pool: pool.name, recipients: 0, status: 'all opted out' })
      continue
    }

    const data = await gatherDigestData(pool.id, oneWeekAgo)
    const subject = `📰 ${pool.name} – veckans rapport`
    const html = wrapEmailHtml(subject, renderDigestHtml(data))

    const result = await sendEmail({
      to: recipients.map(r => r.email),
      subject,
      html,
    })
    await logEmail('digest', recipients.length, subject, result.ok ? 'sent' : 'error', pool.id, result.error ?? null)

    sentInfo.push({
      pool: pool.name,
      recipients: recipients.length,
      status: result.ok ? 'sent' : 'error',
      error: result.error,
    })
  }

  // Stämpla senaste digest
  if (!forcePoolId && sentInfo.some(s => s.status === 'sent')) {
    await admin.from('email_settings').update({ last_digest_at: new Date().toISOString() }).eq('id', 1)
  }

  return NextResponse.json({ ok: true, pools: sentInfo })
}
