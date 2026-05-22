// Cron-triggad. Skickar mejl till alla användare med opt-in när
// nästa match närmar sig (default 60 min före kickoff).
// Auth: Vercel cron skickar Bearer-token (CRON_SECRET) ELLER admin-anrop.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sendEmail, recipientsFor, wrapEmailHtml, logEmail, getEmailSettings } from '@/lib/email'
import { renderReminderHtml } from '@/lib/digest'

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

// POST: admin-knappen i /admin/email ELLER cron.
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req) && !(await isAdmin())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return runReminder(req)
}

// GET: Vercel Cron – ENBART cron-secret, ingen cookie-fallback (CSRF-skydd).
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  return runReminder(req)
}

async function runReminder(req: NextRequest) {

  const admin = createAdminClient()
  const settings = await getEmailSettings()
  if (!settings) return NextResponse.json({ error: 'No email settings' }, { status: 500 })
  if (!settings.reminder_enabled) return NextResponse.json({ ok: true, skipped: 'reminders disabled' })

  const minutesBefore = settings.reminder_minutes_before
  const now = new Date()
  const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000)

  // Matcher inom påminnelse-fönstret som ännu inte är confirmade
  const { data: matches } = await admin
    .from('matches')
    .select('id, kickoff_at, venue, home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), home_placeholder, away_placeholder')
    .eq('result_confirmed', false)
    .gte('kickoff_at', now.toISOString())
    .lte('kickoff_at', windowEnd.toISOString())
    .order('kickoff_at')
  const matchList = ((matches ?? []) as Array<{
    id: number
    kickoff_at: string
    venue: string | null
    home_team: { name?: string } | { name?: string }[] | null
    away_team: { name?: string } | { name?: string }[] | null
    home_placeholder: string | null
    away_placeholder: string | null
  }>)
  if (matchList.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, info: 'inga matcher i fönstret' })
  }

  // Hämta alla användare (med profile)
  const { data: profilesData } = await admin.from('profiles').select('id, pool_id')
  const profiles = (profilesData ?? []) as Array<{ id: string; pool_id: number | null }>

  // För varje match: skicka till users som ej fått påminnelse för den matchen
  const { data: sentRows } = await admin
    .from('email_reminders_sent')
    .select('match_id, user_id')
    .in('match_id', matchList.map(m => m.id))
  const alreadySent = new Set(((sentRows ?? []) as { match_id: number; user_id: string }[]).map(r => `${r.match_id}:${r.user_id}`))

  // För enkelhet: ett mejl per user med ALLA matcher i fönstret
  // (slipper N mejl om N matcher samtidigt)
  const usersToEmail = profiles.filter(p => {
    return matchList.some(m => !alreadySent.has(`${m.id}:${p.id}`))
  })
  const userIds = usersToEmail.map(p => p.id)
  const recipients = await recipientsFor(userIds, 'reminder')
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, info: 'inga mottagare' })
  }

  const matchHtmlRows = matchList.map(m => ({
    home: (Array.isArray(m.home_team) ? m.home_team[0]?.name : m.home_team?.name) ?? m.home_placeholder ?? '?',
    away: (Array.isArray(m.away_team) ? m.away_team[0]?.name : m.away_team?.name) ?? m.away_placeholder ?? '?',
    kickoffIso: m.kickoff_at,
    venue: m.venue,
  }))

  const html = wrapEmailHtml(
    settings.reminder_subject,
    renderReminderHtml({
      intro: settings.reminder_intro,
      matches: matchHtmlRows,
      myPredictionMap: new Map(),
      matchIdToIdx: new Map(),
    })
  )

  const result = await sendEmail({
    to: recipients.map(r => r.email),
    subject: settings.reminder_subject,
    html,
  })

  await logEmail('reminder', recipients.length, settings.reminder_subject, result.ok ? 'sent' : 'error', null, result.error ?? null)

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  // Markera som skickade
  const dedupRows = recipients.flatMap(r =>
    matchList.map(m => ({ match_id: m.id, user_id: r.user_id }))
  ).filter(row => !alreadySent.has(`${row.match_id}:${row.user_id}`))
  if (dedupRows.length > 0) {
    await admin.from('email_reminders_sent').insert(dedupRows)
  }

  return NextResponse.json({ ok: true, sent: recipients.length, matches: matchList.length })
}
