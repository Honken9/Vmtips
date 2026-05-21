// Genererar veckodigest per liga: stats + fyndig text via Gemini.
// Renderar HTML med tabeller + CSS-baserade staplar (mejl-säkert).

import { createAdminClient } from './supabase/admin'
import { escapeHtml } from './email'
import { GoogleGenAI } from '@google/genai'

export interface DigestData {
  poolId: number
  poolName: string
  sinceIso: string
  matchesPlayed: Array<{
    home: string
    away: string
    score: string
    kickoff: string
  }>
  leaderboard: Array<{
    user_id: string
    display_name: string
    total_points: number
    delta: number  // poäng sedan senaste digest
    correct_results: number
    exact_scores: number
  }>
  topMover: { name: string; delta: number } | null
  topTipper: { name: string; exact_in_window: number } | null
  wittyIntro: string
}

interface LeaderRow {
  user_id: string
  display_name: string
  total_points: number
  correct_results: number
  exact_scores: number
  pool_id: number | null
}

interface SnapshotRow {
  user_id: string
  total_points: number
}

export async function gatherDigestData(poolId: number, sinceIso: string): Promise<DigestData> {
  const admin = createAdminClient()

  const { data: pool } = await admin.from('pools').select('name').eq('id', poolId).maybeSingle()
  const poolName = (pool as { name?: string } | null)?.name ?? 'Ligan'

  // Matcher avgjorda sedan sist
  const { data: matchesRaw } = await admin
    .from('matches')
    .select('home_team:teams!matches_home_team_id_fkey(name), away_team:teams!matches_away_team_id_fkey(name), home_score, away_score, kickoff_at, home_placeholder, away_placeholder')
    .eq('result_confirmed', true)
    .gte('kickoff_at', sinceIso)
    .order('kickoff_at')
  const matchesPlayed = ((matchesRaw ?? []) as Array<{
    home_team: { name?: string } | { name?: string }[] | null
    away_team: { name?: string } | { name?: string }[] | null
    home_score: number | null
    away_score: number | null
    kickoff_at: string
    home_placeholder: string | null
    away_placeholder: string | null
  }>).map(m => {
    const h = Array.isArray(m.home_team) ? m.home_team[0]?.name : m.home_team?.name
    const a = Array.isArray(m.away_team) ? m.away_team[0]?.name : m.away_team?.name
    return {
      home: h ?? m.home_placeholder ?? '?',
      away: a ?? m.away_placeholder ?? '?',
      score: m.home_score != null && m.away_score != null ? `${m.home_score}–${m.away_score}` : '–',
      kickoff: new Date(m.kickoff_at).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' }),
    }
  })

  // Aktuell leaderboard för ligan
  const { data: lbRaw } = await admin.from('leaderboard').select('*')
  const lb = ((lbRaw ?? []) as LeaderRow[]).filter(r => r.pool_id === poolId)

  // Snapshot för delta-beräkning: använd email_log för att hitta förra digest
  // (om vi inte har snapshot, antar vi delta = nuvarande poäng)
  const { data: prevLog } = await admin
    .from('email_log')
    .select('sent_at')
    .eq('type', 'digest')
    .eq('pool_id', poolId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(2)  // [0] = den vi just skickar, [1] = förra
  const prevSentAt = (prevLog as { sent_at: string }[] | null)?.[1]?.sent_at
  // Enkel approximation: räkna predictions som är "lockade" sedan dess
  const prevSnap: Record<string, number> = {}
  if (prevSentAt) {
    // För enkelhet använder vi en grov uppskattning baserat på predictions i fönstret
    // Vi har ingen snapshot-tabell – så delta blir poäng från matcher som avgjorts efter prev_sent_at
    // Hämta predictions-poäng för matcher som confirmade efter prevSentAt
    const { data: matchesWindow } = await admin
      .from('matches')
      .select('id, home_score, away_score, kickoff_at')
      .eq('result_confirmed', true)
      .gte('kickoff_at', prevSentAt)
    const matchIds = ((matchesWindow ?? []) as { id: number; home_score: number | null; away_score: number | null }[])
    const { data: prs } = await admin
      .from('predictions')
      .select('user_id, match_id, pred_home, pred_away')
      .in('match_id', matchIds.map(m => m.id))
    const { data: settings } = await admin.from('settings').select('points_correct_result, points_exact_score').eq('id', 1).maybeSingle()
    const pcr = (settings as { points_correct_result?: number } | null)?.points_correct_result ?? 3
    const pes = (settings as { points_exact_score?: number } | null)?.points_exact_score ?? 5
    const matchMap = new Map(matchIds.map(m => [m.id, m]))
    for (const p of (prs ?? []) as { user_id: string; match_id: number; pred_home: number; pred_away: number }[]) {
      const m = matchMap.get(p.match_id)
      if (!m || m.home_score == null || m.away_score == null) continue
      const ph = p.pred_home, pa = p.pred_away
      let pts = 0
      if (ph === m.home_score && pa === m.away_score) pts = pes
      else if (Math.sign(ph - pa) === Math.sign(m.home_score - m.away_score)) pts = pcr
      prevSnap[p.user_id] = (prevSnap[p.user_id] ?? 0) + pts
    }
  }

  const leaderboard = lb
    .slice(0, 10)
    .map(r => ({
      user_id: r.user_id,
      display_name: r.display_name,
      total_points: r.total_points,
      delta: prevSnap[r.user_id] ?? r.total_points,
      correct_results: r.correct_results,
      exact_scores: r.exact_scores,
    }))

  // Topp-movers + topp-exakta i fönstret
  const allDeltas = lb
    .map(r => ({ name: r.display_name, delta: prevSnap[r.user_id] ?? r.total_points }))
    .filter(r => r.delta > 0)
    .sort((a, b) => b.delta - a.delta)
  const topMover = allDeltas[0] ?? null

  const topExacts = lb
    .map(r => ({ name: r.display_name, exact_in_window: r.exact_scores }))
    .sort((a, b) => b.exact_in_window - a.exact_in_window)
  const topTipper = topExacts[0] && topExacts[0].exact_in_window > 0 ? topExacts[0] : null

  // Generera fyndig intro via Gemini
  const wittyIntro = await generateWittyIntro({
    poolName,
    matchesPlayed: matchesPlayed.length,
    topMover,
    topTipper,
    leader: leaderboard[0]?.display_name ?? null,
    leaderPoints: leaderboard[0]?.total_points ?? 0,
  })

  return {
    poolId,
    poolName,
    sinceIso: prevSentAt ?? sinceIso,
    matchesPlayed,
    leaderboard,
    topMover,
    topTipper,
    wittyIntro,
  }
}

async function generateWittyIntro(ctx: {
  poolName: string
  matchesPlayed: number
  topMover: { name: string; delta: number } | null
  topTipper: { name: string; exact_in_window: number } | null
  leader: string | null
  leaderPoints: number
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return defaultIntro(ctx)
  }
  try {
    const genAI = new GoogleGenAI({ apiKey: key })
    const prompt = `Du är en fyndig sportkommentator för en VM-tipsliga i Sverige. Skriv 2-3 korta meningar (max 60 ord totalt) som intro till veckans digest-mejl. Var humoristisk, lite sarkastisk, kalla det "veckans rond" eller "rapport från fronten". Använd svenska, gärna en metafor från fotbollen.

Liga: ${ctx.poolName}
Matcher avgjorda denna vecka: ${ctx.matchesPlayed}
Ledare: ${ctx.leader ?? 'okänd'} (${ctx.leaderPoints} poäng)
Veckans raket: ${ctx.topMover ? `${ctx.topMover.name} (+${ctx.topMover.delta}p)` : 'ingen'}
Bäst på exakta tips: ${ctx.topTipper ? `${ctx.topTipper.name} (${ctx.topTipper.exact_in_window} st)` : 'ingen'}

Returnera bara texten (ingen markdown, ingen rubrik).`
    const res = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    })
    const text = res.candidates?.[0]?.content?.parts?.map(p => p.text).filter(Boolean).join(' ') ?? ''
    return text.trim() || defaultIntro(ctx)
  } catch {
    return defaultIntro(ctx)
  }
}

function defaultIntro(ctx: { poolName: string; matchesPlayed: number; leader: string | null }): string {
  if (ctx.matchesPlayed === 0) {
    return `Veckans rond från ${ctx.poolName}: tystnad på planen. Inga matcher avgjorda – men tabellen står still och nervositeten stiger.`
  }
  return `Veckans rond från ${ctx.poolName}: ${ctx.matchesPlayed} matcher i kistan. ${ctx.leader ? `${ctx.leader} leder fortfarande karavanen.` : ''}`
}

/** Bygg den faktiska HTML-strängen för digest-mejlet. */
export function renderDigestHtml(d: DigestData): string {
  const matchesTable = d.matchesPlayed.length === 0
    ? '<p style="color:#9ca3af;font-style:italic;">Inga matcher avgjorda sedan förra digesten.</p>'
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 24px;">
        ${d.matchesPlayed.map((m, i) => `
          <tr style="background:${i % 2 === 0 ? '#1f2937' : '#111827'};">
            <td style="padding:8px 10px;color:#9ca3af;font-size:12px;width:90px;">${escapeHtml(m.kickoff)}</td>
            <td style="padding:8px 10px;color:#e5e7eb;font-size:14px;text-align:right;">${escapeHtml(m.home)}</td>
            <td style="padding:8px 10px;color:#fbbf24;font-weight:700;font-size:15px;text-align:center;width:70px;">${escapeHtml(m.score)}</td>
            <td style="padding:8px 10px;color:#e5e7eb;font-size:14px;">${escapeHtml(m.away)}</td>
          </tr>
        `).join('')}
      </table>`

  const maxPoints = Math.max(1, ...d.leaderboard.map(l => l.total_points))
  const leaderboardTable = d.leaderboard.length === 0
    ? '<p style="color:#9ca3af;font-style:italic;">Inga deltagare med poäng än.</p>'
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 24px;">
        <tr>
          <th style="padding:6px 10px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">#</th>
          <th style="padding:6px 10px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Spelare</th>
          <th style="padding:6px 10px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Poäng</th>
          <th style="padding:6px 10px;text-align:right;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Vecka</th>
        </tr>
        ${d.leaderboard.map((row, i) => {
          const pct = Math.round((row.total_points / maxPoints) * 100)
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`
          return `<tr style="background:${i % 2 === 0 ? '#1f2937' : '#111827'};">
            <td style="padding:8px 10px;font-size:14px;color:#fbbf24;font-weight:700;">${medal}</td>
            <td style="padding:8px 10px;font-size:14px;color:#e5e7eb;">${escapeHtml(row.display_name)}</td>
            <td style="padding:8px 10px;font-size:13px;color:#e5e7eb;">
              <div style="display:inline-block;vertical-align:middle;width:140px;background:#0f172a;height:8px;border-radius:4px;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#10b981,#34d399);width:${pct}%;height:8px;"></div>
              </div>
              <span style="margin-left:8px;font-weight:700;">${row.total_points}p</span>
            </td>
            <td style="padding:8px 10px;font-size:13px;color:${row.delta > 0 ? '#34d399' : '#6b7280'};text-align:right;font-weight:600;">
              ${row.delta > 0 ? `+${row.delta}` : '—'}
            </td>
          </tr>`
        }).join('')}
      </table>`

  const movers = d.topMover
    ? `<div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:12px;padding:14px 16px;margin:8px 0;">
        <div style="font-size:11px;color:#34d399;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🚀 Veckans raket</div>
        <div style="font-size:18px;color:#fff;font-weight:700;margin-top:4px;">${escapeHtml(d.topMover.name)}</div>
        <div style="font-size:13px;color:#9ca3af;margin-top:2px;">+${d.topMover.delta}p sedan förra rapporten</div>
      </div>`
    : ''
  const sharpshooter = d.topTipper
    ? `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:14px 16px;margin:8px 0;">
        <div style="font-size:11px;color:#fbbf24;text-transform:uppercase;letter-spacing:1px;font-weight:700;">🎯 Veckans skarpskytt</div>
        <div style="font-size:18px;color:#fff;font-weight:700;margin-top:4px;">${escapeHtml(d.topTipper.name)}</div>
        <div style="font-size:13px;color:#9ca3af;margin-top:2px;">${d.topTipper.exact_in_window} exakta tips totalt</div>
      </div>`
    : ''

  return `
    <h1 style="margin:0 0 6px;font-size:22px;color:#fff;">${escapeHtml(d.poolName)}</h1>
    <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:18px;">Veckans rapport</div>

    <p style="font-size:15px;line-height:1.6;color:#d1d5db;font-style:italic;border-left:3px solid #10b981;padding:8px 14px;background:rgba(16,185,129,0.05);border-radius:0 8px 8px 0;">${escapeHtml(d.wittyIntro)}</p>

    ${movers}${sharpshooter}

    <h2 style="font-size:15px;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin:24px 0 4px;">📊 Tabellen</h2>
    ${leaderboardTable}

    <h2 style="font-size:15px;color:#10b981;text-transform:uppercase;letter-spacing:1px;margin:24px 0 4px;">⚽ Matcher avgjorda</h2>
    ${matchesTable}

    <p style="margin-top:24px;font-size:13px;color:#9ca3af;">Spelet rullar vidare – glöm inte att tippa kommande matcher!</p>
  `
}

export function renderReminderHtml(args: {
  intro: string
  matches: Array<{ home: string; away: string; kickoffIso: string; venue: string | null }>
  myPredictionMap: Map<number, boolean>
  matchIdToIdx: Map<number, number>
}): string {
  const rows = args.matches.map((m, i) => {
    const kickoff = new Date(m.kickoffIso).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    return `<tr style="background:${i % 2 === 0 ? '#1f2937' : '#111827'};">
      <td style="padding:10px;color:#9ca3af;font-size:12px;width:130px;">${escapeHtml(kickoff)}</td>
      <td style="padding:10px;color:#e5e7eb;font-size:14px;text-align:right;">${escapeHtml(m.home)}</td>
      <td style="padding:10px;color:#fbbf24;font-size:14px;text-align:center;width:30px;">–</td>
      <td style="padding:10px;color:#e5e7eb;font-size:14px;">${escapeHtml(m.away)}</td>
    </tr>`
  }).join('')

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tippavm2026.se'

  return `
    <h1 style="margin:0 0 12px;font-size:20px;color:#fff;">⏰ Glöm inte tippa</h1>
    <p style="color:#d1d5db;font-size:15px;line-height:1.6;">${escapeHtml(args.intro)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:18px 0;">
      ${rows}
    </table>

    <div style="text-align:center;margin:24px 0;">
      <a href="${baseUrl}/tips" style="display:inline-block;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#000;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">
        Lägg dina tips →
      </a>
    </div>
  `
}
