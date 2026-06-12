import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Match, Team } from '@/lib/types'
import { STAGE_LABELS } from '@/lib/types'
import { resolveBracket } from '@/lib/bracket'

// Publik ICS-feed av hela spelschemat. Apple Calendar / Outlook / Google
// kan prenumerera via webcal://-länken på /matches och uppdateras
// automatiskt. Inget auth-krav: schemat är publikt.
//
// Slutspels-matcher som ännu inte har konkreta lag visas med DB-placeholders
// ("Vinnare grupp A vs 3:a (B/C/D)"). Resultat-rader får ✅-prefix och slut-
// resultatet i SUMMARY.

export const dynamic = 'force-dynamic'
// Vercel cachar i 1h, kalender-app:n får ändå REFRESH-INTERVAL hint.
export const revalidate = 3600

function escapeIcsText(s: string): string {
  // RFC 5545: backslash, komma, semikolon, newline måste escape:as
  return s.replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function toIcsUtc(d: Date): string {
  // YYYYMMDDTHHMMSSZ (UTC)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function teamLabel(t: Team | null | undefined, placeholder: string | null | undefined): string {
  if (t) return `${t.flag} ${t.name}`.trim()
  return placeholder?.trim() || 'TBD'
}

export async function GET(req: Request) {
  const admin = createAdminClient()

  const [{ data: matchesRaw }, { data: teamsRaw }] = await Promise.all([
    admin
      .from('matches')
      .select('*, home_team:teams!matches_home_team_id_fkey(*), away_team:teams!matches_away_team_id_fkey(*)')
      .order('match_number'),
    admin.from('teams').select('*'),
  ])

  const matches = (matchesRaw ?? []) as Match[]
  const teams = (teamsRaw ?? []) as Team[]

  // Resolver för slutspel: ger oss "konkretare" lag i ICS:en när
  // gruppspelets resultat avgjorts. Använder bekräftade resultat (inte
  // någons tips) genom att skicka in tom prediction-array.
  const resolved = resolveBracket(matches, teams, [])
  const resolvedTeams = new Map<number, [Team | null, Team | null]>()
  resolved.r32Matches.forEach((m, i) => resolvedTeams.set(m.id, resolved.r32Teams[i]))
  resolved.r16Matches.forEach((m, i) => resolvedTeams.set(m.id, resolved.r16Teams[i]))
  resolved.qfMatches.forEach((m, i) => resolvedTeams.set(m.id, resolved.qfTeams[i]))
  resolved.sfMatches.forEach((m, i) => resolvedTeams.set(m.id, resolved.sfTeams[i]))
  if (resolved.finalMatch) resolvedTeams.set(resolved.finalMatch.id, resolved.finalTeams)
  if (resolved.thirdMatch) resolvedTeams.set(resolved.thirdMatch.id, resolved.thirdTeams)

  const origin = new URL(req.url).origin
  const dtstamp = toIcsUtc(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tippavm2026.se//VM-Tips Matches//SV',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:VM 2026 – Alla matcher',
    'X-WR-CALDESC:FIFA World Cup 2026 spelschema. Uppdateras med resultat och slutspelslag.',
    'X-WR-TIMEZONE:Europe/Stockholm',
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
  ]

  for (const m of matches) {
    const start = new Date(m.kickoff_at)
    // Default 2h slot för en match (90 min + paus + ev. förlängning)
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)

    // Föredra resolverade lag (med riktiga lag inifyllda), annars DB-data
    const [rHome, rAway] = resolvedTeams.get(m.id) ?? [null, null]
    const homeName = teamLabel(rHome ?? m.home_team, m.home_placeholder)
    const awayName = teamLabel(rAway ?? m.away_team, m.away_placeholder)

    const stage = STAGE_LABELS[m.stage] ?? m.stage
    const groupTag = m.group_name ? ` (Grupp ${m.group_name})` : ''

    const scoreSuffix =
      m.result_confirmed && m.home_score != null && m.away_score != null
        ? ` ${m.home_score}–${m.away_score} ✅`
        : ''

    const summary = `#${m.match_number}: ${homeName} – ${awayName}${scoreSuffix}`

    // ICS DESCRIPTION: escape per fragment + lager-join med `\n` (ICS-escape
    // för radbryt). Annars äter komma/semikolon i platsnamn upp efterföljande
    // text i en del kalenderklienter.
    const descFragments = [
      `${stage}${groupTag}`,
      m.venue ? `Plats: ${m.venue}` : '',
      m.result_confirmed && m.home_score != null && m.away_score != null
        ? `Slutresultat: ${m.home_score}–${m.away_score}`
        : 'Resultat tillkommer',
      '',
      `Mer info: ${origin}/matches`,
    ].filter(Boolean)
    const description = descFragments.map(escapeIcsText).join('\\n')

    lines.push(
      'BEGIN:VEVENT',
      `UID:match-${m.match_number}@tippavm2026.se`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${toIcsUtc(start)}`,
      `DTEND:${toIcsUtc(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${description}`,
      m.venue ? `LOCATION:${escapeIcsText(m.venue)}` : '',
      `URL:${origin}/matches`,
      `CATEGORIES:${escapeIcsText(stage)}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  const body = lines.filter(Boolean).join('\r\n') + '\r\n'

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="vm-2026-matches.ics"',
      // Tillåt CDN-cache i 1h, men kalender-appar styrs av REFRESH-INTERVAL
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=60',
    },
  })
}
